"use client";

import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  children: ReactNode;
}

export default function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="ui-card-surface flex flex-col p-8 shadow-premium transition-all duration-300 hover:shadow-2xl">
      <h3 className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:text-primary">
        {title}
      </h3>
      <div className="h-[300px] flex-1">{children}</div>
    </div>
  );
}

