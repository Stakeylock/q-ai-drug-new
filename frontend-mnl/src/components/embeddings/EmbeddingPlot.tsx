"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";
import type { EmbeddingPoint } from "@/types/api";

type ColorMode = "dataset" | "qed";

const CATEGORY_STYLES: Record<string, { color: string; symbol: string; size: number }> = {
  fda: { color: "#10b981", symbol: "diamond", size: 10 },
  generated: { color: "#6366f1", symbol: "circle", size: 8 },
  screening: { color: "#f59e0b", symbol: "square", size: 8 },
  default: { color: "#94a3b8", symbol: "circle", size: 6 },
};

interface EmbeddingPlotProps {
  data: EmbeddingPoint[];
  colorMode: ColorMode;
  onPointClick?: (point: EmbeddingPoint) => void;
}

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
}) as React.ComponentType<PlotParams>;

export default function EmbeddingPlot({
  data,
  colorMode,
  onPointClick,
}: EmbeddingPlotProps) {
  type PlotCustomData = [string, string, number, number, number];
  const parseCustomData = (value: unknown): PlotCustomData | undefined => {
    if (!Array.isArray(value) || value.length < 5) return undefined;
    return value as PlotCustomData;
  };

  const [hoveredPoint, setHoveredPoint] = useState<EmbeddingPoint | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pointById = useMemo(() => {
    return new Map(data.map((point) => [point.molecule_id, point]));
  }, [data]);

  const traces = useMemo<PlotParams["data"]>(() => {
    const toCustomData = (point: EmbeddingPoint): PlotCustomData => [
      point.molecule_id,
      point.dataset,
      point.qed,
      point.mw,
      point.logp ?? 0,
    ];

    if (colorMode === "qed") {
      return [
        {
          type: "scattergl",
          mode: "markers",
          name: "Molecules",
          x: data.map((point) => point.x),
          y: data.map((point) => point.y),
          ids: data.map((point) => point.molecule_id),
          customdata: data.map(toCustomData),
          marker: {
            size: 7,
            opacity: 0.85,
            color: data.map((point) => point.qed),
            colorscale: "Plasma",
            showscale: true,
            colorbar: {
              title: "QED Score",
              thickness: 15,
              len: 0.5,
              y: 0.5,
              tickfont: { size: 10, color: "#94a3b8" },
            },
          },
          hovertemplate: "%{customdata[0]}<extra></extra>",
        },
      ];
    }

    const datasets = Array.from(new Set(data.map((point) => point.dataset))).sort();

    return datasets.map((dataset) => {
      const datasetPoints = data.filter((point) => point.dataset === dataset);
      const style = CATEGORY_STYLES[dataset.toLowerCase()] || CATEGORY_STYLES.default;
      
      return {
        type: "scattergl",
        mode: "markers",
        name: dataset.toUpperCase(),
        x: datasetPoints.map((point) => point.x),
        y: datasetPoints.map((point) => point.y),
        ids: datasetPoints.map((point) => point.molecule_id),
        customdata: datasetPoints.map(toCustomData),
        marker: {
          size: style.size,
          symbol: style.symbol,
          opacity: 0.8,
          color: style.color,
          line: { width: 1, color: "rgba(255,255,255,0.2)" }
        },
        hovertemplate: "%{customdata[0]}<extra></extra>",
      };
    });
  }, [colorMode, data]);

  const layout = useMemo<Partial<Plotly.Layout>>(
    () => ({
      autosize: true,
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      margin: { t: 40, r: 10, b: 40, l: 40 },
      xaxis: {
        title: { text: "DIMENSION 1", font: { size: 10, family: "Inter, sans-serif", color: "#64748b" } },
        showgrid: true,
        gridcolor: "rgba(226, 232, 240, 0.4)",
        zeroline: false,
        tickfont: { size: 10, color: "#94a3b8" },
      },
      yaxis: {
        title: { text: "DIMENSION 2", font: { size: 10, family: "Inter, sans-serif", color: "#64748b" } },
        showgrid: true,
        gridcolor: "rgba(226, 232, 240, 0.4)",
        zeroline: false,
        tickfont: { size: 10, color: "#94a3b8" },
      },
      hovermode: "closest",
      dragmode: "pan",
      showlegend: colorMode === "dataset",
      legend: {
        orientation: "h",
        yanchor: "bottom",
        y: 1.02,
        xanchor: "right",
        x: 1,
        font: { size: 10, color: "#64748b" },
      },
    }),
    [colorMode]
  );

  return (
    <div ref={containerRef} className="ui-card-surface relative h-full min-h-[500px] overflow-hidden p-0 shadow-premium">
      <div className="absolute top-4 left-6 z-10">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">UMAP Topography</p>
        <h3 className="text-xs font-black text-text-secondary">Low-Dimensional Embedding Map</h3>
      </div>

      <div className="h-full w-full">
        <Plot
          data={traces}
          layout={layout}
          useResizeHandler
          style={{ width: "100%", height: "100%" }}
          config={{ displaylogo: false, responsive: true, scrollZoom: true }}
          onHover={(event) => {
            const hovered = event.points?.[0];
            const customData = parseCustomData(hovered?.customdata);
            const hoverId = customData?.[0] ?? null;
            const point = hoverId ? pointById.get(hoverId) ?? null : null;
            setHoveredPoint(point);
            const rect = containerRef.current?.getBoundingClientRect();
            const clientX = event.event?.clientX ?? 0;
            const clientY = event.event?.clientY ?? 0;
            if (rect) {
              setHoverCoords({
                x: Math.max(10, Math.min(clientX - rect.left + 20, rect.width - 240)),
                y: Math.max(10, Math.min(clientY - rect.top + 20, rect.height - 180)),
              });
            }
          }}
          onUnhover={() => {
            setHoveredPoint(null);
            setHoverCoords(null);
          }}
          onClick={(event) => {
            if (!onPointClick) return;
            const clicked = event.points?.[0];
            if (!clicked) return;
            const customData = parseCustomData(clicked.customdata);
            const targetId = customData?.[0] ?? null;
            const target = targetId ? pointById.get(targetId) ?? null : null;
            if (target) onPointClick(target);
          }}
        />
      </div>

      {/* Modern Tooltip */}
      <div
        className={`pointer-events-none absolute z-50 w-56 overflow-hidden rounded-2xl border border-border/50 bg-white shadow-2xl transition-all duration-200 ease-out ${
          hoveredPoint && hoverCoords ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        style={{
          left: hoverCoords?.x ?? 0,
          top: hoverCoords?.y ?? 0,
        }}
      >
        {hoveredPoint && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Preview</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-surface-subtle border border-border/50`}>
                {hoveredPoint.dataset}
              </span>
            </div>
            <p className="font-mono text-[13px] font-black tracking-tight text-text truncate">
              {hoveredPoint.molecule_id}
            </p>
            
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/30 bg-surface-subtle/20 p-2 text-center">
                <p className="text-[8px] font-bold text-text-secondary uppercase">MW</p>
                <p className="text-[10px] font-black text-text">{hoveredPoint.mw.toFixed(1)}</p>
              </div>
              <div className="rounded-xl border border-border/30 bg-surface-subtle/20 p-2 text-center">
                <p className="text-[8px] font-bold text-text-secondary uppercase">QED</p>
                <p className="text-[10px] font-black text-text">{hoveredPoint.qed.toFixed(2)}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[9px] font-bold text-text-secondary">CONFIDENCE</span>
              <div className="h-1.5 w-20 rounded-full bg-surface-subtle overflow-hidden">
                <div className="h-full bg-success w-4/5" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-6 z-10 rounded-full bg-white/80 border border-border/50 px-3 py-1 text-[10px] font-bold text-text-secondary backdrop-blur-md">
        {hoveredPoint ? (
          <span>ACTIVE: <span className="text-primary">{hoveredPoint.molecule_id}</span></span>
        ) : (
          "Scroll to zoom | Drag to pan | Click to select"
        )}
      </div>
    </div>
  );
}