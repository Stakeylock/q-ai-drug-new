"use client";

import { useEffect, useState } from "react";

export function MolecularVisualPanel() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-500" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-[#0b1329] to-[#040814] p-8 text-cyan-400/90 shadow-2xl">
      {/* CSS Styles for animations */}
      <style jsx global>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(3deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-4deg); }
        }
        @keyframes orbit-spin-clockwise {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes orbit-spin-counter {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes dash-scroll {
          to { stroke-dashoffset: -40; }
        }
        @keyframes scanline {
          0% { top: -10%; }
          100% { top: 110%; }
        }
        .anim-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        .anim-float-medium {
          animation: float-medium 6s ease-in-out infinite;
        }
        .anim-orbit-cw {
          animation: orbit-spin-clockwise 24s linear infinite;
          transform-origin: 50% 50%;
        }
        .anim-orbit-ccw {
          animation: orbit-spin-counter 32s linear infinite;
          transform-origin: 50% 50%;
        }
        .anim-pulse-soft {
          animation: pulse-soft 3s ease-in-out infinite;
        }
        .anim-dash {
          stroke-dasharray: 5, 5;
          animation: dash-scroll 2s linear infinite;
        }
      `}</style>

      {/* Decorative Grid */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34, 211, 238, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse at center, black, transparent 80%)"
        }}
      />

      {/* Futuristic Scanline */}
      <div 
        className="pointer-events-none absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-40"
        style={{
          animation: "scanline 10s linear infinite"
        }}
      />

      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-indigo-500/10 blur-[100px]" />

      <div className="relative flex h-full flex-col justify-between z-10">
        {/* Top telemetry panel */}
        <div className="flex items-center justify-between border-b border-cyan-500/15 pb-4 text-xs font-mono tracking-wider opacity-80">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            <span>PLATFORM: ACTIVE</span>
          </div>
          <div>SYS_CORE_LATENCY: 0.12ms</div>
          <div>HYBRID_QUANTUM: ON</div>
        </div>

        {/* Central Molecular Visual */}
        <div className="my-auto flex items-center justify-center min-h-[300px]">
          <svg viewBox="0 0 400 400" className="w-full max-w-[340px] h-auto drop-shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <defs>
              <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Glowing Center Ambient circle */}
            <circle cx="200" cy="200" r="140" fill="url(#glowGrad)" />

            {/* Orbit Ring 1 (Large, dashed, rotating) */}
            <circle 
              cx="200" 
              cy="200" 
              r="130" 
              fill="none" 
              stroke="rgba(34, 211, 238, 0.2)" 
              strokeWidth="1" 
              strokeDasharray="4 8"
              className="anim-orbit-cw" 
            />

            {/* Orbit Ring 2 (Medium, fine, rotating counter-clockwise) */}
            <circle 
              cx="200" 
              cy="200" 
              r="100" 
              fill="none" 
              stroke="rgba(129, 140, 248, 0.3)" 
              strokeWidth="1.5" 
              strokeDasharray="120 40 80 60"
              className="anim-orbit-ccw" 
            />

            {/* Orbit Ring 3 (Outer solid, extremely fine) */}
            <circle 
              cx="200" 
              cy="200" 
              r="150" 
              fill="none" 
              stroke="rgba(34, 211, 238, 0.08)" 
              strokeWidth="0.75" 
            />

            {/* Bonding Lines connecting molecular nodes */}
            <g stroke="url(#lineGrad)" strokeWidth="1.5" className="anim-float-slow">
              {/* Central node connections */}
              <line x1="200" y1="200" x2="130" y2="140" />
              <line x1="200" y1="200" x2="270" y2="140" />
              <line x1="200" y1="200" x2="200" y2="280" />

              {/* Sub-node connections */}
              <line x1="130" y1="140" x2="80" y2="170" />
              <line x1="130" y1="140" x2="100" y2="70" />
              <line x1="270" y1="140" x2="320" y2="170" />
              <line x1="270" y1="140" x2="300" y2="70" />
              <line x1="200" y1="280" x2="140" y2="320" />
              <line x1="200" y1="280" x2="260" y2="320" />
            </g>

            {/* Molecular Nodes */}
            <g className="anim-float-medium">
              {/* Outer Outer Orbit nodes / technical markers */}
              <circle cx="200" cy="50" r="3" fill="#22d3ee" className="anim-pulse-soft" />
              <circle cx="350" cy="200" r="2" fill="#818cf8" />
              <circle cx="50" cy="200" r="3.5" fill="#06b6d4" />

              {/* Core Molecular Nodes */}
              {/* Central Hub */}
              <circle cx="200" cy="200" r="10" fill="#020617" stroke="#22d3ee" strokeWidth="2.5" />
              <circle cx="200" cy="200" r="4" fill="#22d3ee" />

              {/* Ring Left */}
              <circle cx="130" cy="140" r="7" fill="#020617" stroke="#818cf8" strokeWidth="2" />
              <circle cx="130" cy="140" r="2.5" fill="#818cf8" />

              {/* Ring Right */}
              <circle cx="270" cy="140" r="7" fill="#020617" stroke="#818cf8" strokeWidth="2" />
              <circle cx="270" cy="140" r="2.5" fill="#818cf8" />

              {/* Ring Bottom */}
              <circle cx="200" cy="280" r="8" fill="#020617" stroke="#22d3ee" strokeWidth="2" />
              <circle cx="200" cy="280" r="3" fill="#22d3ee" />

              {/* Sub-terminal Nodes (Hydrogen, Nitrogen, etc., colored) */}
              <circle cx="80" cy="170" r="5" fill="#06b6d4" />
              <circle cx="100" cy="70" r="4" fill="#818cf8" />
              <circle cx="320" cy="170" r="5" fill="#06b6d4" />
              <circle cx="300" cy="70" r="4" fill="#818cf8" />
              <circle cx="140" cy="320" r="5.5" fill="#22d3ee" />
              <circle cx="260" cy="320" r="4" fill="#a5b4fc" />
            </g>

            {/* Scientific telemetry overlays in SVG */}
            <g fontFamily="monospace" fontSize="8" fill="rgba(34, 211, 238, 0.45)" letterSpacing="1">
              <text x="215" y="195">d(H-O) = 0.96 Å</text>
              <text x="95" y="130">120°</text>
              <text x="250" y="275">EGFR_BOND_9</text>
              
              {/* Small radar crosshairs */}
              <path d="M 195 200 L 205 200 M 200 195 L 200 205" stroke="rgba(34, 211, 238, 0.3)" strokeWidth="0.5" />
            </g>
          </svg>
        </div>

        {/* Bottom stats / data panel */}
        <div className="space-y-3 font-mono text-[11px] opacity-90">
          <div className="flex items-center justify-between border-t border-cyan-500/15 pt-3">
            <span className="text-cyan-500/60">ACTIVE TARGET:</span>
            <span className="font-bold text-cyan-300">EGFR (T790M/L858R)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-cyan-500/60">BINDING FREE ENERGY (predicted):</span>
            <span className="font-bold text-emerald-400">-12.8 kcal/mol</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-cyan-500/60">CHEM_SPACE_DENSITY:</span>
            <span className="text-cyan-100">0.9997 Quantum Coherence</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-cyan-500/50 pt-1">
            <span>SHA256: 9e248b1fc7a892b1a8d0c8d...</span>
            <span>VER: 4.8.1-Q</span>
          </div>
        </div>
      </div>
    </div>
  );
}
