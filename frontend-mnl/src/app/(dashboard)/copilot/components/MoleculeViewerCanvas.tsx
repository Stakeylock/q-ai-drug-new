export default function MoleculeViewerCanvas() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4">
      <section className="rounded-2xl border p-5" style={{ borderColor: "var(--accent-border)", background: "var(--card)" }}>
        <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Molecule Viewer</p>
        <h3 className="mt-2 text-xl font-semibold" style={{ color: "var(--text)" }}>QN-473 Lead Scaffold</h3>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-text)" }}>
          Interactive molecular summary for physicochemical and screening metrics.
        </p>
      </section>

      <section className="grid min-h-0 gap-4 md:grid-cols-[1.1fr_1fr]">
        <article className="flex min-h-[260px] items-center justify-center rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="relative h-56 w-56 rounded-full border" style={{ borderColor: "var(--accent-border)", background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}>
            <div className="absolute left-1/2 top-3 h-7 w-7 -translate-x-1/2 rounded-full border border-cyan-200/80 bg-cyan-300/20" />
            <div className="absolute bottom-4 left-5 h-6 w-6 rounded-full border border-cyan-200/80 bg-cyan-300/20" />
            <div className="absolute bottom-4 right-5 h-6 w-6 rounded-full border border-cyan-200/80 bg-cyan-300/20" />
            <div className="absolute left-8 top-20 h-6 w-6 rounded-full border border-cyan-200/80 bg-cyan-300/20" />
            <div className="absolute right-8 top-20 h-6 w-6 rounded-full border border-cyan-200/80 bg-cyan-300/20" />
          </div>
        </article>

        <article className="grid gap-3 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          {[
            ["Potency", "8.9 pIC50"],
            ["Selectivity", "34x"],
            ["LogP", "2.3"],
            ["TPSA", "69 A^2"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--muted-bg)" }}>
              <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "var(--muted-text)" }}>{label}</p>
              <p className="mt-1 text-lg font-semibold" style={{ color: "var(--text)" }}>{value}</p>
            </div>
          ))}
        </article>
      </section>
    </div>
  );
}
