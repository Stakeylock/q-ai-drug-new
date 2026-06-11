const ROWS = [
  { id: "CMP-1021", score: 0.92, status: "Ready" },
  { id: "CMP-1134", score: 0.88, status: "Review" },
  { id: "CMP-1202", score: 0.84, status: "Ready" },
  { id: "CMP-0988", score: 0.81, status: "Flagged" },
  { id: "CMP-0774", score: 0.79, status: "Review" },
];

export default function ResultsTableCanvas() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4">
      <section className="rounded-2xl border p-5 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, color-mix(in srgb, var(--card) 92%, transparent), color-mix(in srgb, var(--bg) 88%, var(--card)))" }}>
        <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Top Molecules</p>
        <h3 className="mt-2 text-xl font-semibold" style={{ color: "var(--text)" }}>Ranked Candidate Cards</h3>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-text)" }}>
          Sorted candidates based on similarity, docking performance, and quality filters.
        </p>
      </section>

      <section className="min-h-0 overflow-auto rounded-2xl border p-3 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.22)] backdrop-blur-xl" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card) 92%, transparent)" }}>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {ROWS.map((row, index) => (
            <article
              key={row.id}
              className="rounded-2xl border p-4 transition-transform duration-300 hover:-translate-y-0.5"
              style={{
                borderColor: index === 0 ? "var(--accent-border)" : "var(--border)",
                background:
                  index === 0
                    ? "linear-gradient(135deg, color-mix(in srgb, var(--accent-bg) 50%, var(--card)), color-mix(in srgb, var(--card) 92%, var(--accent-bg)))"
                    : "linear-gradient(135deg, color-mix(in srgb, var(--card) 92%, transparent), color-mix(in srgb, var(--bg) 92%, var(--card)))",
                boxShadow: index === 0 ? "0 18px 42px -26px rgba(56,189,248,0.55)" : "0 14px 34px -26px rgba(15,23,42,0.24)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--muted-text)" }}>
                    Candidate
                  </p>
                  <h4 className="mt-1 text-lg font-semibold" style={{ color: "var(--text)" }}>{row.id}</h4>
                </div>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--border)", background: "var(--muted-bg)", color: "var(--text)" }}>
                  {row.status}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--muted-bg)" }}>
                  <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--muted-text)" }}>Composite Score</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: "var(--text)" }}>{row.score.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--muted-bg)" }}>
                  <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--muted-text)" }}>Priority</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: "var(--text)" }}>{index === 0 ? "Primary" : `#${index + 1}`}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
