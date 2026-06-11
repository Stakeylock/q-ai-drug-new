/**
 * Centralized Route Helper for Project-Centric Architecture (Phase 2C+)
 * 
 * Defines all standard project paths using dynamic projectId parameters,
 * eliminating hardcoded strings and supporting future nesting.
 */

export const ProjectRoutes = {
  // Base dashboard/overview
  dashboard: (projectId: string) => `/projects/${projectId}`,
  reports: (projectId: string) => `/projects/${projectId}/reports`,

  // Research Area
  targets: (projectId: string) => `/projects/${projectId}/targets`,
  molecules: (projectId: string) => `/projects/${projectId}/candidates`,
  docking: (projectId: string) => `/projects/${projectId}/docking`,
  gnina: (projectId: string) => `/projects/${projectId}/gnina`,
  quantum: (projectId: string) => `/projects/${projectId}/qm`,
  simulation: (projectId: string) => `/projects/${projectId}/simulation`,
  admet: (projectId: string) => `/projects/${projectId}/validation?panel=admet`,

  // Visualization Area
  visualization: (projectId: string) => `/projects/${projectId}/visualization`,
  chemicalSpace: (projectId: string) => `/projects/${projectId}/chemical-space`,
  similarity: (projectId: string) => `/projects/${projectId}/similarity`,

  // Global cross-project views (used outside of specific project context)
  global: {
    history: () => '/history',
    reports: () => '/results',
    researchProjects: () => '/research-projects'
  }
};
