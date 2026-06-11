import Link from "next/link";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  icon?: ReactNode;
  className?: string;
}

function EmptyPlaceholderIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-12 w-12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ color: "var(--muted-text)" }}
    >
      <rect x="7" y="9" width="34" height="30" rx="8" stroke="currentColor" strokeWidth="2" />
      <path d="M14 19h20M14 25h14M14 31h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="33" cy="31" r="2" fill="currentColor" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
  icon,
  className = "",
}: EmptyStateProps) {
  const ctaBaseClass =
    "ui-button inline-flex items-center justify-center rounded-lg border px-3.5 py-2 text-sm font-medium";

  return (
    <section
      className={`ui-fade-in ui-state-transition flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center ${className}`}
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--card)",
        color: "var(--text)",
      }}
    >
      <div
        className="rounded-full border p-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--muted-bg)" }}
      >
        {icon ?? <EmptyPlaceholderIcon />}
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6" style={{ color: "var(--muted-text)" }}>{description}</p>

      {ctaLabel ? (
        ctaHref ? (
          <Link
            href={ctaHref}
            className={`mt-4 ${ctaBaseClass}`}
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--text)",
            }}
          >
            {ctaLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onCtaClick}
            className={`mt-4 ${ctaBaseClass}`}
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--text)",
            }}
          >
            {ctaLabel}
          </button>
        )
      ) : null}
    </section>
  );
}