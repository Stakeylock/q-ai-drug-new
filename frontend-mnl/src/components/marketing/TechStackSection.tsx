"use client";

import { motion } from "framer-motion";

const technologies = [
  { name: "RDKit", category: "Cheminformatics" },
  { name: "GNINA", category: "Docking/Scoring" },
  { name: "OpenMM", category: "Molecular Dynamics" },
  { name: "Qiskit", category: "Quantum Computing" },
  { name: "FastAPI", category: "Inference API" },
  { name: "Milvus", category: "Vector Database" },
  { name: "PyTorch", category: "Deep Learning" },
];

export function TechStackSection() {
  return (
    <section className="py-12">
      <div className="mb-12 text-center">
        <h2 className="font-heading text-2xl font-black uppercase tracking-[0.2em] text-text-secondary/50">
          The Research Stack
        </h2>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
        {technologies.map((tech, index) => (
          <motion.div
            key={tech.name}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: index * 0.1 }}
            className="flex flex-col items-center"
          >
            <span className="text-xl font-black tracking-tight text-text/80 grayscale transition-all hover:grayscale-0">
              {tech.name}
            </span>
            <span className="mt-1 text-[8px] font-black uppercase tracking-[0.2em] text-text-secondary/40">
              {tech.category}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
