"use client";

interface AuthDividerProps {
  label?: string;
}

export function AuthDivider({ label = "or" }: AuthDividerProps) {
  return (
    <div className="relative my-6 flex items-center justify-center">
      <div 
        className="absolute inset-0 flex items-center" 
        aria-hidden="true"
      >
        <div 
          className="w-full border-t" 
          style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)" }}
        />
      </div>
      <div className="relative">
        <span 
          className="rounded-full px-3 py-1 text-xs font-mono tracking-widest uppercase"
          style={{ 
            background: "var(--card)", 
            color: "var(--muted-text)",
            border: "1px solid color-mix(in srgb, var(--border) 65%, transparent)"
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
