"use client";

import { motion } from "framer-motion";

const metrics = [
  { label: "Molecules Screened", value: "1.4M+", trend: "+12%" },
  { label: "Experiments Completed", value: "84,200", trend: "+5.2%" },
  { label: "Oncology Targets", value: "126", trend: "+8" },
  { label: "Active AI Models", value: "42", trend: "Optimized" },
  { label: "Docking Simulations", value: "2.1M", trend: "+18%" },
  { label: "Quantum Evaluations", value: "14,500", trend: "High-Fid" },
];

export function MetricsSection() {
  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className="ui-card-surface group flex flex-col items-center justify-center p-6 text-center transition-all hover:border-primary/50"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary/60">
            {metric.label}
          </span>
          <span className="mt-2 text-2xl font-black tracking-tight text-text lg:text-3xl">
            {metric.value}
          </span>
          <div className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {metric.trend}
          </div>
        </motion.div>
      ))}
    </section>
  );
}
