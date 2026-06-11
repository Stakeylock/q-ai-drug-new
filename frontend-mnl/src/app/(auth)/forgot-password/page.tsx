"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui";
import { 
  AuthCard, 
  AuthHeader, 
  AuthInput, 
  AuthStatusMessage 
} from "../_components";
import { validateEmail } from "../_hooks/useAuthCredentialsForm";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailError = validateEmail(email);
  const isValid = !emailError;
  const showEmailError = (isTouched || submitted) && emailError;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    if (!isValid || isLoading) {
      return;
    }

    setApiError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSuccessMessage("Verification link sent! Please check your institutional inbox.");
    } catch {
      setApiError("Unable to send verification link. Please check network logs.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard>
      <AuthHeader 
        title="Key Recovery" 
        subtitle="Submit your registered institutional email to request a new cryptographic access key." 
      />

      <form className="space-y-4 mt-6" onSubmit={handleSubmit} noValidate>
        <AuthInput
          id="forgot-password-email"
          name="email"
          type="email"
          autoComplete="email"
          label="Registered Institutional Email"
          placeholder="researcher@quinfosys.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setIsTouched(true)}
          error={showEmailError ? emailError : undefined}
          disabled={isLoading}
          required
          icon={
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {apiError ? <AuthStatusMessage type="error" message={apiError} /> : null}
        {successMessage ? <AuthStatusMessage type="success" message={successMessage} /> : null}

        <Button
          type="submit"
          className="ui-button w-full rounded-xl py-3 text-sm font-semibold mt-2"
          disabled={!isValid || isLoading}
          isLoading={isLoading}
          loadingText="Verifying identity..."
        >
          Send Verification Link
        </Button>
      </form>

      <p className="mt-6 text-center text-xs" style={{ color: "var(--muted-text)" }}>
        Remembered your key?{" "}
        <Link 
          href="/login" 
          className="hover:underline font-semibold transition-colors duration-150" 
          style={{ color: "var(--accent)" }}
        >
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
