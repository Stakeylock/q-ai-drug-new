interface SkeletonTableProps {
  columns?: number;
  rows?: number;
  className?: string;
}

export default function SkeletonTable({
  columns = 5,
  rows = 6,
  className = "",
}: SkeletonTableProps) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-slate-900/65 p-3 ${className}`}>
      <div className="animate-pulse space-y-2">
        <div
          className="grid gap-2 rounded-xl bg-slate-950/45 p-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, idx) => (
            <div key={idx} className="h-3 rounded bg-slate-800/70" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="grid gap-2 rounded-xl p-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, colIdx) => (
              <div key={colIdx} className="h-9 rounded bg-slate-800/65" />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}