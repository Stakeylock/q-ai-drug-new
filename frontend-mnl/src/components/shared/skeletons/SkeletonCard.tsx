interface SkeletonCardProps {
  className?: string;
  lines?: number;
  showBadge?: boolean;
}

export default function SkeletonCard({
  className = "",
  lines = 3,
  showBadge = true,
}: SkeletonCardProps) {
  return (
    <article
      className={`rounded-xl border border-white/10 bg-slate-900/60 p-4 shadow-[0_10px_36px_-22px_rgba(15,23,42,0.7)] ${className}`}
    >
      <div className="animate-pulse space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="h-4 w-36 rounded bg-slate-800/90" />
          {showBadge ? <div className="h-6 w-16 rounded-full bg-slate-800/80" /> : null}
        </div>
        {Array.from({ length: lines }).map((_, idx) => (
          <div
            key={idx}
            className={`h-3 rounded bg-slate-800/75 ${idx === lines - 1 ? "w-4/5" : "w-full"}`}
          />
        ))}
      </div>
    </article>
  );
}