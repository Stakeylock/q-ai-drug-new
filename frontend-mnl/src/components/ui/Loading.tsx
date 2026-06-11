import type { HTMLAttributes } from "react";

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
}

interface DashboardSkeletonProps {
  cardCount?: number;
  rowCount?: number;
}

interface FullPageLoadingProps {
  label?: string;
}

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const SPINNER_SIZE_STYLES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
};

export function Spinner({
  size = "md",
  label = "Processing Analysis",
  className,
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={joinClasses("inline-flex items-center justify-center", className)}
      {...props}
    >
      <div className="relative">
        <div
          className={joinClasses(
            "animate-spin rounded-full border-2 border-primary/20 border-t-primary",
            SPINNER_SIZE_STYLES[size],
          )}
        />
        <div
          className={joinClasses(
            "absolute inset-0 animate-pulse rounded-full bg-primary/10",
            SPINNER_SIZE_STYLES[size],
          )}
        />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function DashboardSkeleton({
  cardCount = 3,
  rowCount = 6,
}: DashboardSkeletonProps) {
  return (
    <section
      aria-label="Loading dashboard content"
      className="space-y-8"
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div
            key={`skeleton-card-${index}`}
            className="ui-card-surface p-8 shadow-premium"
          >
            <div className="skeleton-shimmer h-4 w-32 rounded-full opacity-60" />
            <div className="mt-6 skeleton-shimmer h-10 w-24 rounded-xl" />
            <div className="mt-4 skeleton-shimmer h-3 w-full rounded-full opacity-40" />
          </div>
        ))}
      </div>

      <div className="ui-card-surface shadow-premium overflow-hidden">
        <div className="border-b border-border/50 bg-surface-subtle/30 px-8 py-5">
          <div className="skeleton-shimmer h-5 w-48 rounded-full" />
        </div>
        <div className="divide-y divide-border/30 px-8">
          {Array.from({ length: rowCount }).map((_, index) => (
            <div
              key={`skeleton-row-${index}`}
              className="grid grid-cols-12 gap-4 py-6"
            >
              <div className="col-span-3 skeleton-shimmer h-4 rounded-full opacity-80" />
              <div className="col-span-2 skeleton-shimmer h-4 rounded-full opacity-60" />
              <div className="col-span-2 skeleton-shimmer h-4 rounded-full opacity-60" />
              <div className="col-span-3 skeleton-shimmer h-4 rounded-full opacity-80" />
              <div className="col-span-2 skeleton-shimmer h-4 rounded-full opacity-40" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FullPageLoading({
  label = "Initializing Oncology AI Systems",
}: FullPageLoadingProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6 rounded-3xl border border-border/50 bg-card/50 p-12 shadow-premium backdrop-blur-xl">
        <Spinner size="lg" label={label} />
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
            {label}
          </p>
          <p className="text-xs font-medium text-text-secondary">
            PLEASE WAIT WHILE WE PREPARE THE WORKSPACE
          </p>
        </div>
      </div>
    </div>
  );
}

