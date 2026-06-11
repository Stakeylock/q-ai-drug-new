"use client";

import React, { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  breadcrumb?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  dataSource?: "real" | "mock" | "partial" | "missing" | string;
}

export default function PageHeader({ 
  title, 
  breadcrumb, 
  description, 
  actions,
  className = "",
  dataSource
}: PageHeaderProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          {breadcrumb && (
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-text/50">
              {breadcrumb}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-text md:text-3xl">
              {title}
            </h1>
            {dataSource && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest border transition-all ${
                dataSource === "real"
                  ? "bg-success/10 border-success/20 text-success"
                  : dataSource === "mock"
                  ? "bg-accent/10 border-accent/20 text-accent animate-pulse"
                  : dataSource === "partial"
                  ? "bg-warning/10 border-warning/20 text-warning"
                  : "bg-error/10 border-error/20 text-error"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  dataSource === "real"
                    ? "bg-success"
                    : dataSource === "mock"
                    ? "bg-accent"
                    : dataSource === "partial"
                    ? "bg-warning"
                    : "bg-error"
                }`} />
                {dataSource === "real"
                  ? "REAL BACKEND DATA"
                  : dataSource === "mock"
                  ? "MOCK DATA / DEMO MODE"
                  : dataSource === "partial"
                  ? "PARTIAL BACKEND DATA"
                  : "MISSING BACKEND DATA"}
              </span>
            )}
          </div>
          {description && (
            <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-text/80">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-3">
            {actions}
          </div>
        )}
      </div>
      <div className="h-px w-full bg-gradient-to-r from-border/60 via-border/20 to-transparent" />
    </div>
  );
}
