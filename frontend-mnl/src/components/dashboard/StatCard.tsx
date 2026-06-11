"use client";

import type { ReactNode } from "react";
import { Tooltip } from "@/components/shared";

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon?: ReactNode;
  titleTooltip?: string;
  iconTooltip?: string;
}

export default function StatCard({
  title,
  value,
  description,
  icon,
  titleTooltip,
  iconTooltip,
}: StatCardProps) {
  return (
    <article
      className="ui-card-surface group relative overflow-hidden p-8 shadow-premium transition-all duration-300 hover:shadow-2xl"
    >
      {/* Dynamic Glow Effect */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl transition-opacity duration-300 group-hover:bg-primary/20"
      />

      <div className="relative flex items-start justify-between">
        <div className="flex flex-col gap-1">
          {titleTooltip ? (
            <Tooltip content={titleTooltip}>
              <p className="cursor-help text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary transition-colors group-hover:text-primary">
                {title}
              </p>
            </Tooltip>
          ) : (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary transition-colors group-hover:text-primary">
              {title}
            </p>
          )}
        </div>
        
        {icon && (
          <div className="relative">
            {iconTooltip ? (
              <Tooltip content={iconTooltip}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary shadow-sm transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/20">
                  {icon}
                </div>
              </Tooltip>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary shadow-sm transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/20">
                {icon}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <p className="text-4xl font-black tracking-tight text-text leading-none">
          {value}
        </p>
        <p className="text-sm font-medium text-text-secondary/80 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Decorative progress-like bar at the bottom */}
      <div className="absolute bottom-0 left-0 h-1 w-0 bg-primary transition-all duration-500 group-hover:w-full" />
    </article>
  );
}

