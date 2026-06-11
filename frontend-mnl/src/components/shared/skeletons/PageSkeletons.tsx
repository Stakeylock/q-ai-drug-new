import SkeletonCard from "./SkeletonCard";
import SkeletonChart from "./SkeletonChart";
import SkeletonTable from "./SkeletonTable";

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6 fade-in-soft">
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
        <div className="animate-pulse">
          <div className="h-4 w-32 rounded bg-slate-800/85" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <SkeletonCard key={idx} showBadge={false} lines={2} className="bg-slate-950/40" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <SkeletonCard key={idx} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart titleWidthClass="w-28" />
        </div>
        <div className="space-y-3">
          <SkeletonCard className="p-5" lines={4} showBadge={false} />
          <SkeletonCard className="p-5" lines={4} showBadge={false} />
        </div>
      </div>
    </div>
  );
}

export function WorkspacePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-8 pb-10">
      <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-7">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-24 rounded bg-slate-800/80" />
          <div className="h-8 w-72 rounded bg-slate-800/90" />
          <div className="h-4 w-3/4 rounded bg-slate-800/70" />
          <div className="h-4 w-2/3 rounded bg-slate-800/60" />
        </div>
      </div>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="space-y-6">
          <SkeletonCard className="h-64" lines={6} showBadge={false} />
          <SkeletonCard className="h-40" lines={4} showBadge={false} />
        </section>
        <section className="space-y-6">
          <SkeletonTable columns={4} rows={8} />
        </section>
      </div>
    </div>
  );
}

export function ResultsPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="h-10 animate-pulse rounded-xl border border-white/10 bg-slate-900/60" />
        ))}
      </div>
      <SkeletonCard className="p-5" lines={2} showBadge={false} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <SkeletonCard key={idx} className="h-24" lines={1} showBadge={false} />
        ))}
      </div>
      <SkeletonTable columns={6} rows={8} />
      <SkeletonChart heightClass="h-72" />
    </div>
  );
}

export function HistoryPageSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <SkeletonTable columns={5} rows={6} />
      <aside className="hidden xl:block">
        <SkeletonCard className="p-5" lines={7} showBadge={false} />
      </aside>
    </div>
  );
}