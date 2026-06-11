"use client";

import React, { ReactNode } from "react";

interface ActionButtonGroupProps {
  children: ReactNode;
  className?: string;
}

export default function ActionButtonGroup({ children, className = "" }: ActionButtonGroupProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {React.Children.map(children, (child) => {
        if (!child) return null;
        return (
          <div className="flex-shrink-0">
            {child}
          </div>
        );
      })}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
}

export function ActionButton({ 
  label, 
  icon, 
  onClick, 
  variant = "secondary", 
  size = "md",
  className = "",
  disabled = false
}: ActionButtonProps) {
  const baseStyles = "inline-flex items-center gap-2 rounded-lg font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent/90 hover:shadow-accent/30",
    secondary: "bg-muted-bg text-text hover:bg-muted-bg/80 border border-border/40",
    outline: "border border-border text-muted-text hover:border-accent hover:text-accent bg-transparent",
    ghost: "bg-transparent text-muted-text hover:bg-muted-bg/50",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-[10px]",
    md: "px-4 py-2 text-[11px]",
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
