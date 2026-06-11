"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard from "./ChartCard";

const MOCK_DATA = [
  { mw: 180, qed: 0.45 },
  { mw: 220, qed: 0.62 },
  { mw: 280, qed: 0.58 },
  { mw: 320, qed: 0.71 },
  { mw: 350, qed: 0.55 },
  { mw: 290, qed: 0.48 },
  { mw: 410, qed: 0.38 },
  { mw: 260, qed: 0.82 },
  { mw: 330, qed: 0.65 },
  { mw: 195, qed: 0.72 },
  { mw: 380, qed: 0.51 },
  { mw: 245, qed: 0.59 },
  { mw: 310, qed: 0.44 },
];

export default function QedVsMwChart() {
  return (
    <ChartCard title="QED vs molecular weight">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
          <XAxis
            dataKey="mw"
            name="MW"
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-500"
          />
          <YAxis
            dataKey="qed"
            name="QED"
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-500"
          />
          <Scatter
            data={MOCK_DATA}
            fill="#8b5cf6"
            fillOpacity={0.7}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
