"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SimulationFrame {
  molecule_id: string;
  time: number;
  rmsd: number;
}

interface SimulationViewerProps {
  moleculeId: string;
  frames: SimulationFrame[];
  isLoading?: boolean;
}

function formatRmsd(value: number) {
  return `${value.toFixed(2)} Å`;
}

function statusFromFrames(values: number[]) {
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const peak = Math.max(...values);

  if (avg < 1.8 && peak < 2.2) return { label: "Stable", className: "border-emerald-300/70", style: { borderColor: "var(--success)", backgroundColor: "var(--muted-bg)", color: "var(--success)" } };
  if (avg < 2.2 && peak < 2.8) return { label: "Moderate", className: "border-amber-300/70", style: { borderColor: "var(--warning)", backgroundColor: "var(--muted-bg)", color: "var(--warning)" } };
  return { label: "Unstable", className: "border-rose-300/70", style: { borderColor: "var(--error)", backgroundColor: "var(--error-bg)", color: "var(--error-text)" } };
}

export default function SimulationViewer({ moleculeId, frames, isLoading = false }: SimulationViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const sortedFrames = useMemo(
    () => frames.slice().sort((a, b) => a.time - b.time),
    [frames],
  );

  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(false);
  }, [moleculeId]);

  useEffect(() => {
    if (!isPlaying || sortedFrames.length < 2) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        if (current >= sortedFrames.length - 1) {
          return 0;
        }
        return current + 1;
      });
    }, 550);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPlaying, sortedFrames.length]);

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_280px]">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="h-4 w-36 rounded-md skeleton-shimmer" style={{ backgroundColor: "var(--border)" }} />
          <div className="mt-2 h-3 w-56 rounded-md skeleton-shimmer" style={{ backgroundColor: "var(--border)" }} />
          <div className="mt-4 h-[320px] rounded-xl skeleton-shimmer" style={{ backgroundColor: "var(--border)" }} />
          <div className="mt-3 h-2 w-full rounded-md skeleton-shimmer" style={{ backgroundColor: "var(--border)" }} />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            <div className="h-4 w-44 rounded-md skeleton-shimmer" style={{ backgroundColor: "var(--border)" }} />
            <div className="mt-3 h-[180px] rounded-xl skeleton-shimmer" style={{ backgroundColor: "var(--border)" }} />
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            <div className="h-4 w-32 rounded-md skeleton-shimmer" style={{ backgroundColor: "var(--border)" }} />
            <div className="mt-3 h-3 w-40 rounded-md skeleton-shimmer" style={{ backgroundColor: "var(--border)" }} />
            <div className="mt-2 h-3 w-48 rounded-md skeleton-shimmer" style={{ backgroundColor: "var(--border)" }} />
            <div className="mt-2 h-3 w-44 rounded-md skeleton-shimmer" style={{ backgroundColor: "var(--border)" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!sortedFrames.length) {
    return (
      <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--muted-text)" }}>
        No simulation trajectory available for this molecule.
      </div>
    );
  }

  const times = sortedFrames.map((frame) => frame.time);
  const values = sortedFrames.map((frame) => frame.rmsd);
  const activePoint = sortedFrames[Math.min(activeIndex, sortedFrames.length - 1)];
  const chartData = sortedFrames.map((frame, index) => ({
    frame: index + 1,
    time: frame.time,
    rmsd: frame.rmsd,
  }));
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const peak = Math.max(...values);
  const stability = statusFromFrames(values);

  return (
    <div className="grid gap-5 transition-opacity duration-300 ease-out lg:grid-cols-[minmax(0,1.6fr)_280px]">
      <div className="viz-surface rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="viz-title text-sm" style={{ color: "var(--text)" }}>RMSD vs Time</p>
            <p className="viz-subtitle mt-1 text-xs">
              {moleculeId} | Frame {activeIndex + 1}/{sortedFrames.length} | Time {activePoint.time} ns
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPlaying((current) => !current)}
            className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-xs font-semibold transition-all duration-200 hover:-translate-y-[1px]"
            style={{ borderColor: "var(--accent-border)", backgroundColor: "var(--accent-bg)", color: "var(--accent-text)" }}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="h-[320px] w-full px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 16, left: 4 }}>
                <CartesianGrid strokeDasharray="4 6" stroke="rgba(148,163,184,0.2)" />
                <XAxis
                  type="number"
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "rgba(100,116,139,0.95)" }}
                  label={{ value: "Time (ns)", position: "insideBottom", offset: -8, fill: "rgba(100,116,139,0.95)", fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "rgba(100,116,139,0.95)" }}
                  label={{ value: "RMSD (A)", angle: -90, position: "insideLeft", fill: "rgba(100,116,139,0.95)", fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(3)} A`, "RMSD"]}
                  labelFormatter={(label) => `Time: ${label} ns`}
                  contentStyle={{
                    borderRadius: 10,
                    borderColor: "rgba(148,163,184,0.35)",
                    backgroundColor: "rgba(15,23,42,0.95)",
                    color: "#e2e8f0",
                  }}
                />
                <ReferenceLine x={activePoint.time} stroke="rgb(34 211 238 / 0.9)" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="rmsd"
                  stroke="rgb(34 197 94)"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "rgb(34 197 94)" }}
                  activeDot={{ r: 6, fill: "rgb(34 211 238)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={sortedFrames.length - 1}
          value={activeIndex}
          onChange={(event) => {
            setIsPlaying(false);
            setActiveIndex(Number(event.target.value));
          }}
          className="mt-3 w-full"
          style={{ accentColor: "var(--accent)" }}
        />
      </div>

      <div className="space-y-4">
        <div className="viz-surface rounded-2xl p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <p className="viz-subtitle text-[11px] font-semibold uppercase tracking-[0.14em]">
            Trajectory Summary
          </p>
          <div className="mt-3 flex min-h-[180px] items-center justify-center rounded-xl border border-dashed px-4 text-center" style={{ borderColor: "var(--accent-border)", backgroundColor: "var(--muted-bg)" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Molecular trajectory snapshots
              </p>
              <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted-text)" }}>
                Trajectory playback metadata is synchronized with RMSD frame selection and
                play or pause controls for quick qualitative review.
              </p>
            </div>
          </div>
        </div>

        <div className="viz-surface rounded-2xl p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <p className="viz-subtitle text-[11px] font-semibold uppercase tracking-[0.14em]">
            Stability status
          </p>
          <span
            className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${stability.className}`}
            style={stability.style}
          >
            {stability.label}
          </span>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt style={{ color: "var(--muted-text)" }}>Average RMSD</dt>
              <dd style={{ color: "var(--text)" }}>{formatRmsd(average)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt style={{ color: "var(--muted-text)" }}>Peak RMSD</dt>
              <dd style={{ color: "var(--text)" }}>{formatRmsd(peak)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt style={{ color: "var(--muted-text)" }}>Current RMSD</dt>
              <dd style={{ color: "var(--text)" }}>{formatRmsd(activePoint.rmsd)}</dd>
            </div>
          </dl>
        </div>

        <div className="viz-surface rounded-2xl p-4 text-sm" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--muted-text)" }}>
          Frame playback helps inspect transient drift phases and compare short-term fluctuations against global trajectory stability.
        </div>
      </div>
    </div>
  );
}
