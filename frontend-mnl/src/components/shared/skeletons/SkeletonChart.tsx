interface SkeletonChartProps {
  className?: string;
  titleWidthClass?: string;
  heightClass?: string;
}

export default function SkeletonChart({
  className = "",
  titleWidthClass = "w-40",
  heightClass = "h-64",
}: SkeletonChartProps) {
  return (
    <section className={`rounded-xl border border-white/10 bg-slate-900/60 p-5 ${className}`}>
      <div className="animate-pulse">
        <div className={`h-4 rounded bg-slate-800/85 ${titleWidthClass}`} />
        <div className={`mt-6 rounded-lg border border-white/10 bg-slate-950/60 p-4 ${heightClass}`}>
          <div className="flex h-full items-end gap-2">
            <div className="h-1/3 flex-1 rounded bg-slate-800/80" />
            <div className="h-1/2 flex-1 rounded bg-slate-800/75" />
            <div className="h-2/5 flex-1 rounded bg-slate-800/80" />
            <div className="h-3/4 flex-1 rounded bg-slate-800/70" />
            <div className="h-1/2 flex-1 rounded bg-slate-800/80" />
            <div className="h-4/5 flex-1 rounded bg-slate-800/70" />
          </div>
        </div>
      </div>
    </section>
  );
}