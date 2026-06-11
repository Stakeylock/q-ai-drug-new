"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EmbeddingPoint } from "@/types/api";

interface ChemicalSpacePlotProps {
  data: EmbeddingPoint[];
  onPointClick?: (point: EmbeddingPoint) => void;
}

export default function ChemicalSpacePlot({
  data,
  onPointClick,
}: ChemicalSpacePlotProps) {
  return (
    <div className="h-full min-h-[400px] rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex h-full min-h-[480px] flex-col p-4">
        <ResponsiveContainer width="100%" height="100%" minHeight={440}>
          <ScatterChart margin={{ top: 16, right: 16, left: 16, bottom: 16 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              className="dark:stroke-slate-600"
            />
            <XAxis
              dataKey="x"
              name="UMAP 1"
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-slate-500"
            />
            <YAxis
              dataKey="y"
              name="UMAP 2"
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-slate-500"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.length && payload[0].payload) {
                  const p = payload[0].payload as EmbeddingPoint;
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                      <p className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {p.molecule_id}
                      </p>
                      <p className="mt-1 text-xs">QED: {p.qed.toFixed(2)}</p>
                      <p className="text-xs">MW: {p.mw.toFixed(1)}</p>
                      <p className="text-xs">{p.dataset}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter
              data={data}
              fill="#3b82f6"
              fillOpacity={0.6}
              onClick={(e: unknown) => {
                if (!onPointClick) return;
                const point = (e as { payload?: EmbeddingPoint })?.payload ?? (e as EmbeddingPoint);
                if (point && "molecule_id" in point) onPointClick(point);
              }}
              style={{ cursor: onPointClick ? "pointer" : "default" }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
