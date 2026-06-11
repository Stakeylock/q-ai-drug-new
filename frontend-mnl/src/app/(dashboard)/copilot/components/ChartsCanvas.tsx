const BARS = [68, 82, 57, 91, 74, 63];

export default function ChartsCanvas() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4">
      <section className="rounded-2xl border p-5" style={{ borderColor: "var(--accent-border)", background: "var(--card)" }}>
        <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Charts</p>
        <h3 className="mt-2 text-xl font-semibold" style={{ color: "var(--text)" }}>Compound Distribution Insights</h3>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-text)" }}>
          Snapshot of potency and selectivity trends from current copilot context.
        </p>
      </section>

      <section className="grid min-h-0 gap-4 md:grid-cols-2">
        <article className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "var(--muted-text)" }}>Potency Histogram</p>
          <div className="mt-4 flex h-48 items-end gap-2">
            {BARS.map((height, idx) => (
              <div key={idx} className="flex-1 rounded-t-md bg-gradient-to-t from-cyan-500/70 to-cyan-200/90" style={{ height: `${height}%` }} />
            ))}
          </div>
        </article>

        <article className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "var(--muted-text)" }}>Selectivity Trend</p>
          <div className="mt-5 h-48 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--muted-bg)" }}>
            <div className="flex h-full items-end gap-2">
              {[22, 35, 31, 44, 52, 48, 61].map((point, idx) => (
                <div key={idx} className="relative flex-1">
                  <div
                    className="absolute bottom-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-teal-300"
                    style={{ height: `${point}%` }}
                  />
                  <div
                    className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-teal-100 bg-teal-300"
                    style={{ bottom: `calc(${point}% - 5px)` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
