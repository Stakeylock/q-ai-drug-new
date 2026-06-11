"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { 
  AuthCard, 
  AuthHeader, 
  AuthInput, 
  AuthStatusMessage 
} from "../_components";
import { setToken, signup, toFriendlyErrorMessage } from "@/services";

type AccountType = "individual" | "academic" | "startup" | "enterprise";

export default function SignupPage() {
  const router = useRouter();
  
  // Form State
  const [selectedType, setSelectedType] = useState<AccountType>("individual");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [researchFocus, setResearchFocus] = useState("oncology");
  const [agreed, setAgreed] = useState(false);
  
  // Telemetry & Loading
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (isLoading) return;
    
    // Core Valdiation
    if (!fullName.trim() || !email.trim() || !orgName.trim() || !role.trim()) {
      setFormError("All profile credentials are required to mount research workspace.");
      return;
    }
    
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters for regulatory compliance.");
      return;
    }
    
    if (password !== confirmPassword) {
      setFormError("Passwords do not match. Please verify your cryptographic security signature.");
      return;
    }
    
    if (!agreed) {
      setFormError("You must agree to the Terms, Privacy Policy, and Research Use Guidelines.");
      return;
    }
    
    setFormError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await signup(email, password, fullName, orgName);
      setToken(response.token);
      setSuccessMessage(response.message || "Onboarding profile loaded. Preparing workspace...");
      
      setTimeout(() => {
        router.push("/workspace-selector");
        setIsLoading(false);
      }, 700);
    } catch (err) {
      setFormError(toFriendlyErrorMessage(err, "Registration failed. Please check your credentials and try again."));
      setIsLoading(false);
    }
  };

  return (
    <AuthCard className="max-w-xl">
      <AuthHeader 
        title="Create your research workspace" 
        subtitle="Start managing AI-powered drug discovery programs with molecular intelligence workflows." 
      />

      <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
        {/* Account / Workspace Type Selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            Workspace Tier Profile
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "individual", label: "Individual", desc: "Single Investigator" },
              { id: "academic", label: "Academic Lab", desc: "University Research" },
              { id: "startup", label: "Biotech Startup", desc: "Early Lead Screening" },
              { id: "enterprise", label: "Enterprise", desc: "Corporate R&D Pipeline" }
            ].map((type) => {
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id as AccountType)}
                  className="rounded-xl border p-2.5 text-left transition-all duration-200"
                  style={{
                    borderColor: isSelected 
                      ? "var(--accent)" 
                      : "color-mix(in srgb, var(--border) 60%, transparent)",
                    background: isSelected 
                      ? "color-mix(in srgb, var(--accent) 7%, var(--card))" 
                      : "var(--card)",
                  }}
                >
                  <p className="text-xs font-semibold" style={{ color: isSelected ? "var(--accent)" : "var(--text)" }}>
                    {type.label}
                  </p>
                  <p className="text-[9px]" style={{ color: "var(--muted-text)" }}>
                    {type.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AuthInput
            id="register-name"
            name="name"
            type="text"
            label="Full Name"
            placeholder="Dr. Elizabeth Blackburn"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isLoading}
            required
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />

          <AuthInput
            id="register-email"
            name="email"
            type="email"
            label="Work Email"
            placeholder="blackburn@lab.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />

          <AuthInput
            id="register-org"
            name="org"
            type="text"
            label="Organization / Lab Name"
            placeholder="Salk Molecular Research"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            disabled={isLoading}
            required
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />

          <AuthInput
            id="register-role"
            name="role"
            type="text"
            label="Role"
            placeholder="Principal Investigator"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isLoading}
            required
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>

        {/* Focus Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            Primary Research Focus
          </label>
          <select
            value={researchFocus}
            onChange={(e) => setResearchFocus(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm text-text outline-none transition-all duration-200"
            style={{
              borderColor: "color-mix(in srgb, var(--border) 60%, var(--accent) 40%)",
              background: "var(--card)"
            }}
          >
            <option value="oncology">Oncology discovery programs</option>
            <option value="infectious">Infectious Disease modeling</option>
            <option value="rare">Rare Disease candidate searches</option>
            <option value="neuro">Neurodegeneration pathways</option>
            <option value="general">General Discovery & Bio-computations</option>
          </select>
        </div>

        {/* Security Keys Block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AuthInput
            id="register-password"
            name="password"
            type="password"
            label="Access Key / Password"
            placeholder="Choose secure key"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          />

          <AuthInput
            id="register-confirm"
            name="confirm"
            type="password"
            label="Confirm Key / Password"
            placeholder="Confirm secure key"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            required
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
        </div>

        {/* Interactive terms & guidelines checked checkbox */}
        <div className="flex items-start gap-2.5 py-1 select-none">
          <input
            type="checkbox"
            id="register-terms"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={isLoading}
            className="h-4.5 w-4.5 rounded mt-0.5 border-2 accent-cyan-500 cursor-pointer"
            style={{ 
              borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
              backgroundColor: "var(--card)"
            }}
          />
          <label htmlFor="register-terms" className="text-[11px] leading-tight cursor-pointer" style={{ color: "var(--muted-text)" }}>
            I agree to the{" "}
            <span className="text-cyan-400 hover:underline cursor-pointer">Terms of Service</span>,{" "}
            <span className="text-cyan-400 hover:underline cursor-pointer">Privacy Policy</span>, and{" "}
            <span className="text-cyan-400 hover:underline cursor-pointer">FDA Research Use Guidelines</span>.
          </label>
        </div>

        {formError ? <AuthStatusMessage type="error" message={formError} /> : null}
        {successMessage ? <AuthStatusMessage type="success" message={successMessage} /> : null}

        <Button
          type="submit"
          className="ui-button w-full rounded-xl py-3 text-sm font-semibold mt-2"
          disabled={isLoading}
          isLoading={isLoading}
          loadingText="Generating secure keypair..."
        >
          Create Workspace
        </Button>
      </form>

      <div 
        className="mt-6 border-t pt-4 text-center text-xs" 
        style={{ borderColor: "color-mix(in srgb, var(--border) 45%, transparent)" }}
      >
        <span style={{ color: "var(--muted-text)" }}>Already have an account? </span>
        <Link 
          href="/login" 
          className="hover:underline font-semibold transition-colors" 
          style={{ color: "var(--accent)" }}
        >
          Sign in
        </Link>
      </div>
    </AuthCard>
  );
}
