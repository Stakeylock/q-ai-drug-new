import type { Metadata } from "next";

import { FooterSection } from "@/components/marketing/FooterSection";
import { PricingExperience } from "@/components/pricing/PricingExperience";

export const metadata: Metadata = {
  title: "Pricing | QuDrugForge",
  description:
    "Flexible QuDrugForge plans for individual researchers, discovery teams, and enterprise drug discovery programs.",
};

const assurances = [
  "No setup fee on self-service plans",
  "Cancel or change plans at any time",
  "Secure team workspaces included",
  "Enterprise deployment options available",
];

export default function PricingPage() {
  return (
    <main className="aurora-bg relative overflow-hidden text-text">
      <div className="bg-grid-noise pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-24 lg:px-16">
        <section className="text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-primary">
            Built for every stage of discovery
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl font-heading text-5xl font-black leading-tight tracking-tight text-text md:text-6xl">
            Serious research tools, priced for real teams.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-8 text-text-secondary">
            Begin with a free workspace, add capacity as your pipeline grows, and move to a private deployment when governance requires it.
          </p>
        </section>

        <section className="mt-14">
          <PricingExperience />
        </section>

        <section className="mt-16 grid gap-3 rounded-3xl border border-border/70 bg-card/70 p-6 shadow-soft backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
          {assurances.map((assurance) => (
            <div key={assurance} className="flex items-center gap-3 rounded-2xl bg-surface-subtle/70 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-sm font-black text-success">
                ✓
              </span>
              <p className="text-sm font-bold leading-5 text-text">{assurance}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 overflow-hidden rounded-[2.5rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card/80 to-accent/10 px-6 py-12 text-center shadow-premium md:px-12">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Need a tailored plan?</p>
          <h2 className="mt-4 font-heading text-3xl font-black tracking-tight text-text md:text-4xl">
            Let’s map pricing to your research program.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-text-secondary">
            We can align compute, storage, security, and deployment requirements with your team’s actual workload.
          </p>
          <a
            href="/signup?plan=enterprise"
            className="btn-primary-glow mt-8 inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-black"
          >
            Talk to our team
          </a>
        </section>
      </div>

      <FooterSection />
    </main>
  );
}
