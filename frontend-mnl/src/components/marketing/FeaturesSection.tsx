"use client";

import { motion } from "framer-motion";

const features = [
  {
    title: "3D Molecular Viewer",
    text: "High-fidelity visualization of molecular poses and protein-ligand interactions.",
    icon: "VW",
  },
  {
    title: "Similarity Search",
    text: "Vector-based embedding search across 1.4B+ compounds in milliseconds.",
    icon: "SS",
  },
  {
    title: "Candidate Ranking",
    text: "Multi-parameter optimization using advanced scoring functions and GNINA.",
    icon: "CR",
  },
  {
    title: "Experiment Tracking",
    text: "Orchestrate complex discovery pipelines with full reproducibility and logs.",
    icon: "ET",
  },
  {
    title: "Quantum Scoring",
    text: "Quantum-assisted reranking to identify high-affinity binding candidates.",
    icon: "QS",
  },
  {
    title: "AI Research Copilot",
    text: "Natural language interface for deep interrogation of research data.",
    icon: "CP",
  },
  {
    title: "Simulation Monitoring",
    text: "Real-time visibility into molecular dynamics and binding simulations.",
    icon: "SM",
  },
  {
    title: "Explainable Predictions",
    text: "Interpret model outputs with attribution maps for ADMET and activity.",
    icon: "XP",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-12">
      <div className="mb-12">
        <h2 className="font-heading text-4xl font-black tracking-tight text-text">Platform Core Capabilities</h2>
        <p className="mt-4 max-w-2xl text-lg font-medium text-text-secondary">
          An end-to-end stack designed for the rigorous demands of modern computational oncology.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => (
          <motion.article
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.05 }}
            className="ui-card-surface group p-8 transition-all hover:border-primary/50 hover:shadow-premium"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 font-black text-primary transition-all group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
              {feature.icon}
            </div>
            <h3 className="mt-6 text-lg font-black tracking-tight text-text">
              {feature.title}
            </h3>
            <p className="mt-3 text-sm font-medium leading-relaxed text-text-secondary">
              {feature.text}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}