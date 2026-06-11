export const RESULT_SECTIONS = [
  "generated",
  "filtered",
  "docking",
  "simulation",
  "quantum",
] as const;

export type ResultSection = (typeof RESULT_SECTIONS)[number];

export const RESULT_SECTION_LABELS: Record<ResultSection, string> = {
  generated: "Generated",
  filtered: "Filtered",
  docking: "Docking",
  simulation: "Simulation",
  quantum: "Quantum",
};
