"use client";

import { forwardRef, useState } from "react";
import { Input, InputProps } from "@/components/ui/Input";

export interface AuthInputProps extends InputProps {
  icon?: React.ReactNode;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput(
  { icon, type = "text", className = "", ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className="relative w-full">
      <Input
        ref={ref}
        type={inputType}
        className={`auth-input w-full pr-12 ${icon ? "pl-10" : ""} ${className}`}
        {...props}
      />
      
      {/* Optional Leading Icon */}
      {icon ? (
        <div className="absolute left-3.5 top-[38px] flex items-center justify-center text-muted-text opacity-70">
          {icon}
        </div>
      ) : null}

      {/* Password Visibility Toggle */}
      {isPassword ? (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3.5 top-[38px] flex h-8 w-8 items-center justify-center rounded-lg text-muted-text hover:bg-muted-bg hover:text-text transition-colors"
          aria-label={showPassword ? "Hide password" : "Show password"}
          title={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <svg
              className="h-4.5 w-4.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.893 7.893L21 21m-6.228-6.228l-3.65-3.65m0 0a3 3 0 104.243 4.243m-4.242-4.243L9.88 9.88"
              />
            </svg>
          ) : (
            <svg
              className="h-4.5 w-4.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          )}
        </button>
      ) : null}
    </div>
  );
});

AuthInput.displayName = "AuthInput";
