const plans = [
  {
    name: "Free Tier",
    price: "$0",
    cycle: "/month",
    points: [
      "1 research workspace",
      "Basic molecule generation",
      "Community support",
      "Limited monthly simulations",
    ],
    cta: "Start Free",
  },
  {
    name: "Research Tier",
    price: "$299",
    cycle: "/month",
    points: [
      "Up to 10 researchers",
      "Advanced ADMET and docking",
      "Higher simulation capacity",
      "Experiment analytics dashboard",
    ],
    cta: "Choose Research",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cycle: "pricing",
    points: [
      "Unlimited researchers",
      "Private deployment options",
      "Security and compliance controls",
      "Dedicated scientific success team",
    ],
    cta: "Contact Sales",
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="glass-card rounded-3xl px-6 py-12 md:px-10 md:py-14">
      <h2 className="font-heading text-3xl text-text md:text-4xl">Pricing</h2>
      <p className="mt-4 max-w-3xl font-body text-base leading-8 text-text-muted">
        Flexible plans for individuals, research teams, and enterprise-scale drug
        discovery programs.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`relative rounded-2xl border p-6 transition duration-300 hover:-translate-y-1 ${
              plan.featured
                ? "scale-[1.02] border-accent/80 bg-accent/[0.11] shadow-[0_18px_44px_rgba(34,211,238,0.15)]"
                : "border-white/10 bg-white/[0.03] hover:border-primary/50 hover:shadow-[0_14px_36px_rgba(109,123,255,0.12)]"
            }`}
          >
            {plan.featured && (
              <p className="mb-3 inline-flex rounded-full border border-accent/70 bg-accent/15 px-3 py-1 font-body text-xs uppercase tracking-[0.14em] text-accent">
                Recommended
              </p>
            )}
            <h3 className="font-heading text-xl text-text">{plan.name}</h3>
            <p className="mt-4 font-heading text-3xl text-accent">
              {plan.price}
              <span className="ml-1 font-body text-base text-text-muted">{plan.cycle}</span>
            </p>
            <ul className="mt-5 space-y-2">
              {plan.points.map((point) => (
                <li key={point} className="flex items-start gap-2 font-body text-sm text-text-muted">
                  <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-accent/50 bg-accent/10 text-[10px] text-accent">
                    +
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <button
              className={`mt-7 w-full rounded-xl px-4 py-3 font-body text-sm font-semibold transition ${
                plan.featured
                  ? "btn-primary-glow"
                  : "btn-ghost-fill border border-white/20 text-text"
              }`}
            >
              {plan.cta}
            </button>

            <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition duration-300" style={{ background: plan.featured ? "linear-gradient(150deg, rgba(34,211,238,0.10), rgba(109,123,255,0.08) 45%, transparent)" : "transparent" }} />
          </article>
        ))}
      </div>
    </section>
  );
}