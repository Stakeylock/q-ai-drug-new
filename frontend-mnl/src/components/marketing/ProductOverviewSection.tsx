const pipelineSteps = [
  {
    icon: "01",
    title: "Molecular Generation",
    detail:
      "The platform proposes many new molecule ideas to start the search faster.",
  },
  {
    icon: "02",
    title: "Drug-Likeness Filtering",
    detail:
      "It keeps the molecules that look safer and more practical for real medicine use.",
  },
  {
    icon: "03",
    title: "Docking & Interaction",
    detail:
      "Each molecule is tested virtually to see how well it can fit the target protein.",
  },
  {
    icon: "04",
    title: "Molecular Dynamics Simulation",
    detail:
      "Promising candidates are checked over time to see if interactions stay stable.",
  },
  {
    icon: "05",
    title: "Quantum Validation",
    detail:
      "Final candidates are validated with deeper quantum checks for extra confidence.",
  },
];

export function ProductOverviewSection() {
  return (
    <section className="glass-card rounded-3xl px-6 py-12 md:px-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-heading text-3xl tracking-tight text-text md:text-4xl">
          Product Overview
        </h2>
        <p className="mt-4 max-w-3xl font-body text-base leading-8 text-text-muted">
          Quinfosys<span style={{ verticalAlign: "super", fontSize: "0.65em", lineHeight: 0 }}>™</span> QuDrugForge, Quantum AI for Drug Discovery, guides teams
          from idea to validated candidates in one AI-driven workflow. It is
          designed to be clear enough for non-experts while still useful for
          research professionals.
        </p>

        <div className="mt-9 relative">
          <div className="pointer-events-none absolute left-3 right-3 top-6 hidden h-px bg-gradient-to-r from-transparent via-white/25 to-transparent xl:block" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {pipelineSteps.map((step, index) => (
            <article
              key={step.title}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm transition duration-300 hover:-translate-y-1.5 hover:border-accent/55 hover:shadow-[0_16px_40px_rgba(34,211,238,0.12)]"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-accent/50 bg-accent/10 font-heading text-sm font-semibold tracking-wide text-accent transition duration-300 group-hover:bg-accent/20">
                {step.icon}
              </div>
              <h3 className="font-heading text-lg leading-snug text-text">{step.title}</h3>
              <p className="mt-3 font-body text-sm leading-6 text-text-muted">
                {step.detail}
              </p>

              {index < pipelineSteps.length - 1 && (
                <div className="pointer-events-none absolute -right-2 top-6 hidden h-px w-4 bg-white/30 xl:block" />
              )}

              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100" style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.10), rgba(109,123,255,0.08) 45%, transparent 80%)" }} />
            </article>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}