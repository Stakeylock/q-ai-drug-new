"use client";

import React, { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function SectionHeader({ 
  title, 
  description, 
  action, 
  className = "" 
}: SectionHeaderProps) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="space-y-1">
        <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-text/50">
          {title}
        </h2>
        {description && (
          <p className="text-sm font-medium text-muted-text/80 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-3">
          {action}
        </div>
      )}
    </div>
  );
}
