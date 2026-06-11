"use client";

import React, { ReactNode } from "react";
import StatusBadge, { StatusType } from "./StatusBadge";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  helperText?: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
  icon?: ReactNode;
  status?: StatusType;
  className?: string;
}

export default function MetricCard({ 
  label, 
  value, 
  unit, 
  helperText, 
  trend, 
  icon, 
  status,
  className = "" 
}: MetricCardProps) {
  return (
    <div className={`ui-card-surface group flex flex-col gap-3 p-5 transition-all hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/70">{label}</span>
        <div className="flex items-center gap-2">
          {status && <StatusBadge status={status} size="sm" />}
          {icon && <div className="text-accent/60 transition-colors group-hover:text-accent">{icon}</div>}
        </div>
      </div>
      
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black tracking-tight text-text">{value}</span>
          {unit && <span className="text-xs font-bold text-muted-text/60">{unit}</span>}
        </div>
        
        {(trend || helperText) && (
          <div className="flex items-center gap-2">
            {trend && (
              <span className={`flex items-center gap-0.5 text-[10px] font-black ${trend.isUp ? 'text-success' : 'text-error'}`}>
                {trend.isUp ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
            {helperText && (
              <span className="text-[11px] font-medium text-muted-text/50 truncate">{helperText}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
