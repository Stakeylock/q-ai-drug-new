"use client";

import { usePathname } from "next/navigation";
import { ProjectRoutes } from "@/lib/projectRoutes";

function Icon({ name, className = "h-4 w-4" }: { name: "chevronRight"; className?: string }) {
  if (name === "chevronRight") return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>;
  return null;
}

export function ProjectBreadcrumbs({ projectName, projectId }: { projectName: string; projectId: string }) {
  const pathname = usePathname();
  const normPath = pathname.toLowerCase();
  
  let section = "Project Overview";
  let title = projectName;

  if (normPath.includes("/targets")) {
    section = "Research / Target intelligence";
    title = "Targets";
  } else if (normPath.includes("/molecules") || normPath.includes("/candidates")) {
    section = "Research / Molecular library";
    title = "Molecules";
  } else if (normPath.includes("/gnina")) {
    section = "Research / Docking and GNINA";
    title = "GNINA";
  } else if (normPath.includes("/docking")) {
    section = "Research / Docking and GNINA";
    title = "Docking";
  } else if (normPath.includes("/quantum") || normPath.includes("/qm")) {
    section = "Research / Quantum scoring";
    title = "Quantum";
  } else if (normPath.includes("/simulation")) {
    section = "Research / Molecular dynamics";
    title = "Simulations";
  } else if (normPath.includes("/validation") || normPath.includes("/admet")) {
    section = "Research / Validation and ADMET";
    title = "ADMET";
  } else if (normPath.includes("/visualization")) {
    section = "Visualization / 3D structural discovery";
    title = "3D Viewer";
  } else if (normPath.includes("/chemical-space")) {
    section = "Visualization / Spatial intelligence";
    title = "Chemical Space";
  } else if (normPath.includes("/similarity")) {
    section = "Visualization / Structural similarity";
    title = "Similarity";
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--muted-text)" }}>
        <span className="truncate max-w-[120px] sm:max-w-[200px]" title={projectName}>{projectName}</span>
        <Icon name="chevronRight" className="h-2.5 w-2.5 opacity-40 shrink-0" />
        <span className="truncate">{section}</span>
      </div>
      <h1 className="mt-0.5 truncate text-base font-bold tracking-tight" style={{ color: "var(--text)" }}>
        {title}
      </h1>
    </div>
  );
}
