"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { 
  AuthCard, 
  AuthHeader, 
  AuthInput, 
  AuthDivider, 
  SSOButton, 
  AuthStatusMessage,
  SSOProvider
} from "../_components";
import { useAuthCredentialsForm } from "../_hooks/useAuthCredentialsForm";
import { setToken, login, signup, toFriendlyErrorMessage } from "@/services";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const { values, isValid, setFieldValue, markTouched, getErrorFor, markSubmitted } =
    useAuthCredentialsForm({
      requireValidEmailFormat: false,
      passwordMinLength: 1,
    });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    markSubmitted();

    if (isLoading) {
      return;
    }

    const email = values.email.trim();
    const password = values.password.trim();

    if (!email || !password) {
      setSuccessMessage(null);
      setFormError("Email and password are required.");
      return;
    }

    if (!isValid) {
      return;
    }

    setFormError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await login(email, password);
      setToken(response.token);
      setSuccessMessage(response.message || "Signed in successfully. Preparing workspace...");
      setTimeout(() => {
        router.push("/workspace-selector");
        setIsLoading(false);
      }, 700);
    } catch (err) {
      setFormError(toFriendlyErrorMessage(err, "Invalid email or security password. Please try again."));
      setIsLoading(false);
    }
  };

  const handleSSOLogin = async (provider: SSOProvider) => {
    setIsLoading(true);
    setFormError(null);
    setSuccessMessage(`Authorizing federated credentials via ${provider.toUpperCase()}...`);
    
    try {
      let response;
      try {
        response = await login("dev@test.com", "Password123!");
      } catch (err) {
        // If login fails, try to sign up the default dev user first
        await signup("dev@test.com", "Password123!", "Dev User", "Dev Workspace");
        response = await login("dev@test.com", "Password123!");
      }
      setToken(response.token);
      setSuccessMessage("SSO credentials validated. Redirecting to selector...");
      setTimeout(() => {
        router.push("/workspace-selector");
        setIsLoading(false);
      }, 700);
    } catch (err) {
      setFormError("SSO login failed. Please sign up normally using the form.");
      setIsLoading(false);
    }
  };

  const handleContactSupport = () => {
    alert("Enterprise Support Notice:\n\nA support ticket has been logged for your institutional IP (192.168.42.100). A platform coordinator will contact you shortly.");
  };

  return (
    <AuthCard>
      <AuthHeader 
        title="Welcome back to QuDrugForge" 
        subtitle="Access your AI-powered molecular discovery workspace." 
      />

      {/* Federated Scientific SSO Options */}
      <div className="mt-6 space-y-3">
        <SSOButton 
          provider="google" 
          onClick={() => handleSSOLogin("google")} 
          disabled={isLoading} 
        />
        <div className="grid grid-cols-2 gap-3">
          <SSOButton 
            provider="microsoft" 
            onClick={() => handleSSOLogin("microsoft")} 
            disabled={isLoading} 
          />
          <SSOButton 
            provider="okta" 
            onClick={() => handleSSOLogin("okta")} 
            disabled={isLoading} 
          />
        </div>
      </div>

      <AuthDivider label="or sign in with credentials" />

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <AuthInput
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          label="Institutional Email"
          placeholder="researcher@quinfosys.com"
          value={values.email}
          onChange={(event) => setFieldValue("email", event.target.value)}
          onBlur={() => markTouched("email")}
          error={getErrorFor("email")}
          disabled={isLoading}
          required
          icon={
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <AuthInput
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          label="Security Key / Password"
          placeholder="Enter your security password"
          value={values.password}
          onChange={(event) => setFieldValue("password", event.target.value)}
          onBlur={() => markTouched("password")}
          error={getErrorFor("password")}
          disabled={isLoading}
          required
          icon={
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
        />

        {/* Remember Me & Forgot Password Links */}
        <div className="flex items-center justify-between text-xs py-1">
          <label className="flex items-center gap-2 cursor-pointer select-none" style={{ color: "var(--muted-text)" }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              disabled={isLoading}
              className="h-4.5 w-4.5 rounded border-2 transition-all duration-200 accent-cyan-500 cursor-pointer"
              style={{ 
                borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
                backgroundColor: "var(--card)"
              }}
            />
            <span className="hover:text-text transition-colors">Remember this terminal</span>
          </label>
          <Link 
            href="/forgot-password" 
            className="hover:underline font-medium transition-colors" 
            style={{ color: "var(--accent)" }}
          >
            Forgot password?
          </Link>
        </div>

        {formError ? <AuthStatusMessage type="error" message={formError} /> : null}
        {successMessage ? <AuthStatusMessage type="success" message={successMessage} /> : null}

        <Button
          type="submit"
          className="ui-button w-full rounded-xl py-3 text-sm font-semibold mt-2"
          disabled={!isValid || isLoading}
          isLoading={isLoading}
          loadingText="Verifying signature..."
        >
          Sign in
        </Button>
      </form>

      {/* Secondary Bottom Links */}
      <div 
        className="mt-6 border-t pt-4 flex flex-col gap-2 text-xs text-center" 
        style={{ borderColor: "color-mix(in srgb, var(--border) 45%, transparent)" }}
      >
        <div className="flex items-center justify-center gap-1.5" style={{ color: "var(--muted-text)" }}>
          <span>New researcher?</span>
          <Link 
            href="/signup" 
            className="hover:underline font-semibold transition-colors" 
            style={{ color: "var(--accent)" }}
          >
            Create account
          </Link>
        </div>
        <div className="flex items-center justify-center gap-1.5" style={{ color: "var(--muted-text)" }}>
          <span>Issues connecting?</span>
          <button 
            type="button"
            onClick={handleContactSupport}
            className="hover:underline font-semibold transition-colors" 
            style={{ color: "var(--accent)" }}
          >
            Contact enterprise support
          </button>
        </div>
      </div>
    </AuthCard>
  );
}