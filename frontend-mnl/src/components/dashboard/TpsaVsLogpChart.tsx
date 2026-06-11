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
  { logp: 1.2, tpsa: 45 },
  { logp: 2.5, tpsa: 78 },
  { logp: 3.1, tpsa: 65 },
  { logp: 0.8, tpsa: 95 },
  { logp: 4.2, tpsa: 52 },
  { logp: 2.0, tpsa: 88 },
  { logp: 1.5, tpsa: 72 },
  { logp: 3.8, tpsa: 38 },
  { logp: 0.5, tpsa: 110 },
  { logp: 2.8, tpsa: 58 },
  { logp: 4.5, tpsa: 42 },
  { logp: 1.8, tpsa: 82 },
];

export default function TpsaVsLogpChart() {
  return (
    <ChartCard title="TPSA vs LogP">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
          <XAxis
            dataKey="logp"
            name="LogP"
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-500"
          />
          <YAxis
            dataKey="tpsa"
            name="TPSA"
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-500"
          />
          <Scatter
            data={MOCK_DATA}
            fill="#f59e0b"
            fillOpacity={0.7}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
