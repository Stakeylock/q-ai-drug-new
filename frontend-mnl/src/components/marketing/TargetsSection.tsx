"use client";

import { motion } from "framer-motion";

const targets = [
  {
    name: "EGFR",
    fullName: "Epidermal Growth Factor Receptor",
    type: "Kinase",
    description: "Commonly mutated in non-small cell lung cancer.",
    activeCandidates: 12,
  },
  {
    name: "PARP1",
    fullName: "Poly [ADP-ribose] polymerase 1",
    type: "DNA Repair",
    description: "Key target for synthetic lethality in BRCA-mutant cancers.",
    activeCandidates: 8,
  },
  {
    name: "PIK3CA",
    fullName: "Phosphatidylinositol-4,5-Bisphosphate 3-Kinase",
    type: "Lipid Kinase",
    description: "One of the most frequently mutated genes in breast cancer.",
    activeCandidates: 15,
  },
];

export function TargetsSection() {
  return (
    <section className="py-12">
      <div className="mb-12">
        <h2 className="font-heading text-4xl font-black tracking-tight text-text">Oncology Targets</h2>
        <p className="mt-4 max-w-2xl text-lg font-medium text-text-secondary">
          Active research pipelines focused on high-impact validated oncology targets.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {targets.map((target, index) => (
          <motion.div
            key={target.name}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="ui-card-surface group relative overflow-hidden p-8 transition-all hover:border-primary/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl font-black text-primary">{target.name}</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">
                {target.type}
              </span>
            </div>
            <h3 className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-text-secondary/60">
              {target.fullName}
            </h3>
            <p className="mt-4 text-sm font-medium leading-relaxed text-text-secondary">
              {target.description}
            </p>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-6 w-6 rounded-full border-2 border-card bg-surface-subtle" />
                ))}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                {target.activeCandidates} Active Candidates
              </span>
            </div>
            
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/10" />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
