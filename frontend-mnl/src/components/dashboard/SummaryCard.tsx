"use client";

import { ReactNode } from "react";

interface SummaryCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: ReactNode;
}

export default function SummaryCard({
  label,
  subtitle,
  value,
  unit,
  icon,
}: SummaryCardProps) {
  return (
    <div className="ui-hover-lift ui-state-transition relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-lg hover:shadow-xl dark:border-[#1e293b] dark:bg-[#0b0f19]">
      <div className="flex items-start justify-between">
        <p className="text-sm tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        {icon && <div className="text-slate-400 opacity-80 dark:text-slate-500">{icon}</div>}
      </div>
      <div className="mt-4 flex flex-col">
        <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {value}
          {unit && (
            <span className="ml-1 text-lg font-medium text-slate-500 dark:text-slate-400">
              {unit}
            </span>
          )}
        </p>
        {subtitle && (
          <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
