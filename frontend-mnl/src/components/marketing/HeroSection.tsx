"use client";

import { motion } from "framer-motion";
import Link from "next/link";


export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden rounded-[2.5rem] bg-card/40 px-6 py-16 shadow-premium backdrop-blur-md border border-border/50 md:px-12 md:py-24 lg:px-16">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />

      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col items-start space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-primary"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>
            Quantum-Enhanced Molecular Intelligence
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-heading text-5xl font-black leading-[1.1] tracking-tight text-text sm:text-6xl xl:text-7xl"
          >
            AI-Driven <span className="text-primary">Oncology</span> Drug Discovery Platform
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-xl text-lg font-medium leading-relaxed text-text-secondary"
          >
            Accelerate therapeutic breakthroughs with quantum-assisted screening, 
            docking pipelines, and explainable AI. From molecular ideation to 
            validated candidates in record time.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col gap-4 sm:flex-row"
          >
            <Link
              href="/login"
              className="btn-primary-glow flex h-14 items-center justify-center rounded-2xl px-10 text-sm font-bold uppercase tracking-widest shadow-xl shadow-primary/25 transition-all hover:scale-105 active:scale-95"
            >
              Launch Workspace
            </Link>
            <Link
              href="#workflow"
              className="flex h-14 items-center justify-center rounded-2xl border-2 border-border bg-card/50 px-10 text-sm font-bold uppercase tracking-widest text-text transition-all hover:bg-surface-subtle hover:border-primary/30 active:scale-95"
            >
              View Research Pipeline
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="flex flex-wrap gap-x-8 gap-y-4 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary/50"
          >
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary" />
              GNINA Integrated
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary" />
              ADMET Prediction
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary" />
              Quantum Reranking
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative lg:ml-auto"
        >
          <div className="ui-card-surface relative aspect-square w-full max-w-[540px] overflow-hidden p-8 shadow-2xl transition-transform duration-500 hover:rotate-1">
            <div className="absolute inset-0 bg-grid-noise opacity-20" />
            
            {/* Mock Dashboard Element */}
            <div className="relative flex h-full flex-col space-y-6">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-error" />
                  <div className="h-3 w-3 rounded-full bg-warning" />
                  <div className="h-3 w-3 rounded-full bg-success" />
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">
                  ACTIVE_SIMULATION_084
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-surface-subtle/50 p-4 border border-border/30">
                  <p className="text-[10px] font-bold text-text-secondary uppercase">Binding Energy</p>
                  <p className="mt-1 text-2xl font-black text-primary">-12.4 kcal/mol</p>
                </div>
                <div className="rounded-2xl bg-surface-subtle/50 p-4 border border-border/30">
                  <p className="text-[10px] font-bold text-text-secondary uppercase">QED Score</p>
                  <p className="mt-1 text-2xl font-black text-accent">0.942</p>
                </div>
              </div>

              <div className="flex-1 rounded-2xl bg-surface-subtle/30 border border-border/30 p-4 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <svg className="w-full h-full p-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div className="relative space-y-3">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="flex items-center justify-between gap-4">
                       <div className="h-2 w-full rounded-full bg-border/30">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${30 + i * 20}%` }}
                           transition={{ duration: 1.5, delay: 1 }}
                           className="h-full rounded-full bg-primary/40" 
                         />
                       </div>
                       <span className="text-[10px] font-bold text-text-secondary">0.{i}4</span>
                     </div>
                   ))}
                </div>
              </div>

              <div className="text-[10px] font-bold text-text-secondary/60 text-center uppercase tracking-widest">
                Real-time quantum validation in progress
              </div>
            </div>
            
            <div className="absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}