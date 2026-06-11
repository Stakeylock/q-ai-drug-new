"use client";

interface AuthHeaderProps {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}

export function AuthHeader({ title, subtitle, align = "center" }: AuthHeaderProps) {
  const alignmentClass = align === "left" ? "text-left" : "text-center";

  return (
    <header className={`space-y-2.5 ${alignmentClass}`}>
      <h2 
        className="text-2xl font-semibold tracking-tight sm:text-[1.72rem]" 
        style={{ color: "var(--text)" }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p 
          className="text-sm leading-6" 
          style={{ color: "var(--muted-text)" }}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
