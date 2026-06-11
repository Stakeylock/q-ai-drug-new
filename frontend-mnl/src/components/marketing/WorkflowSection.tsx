"use client";

import { motion } from "framer-motion";

const steps = [
  {
    title: "Dataset",
    desc: "Curated oncology libraries",
    icon: "DS",
    color: "primary",
  },
  {
    title: "Embeddings",
    desc: "Molecular latent space mapping",
    icon: "EM",
    color: "accent",
  },
  {
    title: "Screening",
    desc: "Rapid ADMET/QED triage",
    icon: "SC",
    color: "primary",
  },
  {
    title: "Docking",
    desc: "Binding pose generation",
    icon: "DK",
    color: "accent",
  },
  {
    title: "GNINA",
    desc: "CNN-based scoring/refinement",
    icon: "GN",
    color: "primary",
  },
  {
    title: "Quantum Ranking",
    desc: "High-fidelity reranking",
    icon: "QR",
    color: "accent",
  },
  {
    title: "Validation",
    desc: "In-silico efficacy proof",
    icon: "VD",
    color: "primary",
  },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="relative py-12">
      <div className="mb-12 text-center">
        <h2 className="font-heading text-4xl font-black tracking-tight text-text">Research Workflow</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-text-secondary">
          Our integrated pipeline orchestrates complex computational stages to 
          isolate the highest-affinity oncology candidates.
        </p>
      </div>

      <div className="relative">
        {/* Connection Line */}
        <div className="absolute left-8 top-1/2 hidden h-1 w-[calc(100%-64px)] -translate-y-1/2 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 lg:block" />
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              <div className="ui-card-surface group flex flex-col items-center p-6 text-center transition-all hover:-translate-y-2 hover:border-primary">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-${step.color}/10 font-black text-${step.color} shadow-inner`}>
                  {step.icon}
                </div>
                <h3 className="mt-4 text-sm font-black uppercase tracking-widest text-text">
                  {step.title}
                </h3>
                <p className="mt-2 text-[10px] font-bold leading-relaxed text-text-secondary">
                  {step.desc}
                </p>
                <div className="mt-4 text-[10px] font-black text-primary/40">
                  STAGE {index + 1}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}