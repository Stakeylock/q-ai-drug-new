import { ApiError, apiClient, isDemoMode } from "./api";

export interface AuthSuccessResponse {
  token: string;
  message?: string;
}

export interface AuthActionResponse {
  message: string;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractToken(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const directToken = pickString(record.token) ?? pickString(record.access_token) ?? pickString(record.accessToken);

  if (directToken) {
    return directToken;
  }

  const nestedData = record.data;
  if (nestedData && typeof nestedData === "object") {
    const nestedRecord = nestedData as Record<string, unknown>;
    return (
      pickString(nestedRecord.token) ??
      pickString(nestedRecord.access_token) ??
      pickString(nestedRecord.accessToken)
    );
  }

  return undefined;
}

function extractMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const directMessage = pickString(record.message);
  if (directMessage) {
    return directMessage;
  }

  const errorPayload = record.error;
  if (errorPayload && typeof errorPayload === "object") {
    const errorRecord = errorPayload as Record<string, unknown>;
    return pickString(errorRecord.message);
  }

  return undefined;
}

function normalizeAuthResponse(payload: unknown): AuthSuccessResponse {
  const token = extractToken(payload);
  if (!token) {
    throw new Error("Authentication succeeded but no token was returned.");
  }

  return {
    token,
    message: extractMessage(payload),
  };
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const bodyMessage = extractMessage(error.body);
    if (bodyMessage) {
      return bodyMessage;
    }
    return error.message || "Authentication request failed.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Authentication request failed.";
}

export async function login(email: string, password: string): Promise<AuthSuccessResponse> {
  const normalizedEmail = email.trim();
  const normalizedPassword = password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    throw new Error("Email and password are required.");
  }

  if (isDemoMode()) {
    return {
      token: "mock-demo-token-12345",
      message: "Signed in successfully under Demo Mode."
    };
  }

  const payload = await apiClient.post<unknown>("/auth/login", {
    body: { email: normalizedEmail, password: normalizedPassword },
  });

  return normalizeAuthResponse(payload);
}

export async function signup(
  email: string,
  password: string,
  fullName: string,
  workspaceName: string
): Promise<AuthSuccessResponse> {
  if (isDemoMode()) {
    return {
      token: "mock-demo-token-12345",
      message: "Account created successfully under Demo Mode."
    };
  }

  const payload = await apiClient.post<unknown>("/auth/register", {
    body: {
      email: email.trim(),
      password: password.trim(),
      full_name: fullName.trim(),
      workspace_name: workspaceName.trim(),
    },
  });

  return normalizeAuthResponse(payload);
}

export async function requestPasswordReset(email: string): Promise<AuthActionResponse> {
  if (isDemoMode()) {
    return {
      message: "Password reset link sent (Simulated)."
    };
  }

  const payload = await apiClient.post<unknown>("/auth/forgot-password", {
    body: { email },
  });

  return {
    message: extractMessage(payload) ?? "Password reset link sent. Please check your email.",
  };
}
