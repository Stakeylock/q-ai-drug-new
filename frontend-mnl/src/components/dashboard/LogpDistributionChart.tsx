"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import ChartCard from "./ChartCard";
import { Distribution } from "@/types/api";

interface LogpDistributionChartProps {
  distribution?: Distribution;
}

export default function LogpDistributionChart({ distribution }: LogpDistributionChartProps) {
  const data = useMemo(() => {
    if (!distribution) return [];
    return distribution.bins.slice(0, -1).map((bin, i) => {
      const nextBin = distribution.bins[i + 1];
      const count = distribution.counts[i] || 0;
      let label = `${bin.toFixed(1)}-${nextBin.toFixed(1)}`;
      if (i === 0 && nextBin <= 0) label = "<0";
      if (i === distribution.bins.length - 2 && bin >= 4) label = "4+";
      return {
        bin: label,
        count,
      };
    });
  }, [distribution]);

  if (!distribution) return null;

  return (
    <ChartCard title="LogP Distribution">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
          <XAxis
            dataKey="bin"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            dx={-10}
          />
          <Tooltip 
            cursor={{ fill: "#1e293b", opacity: 0.4 }}
            contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#f8fafc" }}
            itemStyle={{ color: "#818cf8" }}
          />
          <Bar
            dataKey="count"
            fill="#818cf8"
            radius={[0, 0, 0, 0]}
            maxBarSize={60}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
