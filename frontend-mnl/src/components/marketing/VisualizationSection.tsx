"use client";

import { motion } from "framer-motion";

export function VisualizationSection() {
  return (
    <section className="py-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="ui-card-surface relative aspect-video overflow-hidden p-8 shadow-premium"
        >
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-text">Binding Pose Analysis</h3>
            <div className="flex gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <div className="h-2 w-2 rounded-full bg-accent" />
            </div>
          </div>
          <div className="relative mt-8 flex flex-1 items-center justify-center">
            {/* Mock Visualization */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
               <svg className="w-full h-full" viewBox="0 0 100 100">
                 <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="0.5" fill="none" strokeDasharray="2 2" />
                 <path d="M30 30 L70 70 M70 30 L30 70" stroke="currentColor" strokeWidth="0.5" />
               </svg>
            </div>
            <div className="relative grid grid-cols-3 gap-8">
               {[1, 2, 3].map(i => (
                 <motion.div 
                   key={i}
                   animate={{ y: [0, -10, 0] }}
                   transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                   className="h-20 w-20 rounded-3xl bg-primary/10 border border-primary/20 backdrop-blur-md"
                 />
               ))}
            </div>
          </div>
          <div className="mt-8 flex justify-center gap-12">
             <div className="text-center">
               <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Affinity</p>
               <p className="mt-1 text-xl font-black text-primary">-9.2</p>
             </div>
             <div className="text-center">
               <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">RMSD</p>
               <p className="mt-1 text-xl font-black text-accent">1.2Å</p>
             </div>
          </div>
        </motion.div>

        <div className="flex flex-col justify-center space-y-6">
          <h2 className="font-heading text-4xl font-black tracking-tight text-text">Scientific Visualization</h2>
          <p className="text-lg font-medium text-text-secondary">
            Deep insights through multi-dimensional visualization of molecular dynamics, 
            docking interactions, and quantum-mechanical properties.
          </p>
          <ul className="space-y-4">
            {[
              "Real-time pose refinement with GNINA",
              "Dynamic ADMET property mapping",
              "Quantum electron density surfaces",
              "Embedding space trajectory analysis"
            ].map(item => (
              <li key={item} className="flex items-center gap-3 font-bold text-text/80">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
