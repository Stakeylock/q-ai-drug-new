"use client";

import React from "react";

export type SSOProvider = "google" | "microsoft" | "okta" | "orcid" | "github";

interface SSOButtonProps {
  provider: SSOProvider;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function SSOButton({ provider, onClick, disabled = false, className = "" }: SSOButtonProps) {
  const getProviderDetails = () => {
    switch (provider) {
      case "orcid":
        return {
          label: "Continue with ORCID iD",
          borderColor: "color-mix(in srgb, #a6ce39 60%, transparent)",
          hoverBg: "color-mix(in srgb, #a6ce39 8%, transparent)",
          icon: (
            <svg className="h-5 w-5 fill-[#a6ce39]" viewBox="0 0 24 24">
              <path d="M12 .003c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-.386 16.488c-.144.312-.42.468-.828.468H9.6v-7.92h1.188c.396 0 .672.156.828.468.156.312.234.726.234 1.242v4.5c0 .516-.078.93-.236 1.242zm.156-5.832c-.084-.216-.24-.324-.468-.324H9.6V8.16h1.692c.228 0 .384-.108.468-.324.084-.216.126-.522.126-.918s-.042-.702-.126-.918c-.084-.216-.24-.324-.468-.324H7.2V19.2h4.488c.228 0 .384-.108.468-.324.084-.216.126-.522.126-.918s-.042-.702-.126-.918z" />
            </svg>
          ),
        };
      case "microsoft":
        return {
          label: "Continue with Microsoft",
          borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
          hoverBg: "color-mix(in srgb, var(--text) 5%, transparent)",
          icon: (
            <svg className="h-5 w-5" viewBox="0 0 23 23">
              <path fill="#f35325" d="M0 0h11v11H0z" />
              <path fill="#81bc06" d="M12 0h11v11H12z" />
              <path fill="#05a6f0" d="M0 12h11v11H0z" />
              <path fill="#ffba08" d="M12 12h11v11H12z" />
            </svg>
          ),
        };
      case "okta":
        return {
          label: "Continue with Organization SSO",
          borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
          hoverBg: "color-mix(in srgb, var(--accent) 8%, transparent)",
          icon: (
            <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
        };
      case "github":
        return {
          label: "Continue with GitHub",
          borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
          hoverBg: "color-mix(in srgb, var(--text) 5%, transparent)",
          icon: (
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          ),
        };
      case "google":
      default:
        return {
          label: "Continue with Google",
          borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
          hoverBg: "color-mix(in srgb, var(--text) 5%, transparent)",
          icon: (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M5.266 9.765A7.077 7.077 0 0112 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.827 1.155 15.082 0 12 0 7.354 0 3.307 2.67 1.306 6.568l3.96 3.197z"
              />
              <path
                fill="#4285F4"
                d="M23.755 12.227c0-.79-.07-1.54-.2-2.227H12v4.51h6.6c-.29 1.51-1.14 2.78-2.42 3.64l3.77 2.92c2.2-2.03 3.8-5.02 3.8-8.843z"
              />
              <path
                fill="#FBBC05"
                d="M5.266 14.235A7.124 7.124 0 014.91 12c0-.79.13-1.55.356-2.235L1.306 6.568A11.956 11.956 0 000 12c0 1.92.45 3.74 1.248 5.357l4.018-3.122z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.97-1.07 7.96-2.91l-3.77-2.92c-1.05.7-2.39 1.12-4.19 1.12-3.23 0-5.97-2.18-6.95-5.12L1.03 17.29C3.03 21.23 7.14 24 12 24z"
              />
            </svg>
          ),
        };
    }
  };

  const details = getProviderDetails();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`ui-button flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 ${className}`}
      style={{
        borderColor: details.borderColor,
        background: "var(--card)",
        color: "var(--text)",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor = details.hoverBg;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor = "var(--card)";
      }}
    >
      <span className="shrink-0">{details.icon}</span>
      <span>{details.label}</span>
    </button>
  );
}
