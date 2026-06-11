"use client";
import React, { ReactNode } from "react";

type AlertVariant = "success" | "warning" | "error" | "info";

interface InlineAlertProps {
  title?: string;
  description: string;
  variant?: AlertVariant;
  icon?: ReactNode;
  className?: string;
}

export default function InlineAlert({
  title,
  description,
  variant = "info",
  icon,
  className = "",
}: InlineAlertProps) {
  const getStyles = () => {
    switch (variant) {
      case "success":
        return {
          border: "border-success/20",
          bg: "bg-success/5",
          text: "text-success",
          iconColor: "text-success",
        };
      case "warning":
        return {
          border: "border-warning/20",
          bg: "bg-warning/5",
          text: "text-warning",
          iconColor: "text-warning",
        };
      case "error":
        return {
          border: "border-error/20",
          bg: "bg-error/5",
          text: "text-error",
          iconColor: "text-error",
        };
      case "info":
      default:
        return {
          border: "border-accent/20",
          bg: "bg-accent/5",
          text: "text-accent",
          iconColor: "text-accent",
        };
    }
  };

  const styles = getStyles();

  const getDefaultIcon = () => {
    switch (variant) {
      case "success":
        return (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "warning":
        return (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case "error":
        return (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "info":
      default:
        return (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${styles.border} ${styles.bg} ${className}`} role="alert">
      <div className={`${styles.iconColor} mt-0.5 shrink-0`}>
        {icon ?? getDefaultIcon()}
      </div>
      <div className="space-y-1">
        {title && (
          <span className={`text-[10px] font-black uppercase tracking-widest leading-none block ${styles.text}`}>
            {title}
          </span>
        )}
        <p className="text-[11px] font-bold text-text/80 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
