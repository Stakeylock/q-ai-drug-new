"use client";

import React from "react";

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthCard({ children, className = "" }: AuthCardProps) {
  return (
    <div
      className={`relative z-10 w-full rounded-3xl border p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 sm:p-8 ${className}`}
      style={{
        borderColor: "color-mix(in srgb, var(--border) 78%, var(--accent) 22%)",
        background:
          "linear-gradient(160deg, color-mix(in srgb, var(--card) 92%, transparent), color-mix(in srgb, var(--card) 82%, var(--accent) 18%))",
        boxShadow:
          "0 24px 70px color-mix(in srgb, var(--accent) 14%, transparent), inset 0 1px 0 color-mix(in srgb, var(--card) 75%, #ffffff 25%)",
      }}
    >
      {/* Dynamic light accent bar at the top of card */}
      <div 
        className="absolute left-10 right-10 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-75"
        style={{
          boxShadow: "0 0 12px var(--accent)",
        }}
      />

      {/* Futuristic high-density subtle data grids inside form card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(126,140,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(126,140,184,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "linear-gradient(to bottom, black 0%, black 50%, transparent 100%)",
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
