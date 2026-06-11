"use client";
import React, { ReactNode } from "react";

interface PermissionStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  requiredRole?: string;
  action?: ReactNode;
  className?: string;
}

export default function PermissionState({
  icon,
  title,
  description,
  requiredRole,
  action,
  className = "",
}: PermissionStateProps) {
  return (
    <div className={`ui-card-surface flex flex-col items-center justify-center p-12 text-center border-warning/10 bg-warning/[0.02] ${className}`}>
      <div className="flex flex-col items-center gap-6 max-w-md">
        {icon ? (
          <div className="text-warning">{icon}</div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10 border border-warning/30 text-warning">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}
        
        <div className="space-y-2">
          <h3 className="text-lg font-black tracking-tight text-text uppercase">{title}</h3>
          <p className="text-sm font-medium text-muted-text/80 leading-relaxed">
            {description}
          </p>
        </div>

        {requiredRole && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-warning border border-warning/20">
            Requires: {requiredRole}
          </div>
        )}

        {action && (
          <div className="pt-2">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
