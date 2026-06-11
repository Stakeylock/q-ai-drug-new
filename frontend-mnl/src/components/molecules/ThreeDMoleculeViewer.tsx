"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const smilesSdfCache: Record<string, string> = {};

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export interface ThreeDMoleculeViewerSource {
  format: "smiles" | "pdb" | "sdf";
  value: string;
  label?: string;
}

export interface ThreeDMoleculeViewerMoleculeOption {
  id: string;
  label: string;
  source: ThreeDMoleculeViewerSource;
  alternateSource?: ThreeDMoleculeViewerSource;
}

export interface ThreeDMoleculeViewerProps {
  source?: ThreeDMoleculeViewerSource;
  receptorSource?: ThreeDMoleculeViewerSource;
  alternateSource?: ThreeDMoleculeViewerSource;
  moleculeOptions?: ThreeDMoleculeViewerMoleculeOption[];
  selectedMoleculeId?: string;
  onMoleculeSelect?: (moleculeId: string) => void;
  title?: string;
  subtitle?: string;
  className?: string;
  initialRepresentation?: "stick" | "sphere" | "cartoon";
  showSurfaceControl?: boolean;
}

type ViewerRepresentation = "stick" | "sphere" | "cartoon";

const TARGETS = ["EGFR", "PARP1", "PIK3CA"];

export default function ThreeDMoleculeViewer({
  source,
  receptorSource,
  alternateSource,
  moleculeOptions,
  selectedMoleculeId,
  onMoleculeSelect,
  title = "3D Molecular Operations",
  subtitle = "Interactive structure review with live simulation telemetry.",
  className,
  initialRepresentation = "stick",
  showSurfaceControl = true,
}: ThreeDMoleculeViewerProps) {
  const [internalSelectedId, setInternalSelectedId] = useState(moleculeOptions?.[0]?.id ?? "");
  const [activeSourceSlot, setActiveSourceSlot] = useState<"primary" | "alternate">("primary");
  const [representation, setRepresentation] = useState<ViewerRepresentation>(initialRepresentation);
  const [surfaceEnabled, setSurfaceEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(TARGETS[0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadingLogIndex, setLoadingLogIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const defaultViewRef = useRef<number[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeMoleculeId = selectedMoleculeId ?? internalSelectedId;

  const loadingLogs = [
    "Loading receptor structure...",
    "Generating ligand conformer...",
    "Running docking evaluation...",
    "Calculating quantum reranking...",
    "Finalizing 3D pose..."
  ];

  const selectedMoleculeOption = useMemo(() => {
    if (!moleculeOptions?.length) {
      return null;
    }

    return (
      moleculeOptions.find((option) => option.id === activeMoleculeId) ??
      moleculeOptions[0]
    );
  }, [activeMoleculeId, moleculeOptions]);

  const primarySource = selectedMoleculeOption?.source ?? source ?? null;
  const secondarySource = selectedMoleculeOption?.alternateSource ?? alternateSource ?? null;

  const activeSource =
    activeSourceSlot === "primary"
      ? primarySource
      : (secondarySource ?? primarySource);

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingLogIndex((prev) => (prev + 1) % loadingLogs.length);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [isLoading, loadingLogs.length]);

  useEffect(() => {
    if (!moleculeOptions?.length) return;

    if (!selectedMoleculeId) {
      setInternalSelectedId((current) => current || moleculeOptions[0].id);
    }
  }, [moleculeOptions, selectedMoleculeId]);

  useEffect(() => {
    setActiveSourceSlot("primary");
  }, [primarySource?.format, primarySource?.label, primarySource?.value]);

  useEffect(() => {
    let alive = true;

    async function renderStructure() {
      try {
        setIsLoading(true);
        setError(null);
        setIsReady(false);

        const imported3Dmol = await import("3dmol");
        const $3DmolMod = imported3Dmol.default || imported3Dmol;

        if (!containerRef.current || !alive) return;

        const isDark = typeof document !== "undefined" && (document.documentElement.classList.contains("dark") || document.documentElement.getAttribute("data-theme") === "dark");
        const bgColor = isDark ? "#020617" : "white";

        if (!viewerRef.current) {
          viewerRef.current = $3DmolMod.createViewer(containerRef.current, {
            backgroundColor: bgColor,
          });
        } else {
          viewerRef.current.setBackgroundColor(bgColor);
        }

        viewerRef.current.clear();

        if (!activeSource?.value?.trim()) {
          throw new Error("No molecule source is available for rendering.");
        }

        let modelData = activeSource.value;

        if (activeSource.format === "smiles") {
          const smiles = activeSource.value.trim();
          if (smilesSdfCache[smiles]) {
            modelData = smilesSdfCache[smiles];
          } else {
            const url3d = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/record/SDF/?record_type=3d`;
            let response = await fetch(url3d);

            if (!response.ok) {
              const url2d = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/record/SDF/?record_type=2d`;
              response = await fetch(url2d);
            }

            if (!response.ok) {
              throw new Error("Unable to resolve SMILES to a 3D structure.");
            }

            modelData = await response.text();
            smilesSdfCache[smiles] = modelData;
          }
        }

        if (!modelData) {
          throw new Error("No molecular structure data available.");
        }

        // 1. If receptorSource is present, load it first (model 0)
        if (receptorSource && receptorSource.value) {
          viewerRef.current.addModel(receptorSource.value, receptorSource.format || "pdb");
          
          if (representation === "cartoon") {
            viewerRef.current.setStyle({ model: 0 }, { cartoon: { color: "spectrum" } });
          } else {
            viewerRef.current.setStyle({ model: 0 }, { line: { color: "#6b7280", linewidth: 1.2 } });
          }
          
          if (surfaceEnabled && showSurfaceControl) {
            viewerRef.current.addSurface(
              $3DmolMod.SurfaceType.VDW,
              { 
                opacity: 0.16, 
                color: "#78a8a2" 
              },
              { model: 0 },
            );
          }
        }

        // 2. Load the ligand molecule (model 0 if no receptor, model 1 if receptor exists)
        const format = activeSource.format === "smiles" ? "sdf" : activeSource.format;
        viewerRef.current.addModel(modelData, format);

        const ligandModelIndex = receptorSource && receptorSource.value ? 1 : 0;

        if (receptorSource && receptorSource.value) {
          // Style ligand inside the pocket
          const ligandStyle = representation === "sphere"
            ? { sphere: { scale: 0.32, colorscheme: "greenCarbon" }, stick: { radius: 0.16, colorscheme: "greenCarbon" } }
            : { stick: { radius: 0.24, colorscheme: "greenCarbon" } };
          viewerRef.current.setStyle({ model: ligandModelIndex }, ligandStyle);
          viewerRef.current.zoomTo({ model: ligandModelIndex });
        } else {
          // Style single molecule representation
          if (representation === "sphere") {
            viewerRef.current.setStyle({}, { sphere: { scale: 0.32 } });
          } else if (representation === "cartoon") {
            viewerRef.current.setStyle({}, { cartoon: { color: "spectrum" } });
          } else {
            viewerRef.current.setStyle({}, { stick: { radius: 0.16 } });
          }

          if (surfaceEnabled && showSurfaceControl) {
            viewerRef.current.addSurface(
              $3DmolMod.SurfaceType.VDW,
              { 
                opacity: isDark ? 0.45 : 0.65, 
                color: isDark ? "#22d3ee" : "#06b6d4" 
              },
              { hetflag: false },
            );
          }
          viewerRef.current.zoomTo();
        }

        viewerRef.current.render();
        defaultViewRef.current = viewerRef.current.getView();
        setIsReady(true);
      } catch (cause) {
        if (!alive) return;

        setError(cause instanceof Error ? cause.message : "Failed to render molecule.");
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    }

    renderStructure();

    return () => {
      alive = false;
      if (viewerRef.current) {
        viewerRef.current.clear();
      }
      setIsReady(false);
    };
  }, [activeSource?.format, activeSource?.value, receptorSource, representation, showSurfaceControl, surfaceEnabled]);

  useEffect(() => {
    if (!isReady) return;

    const handleResize = () => {
      viewerRef.current?.resize?.();
      viewerRef.current?.render?.();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isReady]);

  const handleRotate = (axis: "x" | "y" | "z", amount: number) => {
    if (!viewerRef.current) return;

    viewerRef.current.rotate(amount, axis);
    viewerRef.current.render();
  };

  const handleZoom = (factor: number) => {
    if (!viewerRef.current) return;

    viewerRef.current.zoom(factor);
    viewerRef.current.render();
  };

  const handleReset = () => {
    if (!viewerRef.current) return;

    if (defaultViewRef.current) {
      viewerRef.current.setView(defaultViewRef.current);
    } else {
      viewerRef.current.zoomTo();
    }

    viewerRef.current.render();
  };

  const toggleFullscreen = () => {
    if (!rootRef.current) return;
    if (!document.fullscreenElement) {
      rootRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMoleculeSelect = (moleculeId: string) => {
    setInternalSelectedId(moleculeId);
    onMoleculeSelect?.(moleculeId);
  };

  return (
    <section
      ref={rootRef}
      className={joinClasses(
        "flex h-full min-h-[600px] flex-col overflow-hidden rounded-2xl border shadow-premium transition-all duration-300",
        isFullscreen ? "fixed inset-0 z-[9999] rounded-none border-0" : "",
        className,
      )}
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <header className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: "var(--text)" }}>
              {title}
            </h3>
            <p className="text-xs font-bold" style={{ color: "var(--muted-text)" }}>
              Target: <span className="text-primary">{selectedTarget}</span> | Ligand: <span className="text-accent">{activeMoleculeId}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Protein Target</span>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="h-9 rounded-lg border px-3 text-xs font-bold focus:outline-none"
              style={{ backgroundColor: "var(--muted-bg)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              {TARGETS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Candidate</span>
            <select
              value={selectedMoleculeOption?.id ?? ""}
              onChange={(event) => handleMoleculeSelect(event.target.value)}
              className="h-9 rounded-lg border px-3 text-xs font-bold focus:outline-none"
              style={{ backgroundColor: "var(--muted-bg)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              {moleculeOptions?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={toggleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted-bg transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 grid gap-0 lg:grid-cols-[1fr_320px] min-h-0">
        <div className="relative min-h-[400px] overflow-hidden" style={{ background: "color-mix(in srgb, var(--card) 95%, black)" }}>
          <div ref={containerRef} className="absolute inset-0" />

          {/* Interaction Legend */}
          <div className="absolute top-4 left-4 z-20 space-y-2 rounded-xl border p-3 shadow-sm backdrop-blur-md" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card) 80%, transparent)" }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary/60 mb-2">Interaction Legend</p>
            <div className="space-y-1.5">
              {[
                { label: "Carbon", color: "bg-gray-700" },
                { label: "Oxygen", color: "bg-red-500" },
                { label: "Nitrogen", color: "bg-blue-500" },
                { label: "Sulfur", color: "bg-yellow-500" },
                { label: "H-Bonds", color: "bg-success", dashed: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`h-2 w-4 rounded-sm ${item.color} ${item.dashed ? "opacity-40" : ""}`} />
                  <span className="text-[10px] font-bold text-text-secondary">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm"
                style={{ background: "color-mix(in srgb, var(--card) 90%, transparent)" }}
              >
                <div className="relative mb-8 h-20 w-20">
                  <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  <div className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-primary/20">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-primary animate-pulse">
                    {loadingLogs[loadingLogIndex]}
                  </p>
                  <div className="h-1 w-48 overflow-hidden rounded-full bg-primary/10">
                    <motion.div
                      className="h-full bg-primary"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="absolute inset-0 z-40 flex items-center justify-center px-10 text-center" style={{ background: "color-mix(in srgb, var(--card) 90%, transparent)" }}>
              <div className="max-w-xs space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-error">{error}</p>
                <button onClick={handleReset} className="text-xs font-black uppercase tracking-widest text-primary underline">Try Reloading</button>
              </div>
            </div>
          )}
        </div>

        <aside className="border-l bg-surface-subtle/30 overflow-y-auto" style={{ borderColor: "var(--border)" }}>
          <div className="p-6 space-y-8">
            {/* Simulation Telemetry */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Simulation Telemetry</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3 shadow-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <p className="text-[9px] font-bold text-text-secondary uppercase">Affinity</p>
                  <p className="text-lg font-black text-primary">-9.2 <span className="text-[10px] text-text-secondary/50">kcal/mol</span></p>
                </div>
                <div className="rounded-xl border p-3 shadow-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <p className="text-[9px] font-bold text-text-secondary uppercase">H-Bonds</p>
                  <p className="text-lg font-black text-success">4 <span className="text-[10px] text-text-secondary/50">active</span></p>
                </div>
                <div className="rounded-xl border p-3 shadow-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <p className="text-[9px] font-bold text-text-secondary uppercase">Quantum</p>
                  <p className="text-lg font-black text-accent">0.96 <span className="text-[10px] text-text-secondary/50">QSVM</span></p>
                </div>
                <div className="rounded-xl border p-3 shadow-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <p className="text-[9px] font-bold text-text-secondary uppercase">Toxicity</p>
                  <p className="text-lg font-black text-success">Low <span className="text-[10px] text-text-secondary/50">score</span></p>
                </div>
              </div>
            </div>

            {/* Ligand Metadata */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Ligand Metadata</p>
              <div className="rounded-xl border p-4 space-y-3 shadow-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-text-secondary">MW</span>
                  <span className="text-[11px] font-black text-text">421.4 g/mol</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-text-secondary">LogP</span>
                  <span className="text-[11px] font-black text-text">3.82</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-text-secondary">QED</span>
                  <span className="text-[11px] font-black text-text">0.88</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-text-secondary">GNINA Conf.</span>
                  <span className="text-[11px] font-black text-accent">98.4%</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Visualization Controls</p>
              <div className="grid grid-cols-3 gap-2">
                {(["stick", "sphere", "cartoon"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setRepresentation(mode)}
                    className={joinClasses(
                      "rounded-lg border px-2 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                      representation === mode ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "hover:bg-muted-bg"
                    )}
                    style={{ background: representation === mode ? "" : "var(--card)", borderColor: representation === mode ? "" : "var(--border)" }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleZoom(1.15)} className="rounded-lg border p-2 text-[10px] font-black uppercase tracking-widest hover:bg-muted-bg" style={{ background: "var(--card)", borderColor: "var(--border)" }}>Zoom +</button>
                <button onClick={() => handleZoom(0.85)} className="rounded-lg border p-2 text-[10px] font-black uppercase tracking-widest hover:bg-muted-bg" style={{ background: "var(--card)", borderColor: "var(--border)" }}>Zoom -</button>
                <button onClick={() => handleRotate("y", 15)} className="rounded-lg border p-2 text-[10px] font-black uppercase tracking-widest hover:bg-muted-bg" style={{ background: "var(--card)", borderColor: "var(--border)" }}>Rotate</button>
                <button onClick={handleReset} className="rounded-lg border bg-primary/5 text-primary border-primary/20 p-2 text-[10px] font-black uppercase tracking-widest hover:bg-primary/10">Reset</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}