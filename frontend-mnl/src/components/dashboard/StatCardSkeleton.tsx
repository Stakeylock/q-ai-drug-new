"use client";

export default function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 shadow-[0_14px_35px_rgba(2,8,23,0.22)] dark:border-slate-700/70 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="h-3 w-24 rounded-md bg-slate-200 skeleton-shimmer" />
        <div className="h-9 w-9 rounded-lg border border-slate-700/80 bg-slate-800/70" />
      </div>
      <div className="mt-5 h-10 w-24 rounded-md bg-slate-200 skeleton-shimmer" />
      <div className="mt-3 h-3 w-40 rounded-md bg-slate-200 skeleton-shimmer" />
    </div>
  );
}
