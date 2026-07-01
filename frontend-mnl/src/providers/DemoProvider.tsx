"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { isDemoMode } from "@/services/api";

const SCIENTIFIC_EVENTS = [
  { message: "Docking pipeline completed for EGFR-TK", type: "success" },
  { message: "GNINA scoring finished: 244 ligands processed", type: "info" },
  { message: "Quantum reranking updated: QSVM validation at 0.98", type: "success" },
  { message: "Simulation artifacts generated for CAND-912", type: "info" },
  { message: "ADMET screening triage complete for lead series A", type: "success" },
  { message: "OpenMM trajectory stabilization reached", type: "info" },
  { message: "H-bond interaction map updated for PIK3CA", type: "success" },
  { message: "Lead candidate CAND-441 flagged for CNS toxicity", type: "warning" },
];

interface DemoContextType {
  isActive: boolean;
}

const DemoContext = createContext<DemoContextType>({ isActive: false });

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const demo = isDemoMode();
    setIsActive(demo);

    if (demo) {
      const interval = setInterval(() => {
        const event = SCIENTIFIC_EVENTS[Math.floor(Math.random() * SCIENTIFIC_EVENTS.length)];
        
        toast(event.message, {
          description: new Date().toLocaleTimeString(),
          icon: "🔬",
          style: {
            background: "var(--card)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
          },
        });
      }, 15000);

      return () => clearInterval(interval);
    }
  }, []);

  return (
    <DemoContext.Provider value={{ isActive }}>
      <Toaster position="top-right" expand={true} richColors />
      {isActive && (
        <div className="fixed bottom-6 left-6 z-[9999] flex items-center gap-3 rounded-full border border-accent/20 bg-card/80 px-4 py-2 shadow-premium backdrop-blur-xl animate-pulse">
           <div className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
           <span className="text-[10px] font-black uppercase tracking-widest text-accent">Demo Mode Active</span>
        </div>
      )}
      {children}
    </DemoContext.Provider>
  );
}

export const useDemo = () => useContext(DemoContext);
