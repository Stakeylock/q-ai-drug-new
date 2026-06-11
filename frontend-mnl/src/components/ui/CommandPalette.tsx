"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/utils/toast";
import { ModalEntrance } from "./SafeMotion";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Project" | "Actions" | "AI";
  shortcut?: string[];
  action: () => void;
  icon?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close when Esc is clicked, or close when clicking backdrop
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      // Let the modal focus the search bar
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const commands: CommandItem[] = useMemo(() => [
    // === NAVIGATION ===
    {
      id: "nav-dash",
      title: "Go to Dashboard",
      category: "Navigation",
      shortcut: ["G", "D"],
      icon: "📊",
      action: () => { router.push("/dashboard"); onClose(); }
    },
    {
      id: "nav-proj",
      title: "Go to Research Projects",
      category: "Navigation",
      shortcut: ["G", "P"],
      icon: "📁",
      action: () => { router.push("/research-projects"); onClose(); }
    },
    {
      id: "nav-exp",
      title: "Go to Experiments",
      category: "Navigation",
      shortcut: ["G", "E"],
      icon: "🧪",
      action: () => { router.push("/dashboard/history"); onClose(); }
    },
    {
      id: "nav-rep",
      title: "Go to Reports",
      category: "Navigation",
      shortcut: ["G", "R"],
      icon: "📄",
      action: () => { router.push("/results"); onClose(); }
    },
    {
      id: "nav-targ",
      title: "Go to Targets Page",
      category: "Navigation",
      icon: "🎯",
      action: () => { router.push("/targets"); onClose(); }
    },
    {
      id: "nav-mol",
      title: "Go to Molecules Workspace",
      category: "Navigation",
      icon: "⚛️",
      action: () => { router.push("/molecules"); onClose(); }
    },
    {
      id: "nav-dock",
      title: "Go to Docking Platform",
      category: "Navigation",
      icon: "🕸️",
      action: () => { router.push("/docking"); onClose(); }
    },
    {
      id: "nav-gnina",
      title: "Go to GNINA Docking Engine",
      category: "Navigation",
      icon: "🧠",
      action: () => { router.push("/docking?engine=gnina"); onClose(); }
    },
    {
      id: "nav-quant",
      title: "Go to Quantum Reranking",
      category: "Navigation",
      icon: "🪐",
      action: () => { router.push("/quantum"); onClose(); }
    },
    {
      id: "nav-sim",
      title: "Go to Simulations Workspace",
      category: "Navigation",
      icon: "📈",
      action: () => { router.push("/simulation"); onClose(); }
    },
    {
      id: "nav-admet",
      title: "Go to ADMET Validation",
      category: "Navigation",
      icon: "🛡️",
      action: () => { router.push("/validation?panel=admet"); onClose(); }
    },
    {
      id: "nav-3d",
      title: "Go to 3D Molecule Viewer",
      category: "Navigation",
      icon: "📦",
      action: () => { router.push("/visualization"); onClose(); }
    },
    {
      id: "nav-space",
      title: "Go to Chemical Space embedding",
      category: "Navigation",
      icon: "🌿",
      action: () => { router.push("/chemical-space"); onClose(); }
    },
    {
      id: "nav-simil",
      title: "Go to Similarity searcher",
      category: "Navigation",
      icon: "🔗",
      action: () => { router.push("/similarity"); onClose(); }
    },
    {
      id: "nav-llm",
      title: "Go to Pharma LLM Assistant",
      category: "Navigation",
      shortcut: ["A", "I"],
      icon: "✨",
      action: () => { router.push("/copilot"); onClose(); }
    },
    {
      id: "nav-mods",
      title: "Go to AI Model Registry",
      category: "Navigation",
      icon: "🧩",
      action: () => { router.push("/models"); onClose(); }
    },
    {
      id: "nav-comp",
      title: "Go to Compute Settings",
      category: "Navigation",
      icon: "☁️",
      action: () => { router.push("/settings?section=compute"); onClose(); }
    },
    {
      id: "nav-stor",
      title: "Go to Storage Quotas",
      category: "Navigation",
      icon: "💾",
      action: () => { router.push("/settings?section=storage"); onClose(); }
    },
    {
      id: "nav-api",
      title: "Go to API Playground",
      category: "Navigation",
      icon: "💻",
      action: () => { router.push("/settings?section=api"); onClose(); }
    },
    {
      id: "nav-integ",
      title: "Go to Integrations Control",
      category: "Navigation",
      icon: "🔌",
      action: () => { router.push("/settings?section=integrations"); onClose(); }
    },
    {
      id: "nav-team",
      title: "Go to Team Management",
      category: "Navigation",
      icon: "👥",
      action: () => { router.push("/settings?section=team"); onClose(); }
    },
    {
      id: "nav-bill",
      title: "Go to Billing Portal",
      category: "Navigation",
      icon: "💳",
      action: () => { router.push("/settings?section=billing"); onClose(); }
    },
    {
      id: "nav-audit",
      title: "Go to Audit Log settings",
      category: "Navigation",
      icon: "📜",
      action: () => { router.push("/settings?section=audit"); onClose(); }
    },
    {
      id: "nav-sett",
      title: "Go to General Settings",
      category: "Navigation",
      shortcut: ["S", "E"],
      icon: "⚙️",
      action: () => { router.push("/settings"); onClose(); }
    },

    // === PROJECTS ===
    {
      id: "proj-egfr",
      title: "Switch to EGFR NSCLC Discovery Program",
      category: "Project",
      icon: "🧬",
      action: () => {
        showToast({
          title: "WORKSPACE ACTIVATED",
          message: "Switched research context to EGFR NSCLC Discovery Program.",
          type: "success",
        });
        onClose();
      }
    },
    {
      id: "proj-parp",
      title: "Switch to PARP1 Oncology Program",
      category: "Project",
      icon: "🧬",
      action: () => {
        showToast({
          title: "WORKSPACE ACTIVATED",
          message: "Switched research context to PARP1 Oncology Program.",
          type: "success",
        });
        onClose();
      }
    },
    {
      id: "proj-work",
      title: "Open Current Project Workspace",
      category: "Project",
      icon: "🏢",
      action: () => { router.push("/research-projects"); onClose(); }
    },
    {
      id: "proj-up",
      title: "Upload Input Data to Project",
      category: "Project",
      shortcut: ["U", "P"],
      icon: "📤",
      action: () => {
        showToast({
          title: "INTAKE PORTAL",
          message: "Initializing intake portal for molecular FASTA/SDF upload...",
          type: "info",
        });
        onClose();
      }
    },

    // === ACTIONS ===
    {
      id: "act-run",
      title: "Run Computational Pipeline",
      category: "Actions",
      shortcut: ["R", "P"],
      icon: "🚀",
      action: () => {
        showToast({
          title: "PIPELINE STARTED",
          message: "Quantum rescoring pipeline initialized for active target.",
          type: "success",
        });
        onClose();
      }
    },
    {
      id: "act-dock",
      title: "Start Virtual Binding Docking",
      category: "Actions",
      icon: "🧬",
      action: () => {
        showToast({
          title: "DOCKING QUEUED",
          message: "Ligand docking batch queued on Autopilot engine.",
          type: "info",
        });
        onClose();
      }
    },
    {
      id: "act-doss",
      title: "Generate Candidate Dossier",
      category: "Actions",
      shortcut: ["C", "D"],
      icon: "📑",
      action: () => {
        showToast({
          title: "DOSSIER GENERATED",
          message: "Candidate validation dossier successfully compiled.",
          type: "success",
        });
        onClose();
      }
    },
    {
      id: "act-valid",
      title: "Validate Input Dataset",
      category: "Actions",
      icon: "🛡️",
      action: () => {
        showToast({
          title: "DATA VALIDATION",
          message: "Data integrity scan completed: 0 structure format violations.",
          type: "success",
        });
        onClose();
      }
    },
    {
      id: "act-exp",
      title: "Export SDF Molecular Library",
      category: "Actions",
      icon: "📥",
      action: () => {
        showToast({
          title: "LIBRARY EXPORTED",
          message: "Molecular structure database downloaded successfully.",
          type: "success",
        });
        onClose();
      }
    },
    {
      id: "act-api",
      title: "Open Developer API Keys",
      category: "Actions",
      icon: "🔑",
      action: () => { router.push("/settings?section=api"); onClose(); }
    },
    {
      id: "act-team",
      title: "Invite Team Member to Project",
      category: "Actions",
      icon: "➕",
      action: () => {
        showToast({
          title: "INVITATION PANEL",
          message: "Opening team recruitment panel.",
          type: "info",
        });
        onClose();
      }
    },

    // === AI ===
    {
      id: "ai-ask",
      title: "Ask Pharma LLM Copilot",
      category: "AI",
      shortcut: ["C", "O"],
      icon: "✨",
      action: () => { router.push("/copilot"); onClose(); }
    },
    {
      id: "ai-explain",
      title: "Explain Top Ligand conformation",
      category: "AI",
      icon: "🧠",
      action: () => {
        showToast({
          title: "PHARMA COPIROT",
          message: "Analyzing binding pose pocket interaction statistics for QDF-481...",
          type: "info",
        });
        onClose();
      }
    },
    {
      id: "ai-sum",
      title: "Summarize active Docking results",
      category: "AI",
      icon: "📝",
      action: () => {
        showToast({
          title: "COPIROT ANALYSIS",
          message: "EGFR binding posture summary sent to active chat session.",
          type: "success",
        });
        onClose();
      }
    },
    {
      id: "ai-risk",
      title: "Identify ADMET toxicity risks",
      category: "AI",
      icon: "🧫",
      action: () => {
        showToast({
          title: "TOXICITY INFERENCE",
          message: "hERG channel blockade safety profiles scanned across 420 compounds.",
          type: "warning",
        });
        onClose();
      }
    },
    {
      id: "ai-plan",
      title: "Generate Pipeline Validation Plan",
      category: "AI",
      icon: "📋",
      action: () => {
        showToast({
          title: "VALIDATION DRAFT",
          message: "Oncology verification manifest generated by Pharma Assistant.",
          type: "info",
        });
        onClose();
      }
    },
  ], [router, onClose]);

  // Client-side local filtering
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    const query = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(query) ||
        cmd.category.toLowerCase().includes(query)
    );
  }, [search, commands]);

  // Keep index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Navigate selection with ArrowUp/ArrowDown, activate with Enter, close with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll active element into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Group filtered results by category and flatten them efficiently
  const { grouped, flatFilteredList } = useMemo(() => {
    const groupedResult = filteredCommands.reduce((acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    }, {} as Record<string, CommandItem[]>);

    const flatResult = Object.entries(groupedResult).flatMap(([_, items]) => items);

    return { grouped: groupedResult, flatFilteredList: flatResult };
  }, [filteredCommands]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <ModalEntrance className="w-full max-w-xl">
        <div
          ref={containerRef}
          className="w-full rounded-xl border overflow-hidden shadow-2xl flex flex-col backdrop-blur-xl"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Scientific Command Palette"
        >
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/20">
          <span className="text-muted-text/50 text-base">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search workspace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted-text/40"
          />
          <button
            onClick={onClose}
            className="text-[10px] font-black uppercase border border-border/30 rounded px-1.5 py-0.5 text-muted-text hover:text-text"
          >
            esc
          </button>
        </div>

        {/* Action List */}
        <div
          ref={listRef}
          className="max-h-[340px] overflow-y-auto p-2"
        >
          {flatFilteredList.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-muted-text/40">
              No matching scientific commands found.
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="space-y-1">
                {/* Category Header */}
                <h4 className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-[0.2em] text-accent/80">
                  {category}
                </h4>

                {/* Items */}
                {items.map((cmd) => {
                  const globalIdx = flatFilteredList.findIndex((item) => item.id === cmd.id);
                  const isActive = globalIdx === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                        isActive
                          ? "bg-accent/10 border border-accent/20 text-accent"
                          : "border border-transparent text-text/80 hover:text-text"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm shrink-0">{cmd.icon ?? "⚡"}</span>
                        <span className="truncate">{cmd.title}</span>
                      </div>
                      
                      {cmd.shortcut && (
                        <div className="flex gap-1 shrink-0">
                          {cmd.shortcut.map((key) => (
                            <kbd
                              key={key}
                              className="text-[9px] font-mono border border-border/40 bg-muted-bg rounded px-1.5 py-0.5 text-muted-text/75 uppercase"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex justify-between items-center px-4 py-2 border-t border-border/20 text-[9px] font-black uppercase tracking-widest text-muted-text/30 bg-black/20">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
          <span>Quinfosys™ Command Central</span>
        </div>
        </div>
      </ModalEntrance>
    </div>
  );
}
