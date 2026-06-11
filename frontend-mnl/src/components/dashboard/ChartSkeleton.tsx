"use client";

interface ChartSkeletonProps {
  titleWidthClass?: string;
}

export default function ChartSkeleton({
  titleWidthClass = "w-40",
}: ChartSkeletonProps) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-[#1e293b] dark:bg-[#0b0f19]">
      <div className={`mb-6 h-4 rounded-md bg-slate-200 animate-pulse ${titleWidthClass}`} />

      <div className="relative h-64 flex-1 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-[#1e293b] dark:bg-[#020617]">
        <div className="absolute bottom-6 left-4 right-4 flex items-end gap-2">
          <div className="h-16 flex-1 rounded-sm bg-slate-200 animate-pulse" />
          <div className="h-24 flex-1 rounded-sm bg-slate-200 animate-pulse" />
          <div className="h-12 flex-1 rounded-sm bg-slate-200 animate-pulse" />
          <div className="h-28 flex-1 rounded-sm bg-slate-200 animate-pulse" />
          <div className="h-20 flex-1 rounded-sm bg-slate-200 animate-pulse" />
          <div className="h-32 flex-1 rounded-sm bg-slate-200 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
