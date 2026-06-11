import MoleculeViewerCanvas from "./MoleculeViewerCanvas";
import ChartsCanvas from "./ChartsCanvas";
import ResultsTableCanvas from "./ResultsTableCanvas";

export type CanvasView = "molecule-viewer" | "charts" | "results-table";

interface DynamicCanvasPanelProps {
  view: CanvasView;
  contextLabel: string;
}

export default function DynamicCanvasPanel({ view, contextLabel }: DynamicCanvasPanelProps) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 shadow-[0_10px_36px_-22px_rgba(15,23,42,0.35)] backdrop-blur-xl" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card) 90%, transparent)" }}>
        <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--muted-text)" }}>Canvas Context: {contextLabel}</p>
        <span className="rounded-full border px-2 py-1 text-xs" style={{ borderColor: "var(--accent-border)", background: "var(--accent-bg)", color: "var(--accent-text)" }}>
          {view === "molecule-viewer"
            ? "Molecule Viewer"
            : view === "charts"
              ? "Charts"
              : "Results Table"}
        </span>
      </div>

      <div className="min-h-0 overflow-hidden rounded-[28px] border p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] backdrop-blur-xl" style={{ borderColor: "var(--border)", background: "linear-gradient(180deg, color-mix(in srgb, var(--card) 92%, transparent), color-mix(in srgb, var(--bg) 92%, var(--card)))" }}>
        {view === "molecule-viewer" && <MoleculeViewerCanvas />}
        {view === "charts" && <ChartsCanvas />}
        {view === "results-table" && <ResultsTableCanvas />}
      </div>
    </div>
  );
}
