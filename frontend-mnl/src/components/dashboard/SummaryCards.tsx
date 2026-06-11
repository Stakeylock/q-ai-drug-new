"use client";

import StatCard from "./StatCard";

const MoleculeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.998 2.5A2.5 2.5 0 0 0 9.5 5c0 .6.2 1.1.6 1.5L8.2 9H6.5A2.5 2.5 0 0 0 4 11.5a2.5 2.5 0 0 0 2.5 2.5h1.7l1.9 2.5c-.4.4-.6.9-.6 1.5a2.5 2.5 0 1 0 5 0c0-.6-.2-1.1-.6-1.5l1.9-2.5h1.7a2.5 2.5 0 1 0 0-5h-1.7l-1.9-2.5c.4-.4.6-.9.6-1.5A2.5 2.5 0 0 0 11.998 2.5z"></path>
  </svg>
);

const ExperimentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2v7.3L4.7 18A3 3 0 0 0 7.3 22h9.4a3 3 0 0 0 2.6-4l-5.3-8.7V2"></path>
    <path d="M8 2h8"></path>
    <path d="M8 12h8"></path>
  </svg>
);

const DockingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const QuantumIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M3 12h3m12 0h3M12 3v3m0 12v3M5.6 5.6l2.2 2.2m8.4 8.4l2.2 2.2M5.6 18.4l2.2-2.2m8.4-8.4l2.2-2.2" />
  </svg>
);

const ValidationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const SimulationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

interface SummaryCardsProps {
  totalMolecules: number | null;
  totalDatasets: number;
  experimentCount: number | null;
  experimentsLoading: boolean;
  experimentsError: string | null;
}

export default function SummaryCards({
  totalMolecules,
  totalDatasets,
  experimentCount,
  experimentsLoading,
  experimentsError,
}: SummaryCardsProps) {
  const moleculeValue = (totalMolecules ?? 0).toLocaleString();
  const experimentValue = experimentsLoading
    ? "..."
    : (experimentCount ?? 0).toLocaleString();

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard
        title="Molecules Screened"
        value={moleculeValue}
        description="Dataset coverage"
        icon={<MoleculeIcon />}
        titleTooltip="Total molecules analyzed in active repositories."
      />
      <StatCard
        title="Active Experiments"
        value={experimentValue}
        description="Live pipeline runs"
        icon={<ExperimentIcon />}
        titleTooltip="Currently executing research pipelines."
      />
      <StatCard
        title="Docking Jobs"
        value="1.2k"
        description="GNINA / Autodock"
        icon={<DockingIcon />}
        titleTooltip="Binding pose simulations completed."
      />
      <StatCard
        title="Quantum Accuracy"
        value="98.2%"
        description="QSVM Reranking"
        icon={<QuantumIcon />}
        titleTooltip="Statistical confidence in quantum reranking."
      />
      <StatCard
        title="Validated Candidates"
        value="42"
        description="PDBbind overlap"
        icon={<ValidationIcon />}
        titleTooltip="Candidates confirmed against experimental benchmarks."
      />
      <StatCard
        title="Sim Success Rate"
        value="94%"
        description="OpenMM Stability"
        icon={<SimulationIcon />}
        titleTooltip="Percentage of trajectories meeting stability criteria."
      />
    </div>
  );
}

