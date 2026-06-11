import { EmptyState } from "@/components/shared/states";

interface ResultsEmptyStateProps {
  title?: string;
  description?: string;
}

export function ResultsEmptyState({
  title = "No results yet",
  description = "Run the pipeline from Workspace to populate this section.",
}: ResultsEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      ctaLabel="Go to Workspace"
      ctaHref="/workspace"
      className="min-h-[220px]"
    />
  );
}

interface TableSkeletonProps {
  columns: number;
  rows: number;
}

export function TableSkeleton({ columns, rows }: TableSkeletonProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-opacity duration-300 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-slate-800/90" />
          <div className="h-3 w-64 rounded bg-slate-800/70" />
        </div>
        <div className="h-9 w-24 rounded-lg bg-slate-800/80" />
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
        <div className="grid gap-px bg-white/5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <div key={`header-${index}`} className="h-10 bg-slate-800/80" />
          ))}
          {Array.from({ length: rows }).map((_, rowIndex) =>
            Array.from({ length: columns }).map((__, columnIndex) => (
              <div key={`row-${rowIndex}-${columnIndex}`} className="h-12 bg-slate-900/80" />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

interface CardSkeletonProps {
  cards: number;
}

export function CardGridSkeleton({ cards }: CardSkeletonProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-opacity duration-300 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-44 rounded bg-slate-800/90" />
          <div className="h-3 w-72 rounded bg-slate-800/70" />
        </div>
        <div className="h-9 w-24 rounded-lg bg-slate-800/80" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <article key={index} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-slate-800/80" />
                <div className="h-3 w-44 rounded bg-slate-800/60" />
              </div>
              <div className="h-6 w-16 rounded-full bg-slate-800/70" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((__, metricIndex) => (
                <div key={metricIndex} className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-3">
                  <div className="h-2 w-14 rounded bg-slate-800/70" />
                  <div className="mt-3 h-4 w-12 rounded bg-slate-800/90" />
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-slate-900/60 p-3">
              <div className="h-2 w-24 rounded bg-slate-800/70" />
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full rounded bg-slate-800/70" />
                <div className="h-3 w-11/12 rounded bg-slate-800/60" />
                <div className="h-3 w-10/12 rounded bg-slate-800/60" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ChartSkeleton() {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-opacity duration-300 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-slate-800/90" />
          <div className="h-3 w-72 rounded bg-slate-800/70" />
        </div>
        <div className="h-9 w-24 rounded-lg bg-slate-800/80" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-xl border border-white/10 bg-slate-950/60" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)]">
        <div className="h-[380px] rounded-xl border border-white/10 bg-slate-950/60" />
        <div className="space-y-4">
          <div className="h-[180px] rounded-xl border border-white/10 bg-slate-950/60" />
          <div className="h-[160px] rounded-xl border border-white/10 bg-slate-950/60" />
        </div>
      </div>
    </section>
  );
}
