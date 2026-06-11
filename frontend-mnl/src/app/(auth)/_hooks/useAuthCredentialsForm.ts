import { useMemo, useState } from "react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthField = "email" | "password";

type AuthValues = {
  email: string;
  password: string;
};

type AuthErrors = {
  email: string;
  password: string;
};

type AuthTouched = {
  email: boolean;
  password: boolean;
};

type AuthCredentialsFormOptions = {
  requireValidEmailFormat?: boolean;
  passwordMinLength?: number;
};

export function validateEmail(email: string, requireValidEmailFormat = true): string {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    return "Email is required.";
  }

  if (requireValidEmailFormat && !EMAIL_PATTERN.test(trimmedEmail)) {
    return "Enter a valid email address.";
  }

  return "";
}

export function validatePassword(password: string, minLength = 6): string {
  const normalizedPassword = password.trim();

  if (!normalizedPassword) {
    return "Password is required.";
  }

  if (minLength > 1 && normalizedPassword.length < minLength) {
    return `Password must be at least ${minLength} characters.`;
  }

  return "";
}

export function useAuthCredentialsForm(options: AuthCredentialsFormOptions = {}) {
  const { requireValidEmailFormat = true, passwordMinLength = 6 } = options;

  const [values, setValues] = useState<AuthValues>({ email: "", password: "" });
  const [touched, setTouched] = useState<AuthTouched>({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo<AuthErrors>(
    () => ({
      email: validateEmail(values.email, requireValidEmailFormat),
      password: validatePassword(values.password, passwordMinLength),
    }),
    [passwordMinLength, requireValidEmailFormat, values.email, values.password],
  );

  const isValid = !errors.email && !errors.password;

  const setFieldValue = (field: AuthField, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const markTouched = (field: AuthField) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
  };

  const getErrorFor = (field: AuthField) => {
    if (submitted || touched[field]) {
      return errors[field];
    }

    return undefined;
  };

  const markSubmitted = () => {
    setSubmitted(true);
  };

  return {
    values,
    isValid,
    setFieldValue,
    markTouched,
    getErrorFor,
    markSubmitted,
  };
}
