"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useCopilotChatStore, useWorkspaceStore } from "@/store";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

type LLMContext =
  | "overview"
  | "molecule-analysis"
  | "similarity-search"
  | "experiment-planning"
  | "risk-review";

const SUGGESTED_PROMPTS = [
  "Explain top candidate ranking",
  "Summarize docking results",
  "Identify ADMET risks",
  "Suggest molecule modifications",
  "Generate next workflow",
  "Compare candidates",
  "Summarize literature evidence",
  "Prepare validation plan",
];

const ACTION_CARDS = [
  { id: "analyze", title: "Analyze Candidate", description: "Deep structural and property analysis", icon: "🔬" },
  { id: "explain", title: "Explain Docking Pose", description: "Detailed binding interaction breakdown", icon: "🧬" },
  { id: "workflow", title: "Generate Workflow", description: "AI-driven next steps for your research", icon: "⚡" },
  { id: "admet", title: "Summarize ADMET Risks", description: "Safety and toxicology triage report", icon: "🛡️" },
  { id: "compare", title: "Compare Molecules", description: "Multi-property lead optimization", icon: "📊" },
  { id: "dossier", title: "Draft Candidate Dossier", description: "Generate scientific evidence package", icon: "📝" },
];

const RECENT_SUMMARIES = [
  { title: "EGFR target rationale", date: "2 hours ago" },
  { title: "QDF-EGFR-001 candidate explanation", date: "4 hours ago" },
  { title: "ADMET risk summary", date: "Yesterday" },
  { title: "Docking interaction interpretation", date: "Yesterday" },
];

export default function PharmaLLMPage() {
  const [input, setInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [selectedContext, setSelectedContext] = useState<LLMContext>("overview");
  const historyRef = useRef<HTMLDivElement>(null);
  
  const messages = useCopilotChatStore((state) => state.messages);
  const appendMessage = useCopilotChatStore((state) => state.appendMessage);
  
  const lastExperimentId = useWorkspaceStore((state) => state.lastExperimentId);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, isAiThinking]);

  const handlePromptClick = (prompt: string) => {
    handleUserMessage(prompt);
  };

  const handleUserMessage = async (content: string) => {
    if (!content.trim()) return;
    
    appendMessage({ role: "user", content });
    setInput("");
    setIsAiThinking(true);

    // Simulated scientific processing
    setTimeout(() => {
      const response = getMockScientificResponse(content);
      appendMessage({ role: "assistant", content: response });
      setIsAiThinking(false);
    }, 1500);
  };

  const getMockScientificResponse = (query: string): string => {
    const q = query.toLowerCase();
    
    if (q.includes("egfr-001") || q.includes("highest") || q.includes("ranking")) {
      return `### Candidate Analysis: QDF-EGFR-001
      
QDF-EGFR-001 is currently ranked as the top lead candidate for the **EGFR NSCLC** program based on a multi-objective optimization (MOO) assessment:

1.  **Docking Score**: **-11.2 kcal/mol** (AutoDock Vina), significantly outperforming the co-crystallized ligand (-8.4 kcal/mol).
2.  **GNINA Pose Confidence**: **0.94 CNN score**. High-fidelity binding interaction with the Met793 hinge residue and the hydrophobic pocket.
3.  **ADMET Risk**: **Low liability**. Predicted high Caco-2 permeability and no significant hERG inhibition risk (pIC50 < 5.0).
4.  **Quantum Reranking**: QSVM validation confirms strong electronic complementarity with the active site, specifically within the L858R mutant conformation.
5.  **Novelty**: The scaffold exhibits a **0.24 Tanimoto similarity** to known inhibitors, indicating high novelty and potential for new IP.
6.  **Applicability Domain**: Well within the chemical space of successful tyrosine kinase inhibitors (TKI).

**Next Recommended Experiment**:
Conduct **Molecular Dynamics (MD) simulations** (100ns) to evaluate complex stability and residence time before moving to *in-vitro* kinase assays.`;
    }
    
    if (q.includes("admet")) {
      return `### ADMET Triage Report
      
Analysis of absorption, distribution, metabolism, excretion, and toxicity for current candidate pool:

| ID | Lipophilicity (LogP) | Solubility (LogS) | hERG Risk | Triage |
|:---|:---:|:---:|:---:|:---|
| QDF-EGFR-001 | 3.12 | Moderate | Low | **Pass** |
| QDF-EGFR-005 | 5.10 | Low | High | **Reject** |

**Insight:** Candidates in the sulfonamide series show elevated hERG liability. Suggesting R-group modification to reduce pKa.`;
    }
    
    if (q.includes("docking")) {
      return `### Docking Results Summary
      
Identification of high-affinity inhibitors for the **EGFR-TK** domain. Top candidates identified via GNINA docking:

*   **QDF-EGFR-001**: Docking Score: **-11.2 kcal/mol**. Strong interaction with Met793.
*   **QDF-EGFR-002**: Docking Score: **-10.4 kcal/mol**. Predicted high selectivity over HER2.

**Recommendations:** Proceed to MD simulation for QDF-EGFR-001 to verify complex stability.`;
    }

    if (q.includes("literature") || q.includes("evidence")) {
      return `### Scientific Literature Summary: EGFR Inhibitors
      
Review of current therapeutic landscape and empirical evidence for the **EGFR L858R** mutation:

1.  **Resistance Mechanisms**: T790M remains the primary resistance driver. Recent literature (Nature 2023) suggests that 4th-gen TKIs must maintain high selectivity over WT-EGFR to minimize skin/GI toxicity.
2.  **Binding Motif**: Key evidence supports the importance of the **Cys797** covalent linkage for sustained inhibition in 3rd-gen resistant models.
3.  **Clinical Correlation**: Analysis of 14 Recent Phase II trials indicates that high brain penetration is critical for NSCLC patients with CNS metastasis.
4.  **Target Rationale**: P00533 (EGFR) is highly validated with substantial structural evidence (PDB: 8A1A, 7L1X) available for QSAR alignment.

**Evidence Conclusion:** The current project scaffold (QDF-series) aligns with the requirement for non-covalent, mutant-selective inhibition patterns identified in recent high-impact oncology journals.`;
    }

    if (q.includes("workflow") || q.includes("next step")) {
      return `### Recommended Research Workflow
      
Based on the current project stage (**Docking & Quantum**), I recommend the following computational sequence:

1.  **MD Stability Pass**: Run 250ns Molecular Dynamics on the top 3 candidates (QDF-001, 002, 003) to evaluate binding pose stability.
2.  **Free Energy Perturbation (FEP)**: Calculate relative binding free energies to refine pIC50 predictions within ±1.0 kcal/mol accuracy.
3.  **ADMET Profiling**: Execute the **ADMET-ToxNet v3** pipeline specifically for metabolic stability and CYP3A4 inhibition risks.
4.  **Validation Plan**: Select the top candidate for *in-vitro* kinase assay validation (ADP-Glo).

**AI Reasoning:** Transitioning from static docking to dynamic simulation will significantly reduce the false-positive rate before laboratory synthesis.`;
    }

    return "I am analyzing your request with scientific context. Please specify an oncology target (e.g., EGFR) or a specific research task (e.g., Explain ranking) for a detailed technical briefing.";
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleUserMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleUserMessage(input);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full min-h-0">
      <PageHeader 
        title="Pharma LLM"
        breadcrumb="AI / Research Intelligence"
        description="Scientific AI assistant for computational drug discovery and oncology research workflows."
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status="active" label="System Ready" />
            <div className="h-8 w-px bg-border/40" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-text">Model: Bio-GPT-Q4</span>
          </div>
        }
      />

      {/* Active Research Context Bar */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
             <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-accent/70">Project Context</span>
                <span className="text-sm font-bold text-text">EGFR NSCLC Discovery Program</span>
             </div>
             <div className="h-8 w-px bg-border/20" />
             <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Selected Target</span>
                <span className="text-sm font-bold text-text">EGFR / P00533</span>
             </div>
             <div className="h-8 w-px bg-border/20" />
             <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Candidate</span>
                <span className="text-sm font-bold text-text">QDF-EGFR-001</span>
             </div>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase tracking-widest font-black">
            Update Context
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-6 min-h-0 flex-1">
        {/* Left Panel: Scientific Context & Recent */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          <Card className="shrink-0" header={<h3 className="text-xs font-black uppercase tracking-widest">Scientific Context</h3>}>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-text/60 mb-1">Current Stage</p>
                <StatusBadge status="running" label="Docking & Quantum" size="sm" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-text/60 mb-2">Available Data Assets</p>
                <div className="flex flex-wrap gap-1.5">
                  {["docking results", "GNINA poses", "ADMET table", "quantum descriptors", "similarity analysis"].map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded bg-surface-subtle/50 border border-border/40 text-[9px] font-bold text-muted-text uppercase">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="flex-1" header={<h3 className="text-xs font-black uppercase tracking-widest">Recent AI Summaries</h3>}>
            <div className="space-y-3">
              {RECENT_SUMMARIES.map((item, idx) => (
                <div key={idx} className="group cursor-pointer rounded-lg border border-border/30 p-3 hover:border-accent/40 hover:bg-accent/5 transition-all">
                  <p className="text-xs font-bold text-text group-hover:text-accent transition-colors">{item.title}</p>
                  <p className="text-[9px] font-medium text-muted-text/60 mt-1 uppercase tracking-widest">{item.date}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Center Panel: Chat Workspace */}
        <Card className="flex flex-col overflow-hidden border-accent/20 shadow-lg shadow-accent/5" contentClassName="flex flex-col p-0 h-full">
          {/* Chat Messages */}
          <div ref={historyRef} className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[400px]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-3xl bg-accent/10 flex items-center justify-center text-3xl mb-4">🤖</div>
                <h3 className="text-lg font-black text-text">Welcome to Pharma LLM</h3>
                <p className="text-sm text-muted-text/70 max-w-sm mt-2">
                  Your scientific copilot for oncology research. Ask me about candidate rankings, docking interpretation, or ADMET risks.
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((m, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`max-w-[90%] rounded-2xl p-4 shadow-sm ${
                      m.role === "assistant" 
                        ? "border border-border/40 bg-surface-subtle/30" 
                        : "bg-accent text-bg"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${m.role === "assistant" ? "text-accent" : "text-bg/60"}`}>
                          {m.role === "assistant" ? "Pharma Intelligence" : "Research Lead"}
                        </span>
                      </div>
                      <div className={`prose prose-sm max-w-none ${m.role === "assistant" ? "text-text" : "text-bg"}`}>
                        <ReactMarkdown 
                          components={{
                            table: ({node, ...props}) => <table className="border-collapse border border-border/40 w-full my-2" {...props} />,
                            th: ({node, ...props}) => <th className="border border-border/40 bg-surface-subtle/50 p-2 text-[10px] font-black uppercase tracking-widest" {...props} />,
                            td: ({node, ...props}) => <td className="border border-border/40 p-2 text-xs" {...props} />,
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-sm font-black uppercase tracking-widest text-accent mb-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                            code: ({node, ...props}) => <code className="font-mono text-xs bg-surface-subtle px-1 rounded" {...props} />,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isAiThinking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="rounded-2xl border border-border/40 bg-surface-subtle/30 p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
                        <div className="flex h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:0.2s]" />
                        <div className="flex h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:0.4s]" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-accent ml-2">Processing Molecular Data...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Suggested Prompts */}
          <div className="px-6 py-3 border-t border-border/10 bg-surface-subtle/5">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptClick(prompt)}
                  className="shrink-0 rounded-full border border-border/40 bg-card px-3 py-1 text-[10px] font-bold text-muted-text hover:border-accent hover:text-accent transition-all whitespace-nowrap"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSubmit} className="p-6 pt-2 border-t border-border/30 bg-card">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Query lead prioritization, docking interpretations, or risk assessments..."
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-border/60 bg-surface-subtle/20 px-5 py-4 text-sm font-medium focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <select 
                    value={selectedContext}
                    onChange={(e) => setSelectedContext(e.target.value as LLMContext)}
                    className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest text-muted-text/60 focus:ring-0 cursor-pointer"
                  >
                    <option value="overview">Overview</option>
                    <option value="molecule-analysis">Structural</option>
                    <option value="similarity-search">SAR</option>
                    <option value="risk-review">Risk</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0 rounded-xl border-border/60"
                  title="Attach Context"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                </Button>
                <Button
                  type="submit"
                  disabled={isAiThinking || !input.trim()}
                  className="h-10 w-10 p-0 rounded-xl bg-accent text-bg hover:bg-accent/90 shadow-lg shadow-accent/20"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                </Button>
              </div>
            </div>
            <p className="mt-3 text-[10px] font-bold text-muted-text/30 uppercase tracking-widest text-center">
              Scientific AI outputs should be validated via computational workflows.
            </p>
          </form>
        </Card>

        {/* Right Panel: AI Action Cards & Notice */}
        <div className="flex flex-col gap-6 overflow-y-auto pl-2 custom-scrollbar">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60">Molecular Intelligence Actions</h3>
            <div className="grid grid-cols-1 gap-3">
              {ACTION_CARDS.map((action) => (
                <div 
                  key={action.id} 
                  className="group flex items-start gap-4 rounded-2xl border border-border/50 bg-card/50 p-4 hover:border-accent/40 hover:bg-accent/5 transition-all cursor-pointer shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-xl group-hover:scale-110 transition-transform">
                    {action.icon}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-text group-hover:text-accent transition-colors">{action.title}</h4>
                    <p className="text-[10px] font-medium text-muted-text/70 mt-1 leading-relaxed">{action.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-6">
            <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-3 w-3 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest text-warning">Safety / Evidence Notice</span>
              </div>
              <p className="text-[10px] font-medium text-muted-text/80 leading-relaxed italic">
                AI outputs are research assistance only and should be validated through computational and wet-lab workflows. 
                References are provided where available for empirical verification.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--accent-border);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
