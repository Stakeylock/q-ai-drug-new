"use client";

import React from "react";
import { usePathname } from "next/navigation";

export type Feature = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

// Features to show on the Login page
const LOGIN_FEATURES: Feature[] = [
  {
    title: "Target discovery workflows",
    description: "Identify, prioritize, and validate disease-driving genomic targets with advanced bioinformatic maps.",
    icon: (
      <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    title: "Molecule generation and screening",
    description: "Generative reinforcement learning pipelines designed to filter and design millions of novel candidate structures.",
    icon: (
      <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    title: "Docking, GNINA, and quantum reranking",
    description: "Accelerate binding affinity calculations utilizing deep convolutional neural networks and molecular mechanics scoring.",
    icon: (
      <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.246.58 1.81l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.178 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.05 10.1c-.78-.564-.38-1.81.58-1.81h4.908a1 1 0 00.95-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    title: "Candidate dossiers and validation reports",
    description: "Automated preparation of FDA 21 CFR Part 11 compliant evidence packages and real-time ADMET profiling data.",
    icon: (
      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

// Onboarding benefits to show on the Registration page
const REGISTRATION_FEATURES: Feature[] = [
  {
    title: "Project-centric discovery workflows",
    description: "Organize chemical space explorations by target disease programs, structural targets, and active runs.",
    icon: (
      <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M5 7v13h14V7M8 3h8l2 4H6l2-4z" />
      </svg>
    ),
  },
  {
    title: "AI/ML model registry",
    description: "Deploy, benchmark, and track computational molecular predictors, QSAR arrays, and open-source models.",
    icon: (
      <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    title: "Docking and GNINA analysis",
    description: "Perform structural binding checks with AutoDock and deep convolutional GNINA neural scorers.",
    icon: (
      <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m10.607 10.607l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
  },
  {
    title: "Quantum reranking",
    description: "Obtain high-accuracy compound scoring with quantum chemical binding affinity models.",
    icon: (
      <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M5.636 5.636l3.536 3.536m0 5.656L5.636 18.364M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
  },
  {
    title: "ADMET and toxicity screening",
    description: "Identify high-risk ADMET and developmental flags early with instant predictive dashboards.",
    icon: (
      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: "Report and validation exports",
    description: "Synthesize full research evidence portfolios, logs, and structured raw tables with one click.",
    icon: (
      <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

interface AuthFeatureListProps {
  features?: Feature[];
}

export function AuthFeatureList({ features }: AuthFeatureListProps) {
  const pathname = usePathname();
  const isSignup = pathname?.includes("signup");

  // Determine which list to display
  const activeFeatures = features ?? (isSignup ? REGISTRATION_FEATURES : LOGIN_FEATURES);

  return (
    <ul className="space-y-4">
      {activeFeatures.map((feature, index) => (
        <li 
          key={index} 
          className="flex items-start gap-4 rounded-xl border border-cyan-500/10 bg-slate-900/30 p-3.5 backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/25 hover:bg-slate-900/50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 shadow-inner">
            {feature.icon}
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold tracking-tight text-slate-100">
              {feature.title}
            </h4>
            <p className="text-xs leading-relaxed text-slate-400">
              {feature.description}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
