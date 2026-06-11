"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { PlotParams } from "react-plotly.js";

import type { VisualizationEmbeddingPoint } from "@/services";

export type ChemicalSpaceColorMode = "activity" | "drugLikeness";

interface ChemicalSpaceScatterProps {
  data: VisualizationEmbeddingPoint[];
  colorMode: ChemicalSpaceColorMode;
  selectedMoleculeId?: string | null;
  onPointSelect?: (point: VisualizationEmbeddingPoint) => void;
  isLoading?: boolean;
}

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
}) as React.ComponentType<PlotParams>;

function colorMeta(colorMode: ChemicalSpaceColorMode) {
  if (colorMode === "activity") {
    return {
      title: "Activity",
      colorscale: "Turbo",
      values: (point: VisualizationEmbeddingPoint) => point.activity,
    };
  }

  return {
    title: "Drug-likeness",
    colorscale: "Viridis",
    values: (point: VisualizationEmbeddingPoint) => point.drugLikeness,
  };
}

export default function ChemicalSpaceScatter({
  data,
  colorMode,
  selectedMoleculeId,
  onPointSelect,
  isLoading = false,
}: ChemicalSpaceScatterProps) {
  const meta = useMemo(() => colorMeta(colorMode), [colorMode]);

  const selectedPoint = useMemo(
    () => data.find((point) => point.molecule_id === selectedMoleculeId) ?? null,
    [data, selectedMoleculeId],
  );

  const traces = useMemo<PlotParams["data"]>(() => {
    const baseTrace: Plotly.Data = {
      type: "scattergl",
      mode: "markers",
      name: "Molecules",
      x: data.map((point) => point.x),
      y: data.map((point) => point.y),
      ids: data.map((point) => point.molecule_id),
      customdata: data.map((point) => [
        point.molecule_id,
        point.dataset,
        point.activity,
        point.drugLikeness,
        point.smiles,
      ]),
      marker: {
        size: 12,
        opacity: 0.9,
        color: data.map((point) => meta.values(point)),
        cmin: 0,
        cmax: 1,
        colorscale: meta.colorscale,
        line: {
          width: 0,
        },
        colorbar: {
          title: {
            text: meta.title,
          },
          thickness: 12,
        },
      },
      hovertemplate:
        "<b>%{customdata[0]}</b><br>Dataset: %{customdata[1]}<br>Activity: %{customdata[2]:.2f}<br>Drug-likeness: %{customdata[3]:.2f}<br>SMILES: %{customdata[4]}<extra></extra>",
    };

    if (!selectedPoint) {
      return [baseTrace];
    }

    const selectedTrace: Plotly.Data = {
      type: "scattergl",
      mode: "markers",
      name: "Selected",
      x: [selectedPoint.x],
      y: [selectedPoint.y],
      marker: {
        size: 18,
        color: "rgba(255,255,255,0)",
        line: {
          color: "#22d3ee",
          width: 3,
        },
      },
      hoverinfo: "skip",
      showlegend: false,
    };

    return [baseTrace, selectedTrace];
  }, [data, meta, selectedPoint]);

  const layout = useMemo<Partial<Plotly.Layout>>(
    () => ({
      autosize: true,
      uirevision: "chemical-space-selection",
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      margin: { t: 12, r: 12, b: 42, l: 44 },
      xaxis: {
        title: { text: "Embedding 1" },
        showgrid: true,
        gridcolor: "#e2e8f0",
        zerolinecolor: "#cbd5e1",
      },
      yaxis: {
        title: { text: "Embedding 2" },
        showgrid: true,
        gridcolor: "#e2e8f0",
        zerolinecolor: "#cbd5e1",
      },
      hovermode: "closest",
      dragmode: "pan",
      showlegend: false,
    }),
    [],
  );

  return (
    <div className="h-full min-h-[480px] rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-[0_12px_38px_rgba(15,23,42,0.14)] transition-all duration-300">
      <div className="h-full min-h-[460px]">
        {isLoading ? (
          <div className="h-full min-h-[460px] rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="h-4 w-40 rounded-md bg-slate-200 skeleton-shimmer" />
            <div className="mt-3 h-3 w-64 rounded-md bg-slate-200 skeleton-shimmer" />
            <div className="mt-5 h-[380px] rounded-lg bg-slate-200 skeleton-shimmer" />
          </div>
        ) : null}
        <Plot
          data={traces}
          layout={layout}
          useResizeHandler
          style={{
            width: "100%",
            height: "100%",
            opacity: isLoading ? 0 : 1,
            transition: "opacity 280ms ease",
          }}
          config={{ displaylogo: false, responsive: true, scrollZoom: true }}
          onClick={(event) => {
            if (!onPointSelect) return;

            const clicked = event.points?.[0];
            const clickedId = (clicked as { id?: unknown } | undefined)?.id;
            const fromId = typeof clickedId === "string" ? clickedId : null;
            const fromCustom =
              Array.isArray(clicked?.customdata) && typeof clicked.customdata[0] === "string"
                ? clicked.customdata[0]
                : null;
            const id = fromId ?? fromCustom;
            if (!id) return;

            const target = data.find((point) => point.molecule_id === id);
            if (target) {
              onPointSelect(target);
            }
          }}
        />
      </div>
    </div>
  );
}
