"use client";

import React, { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  className = "" 
}: EmptyStateProps) {
  return (
    <div className={`ui-card-surface flex flex-col items-center justify-center p-12 text-center ${className}`}>
      <div className="flex flex-col items-center gap-6 max-w-sm">
        {icon ? (
          <div className="text-muted-text/30">{icon}</div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted-bg/50 border border-border/40">
            <svg className="h-8 w-8 text-muted-text/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
        )}
        
        <div className="space-y-2">
          <h3 className="text-lg font-bold tracking-tight text-text">{title}</h3>
          <p className="text-sm font-medium text-muted-text/60 leading-relaxed">
            {description}
          </p>
        </div>

        {action && (
          <div className="pt-2">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
