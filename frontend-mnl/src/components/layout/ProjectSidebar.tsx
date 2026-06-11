"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import { ProjectRoutes } from "@/lib/projectRoutes";
import logo from "../../../public/logo.png";

type IconName =
  | "activity" | "archive" | "atom" | "bell" | "blocks" | "box" | "brain"
  | "chevronLeft" | "chevronRight" | "chevronDown" | "circleGauge" | "cloud"
  | "code" | "database" | "fileText" | "flask" | "folderKanban" | "link"
  | "network" | "orbit" | "plug" | "receipt" | "search" | "settings"
  | "shieldCheck" | "sparkles" | "target" | "users" | "workflow";

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    activity: <path d="M3 12h4l2.2-7 4.6 14 2.2-7h5" />,
    archive: <><path d="M3 7h18" /><path d="M5 7v13h14V7" /><path d="M8 3h8l2 4H6l2-4Z" /><path d="M10 12h4" /></>,
    atom: <><circle cx="12" cy="12" r="1.8" /><path d="M20.2 12c0 2-3.7 3.6-8.2 3.6S3.8 14 3.8 12 7.5 8.4 12 8.4s8.2 1.6 8.2 3.6Z" /><path d="M16.1 19.1c-1.7 1-4.9-1.5-7.2-5.4S6.2 6 7.9 4.9s4.9 1.5 7.2 5.4 2.7 7.7 1 8.8Z" /><path d="M7.9 19.1c-1.7-1-.8-4.9 1.4-8.8s5.5-6.4 7.2-5.4.8 4.9-1.4 8.8-5.5 6.4-7.2 5.4Z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
    blocks: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
    box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
    brain: <><path d="M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5.2A3.5 3.5 0 0 0 7.5 18H9" /><path d="M15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5.2A3.5 3.5 0 0 1 16.5 18H15" /><path d="M9 3v18" /><path d="M15 3v18" /><path d="M9 8H7" /><path d="M15 8h2" /><path d="M9 14H7.5" /><path d="M15 14h1.5" /></>,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    circleGauge: <><path d="M20.8 13.4A9 9 0 1 1 10.6 3.2" /><path d="M12 12l5-5" /><path d="M7 12h.01" /><path d="M12 7h.01" /><path d="M17 12h.01" /></>,
    cloud: <><path d="M17.5 19H8a5 5 0 1 1 .9-9.9A7 7 0 0 1 22 12.5 3.5 3.5 0 0 1 17.5 19Z" /><path d="M12 13v5" /><path d="m9.5 15.5 2.5-2.5 2.5 2.5" /></>,
    code: <><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" /></>,
    flask: <><path d="M9 2v6l-5 9a3 3 0 0 0 2.6 4.5h10.8A3 3 0 0 0 20 17L15 8V2" /><path d="M8 2h8" /><path d="M7.5 15h9" /></>,
    folderKanban: <><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M8 11v5" /><path d="M12 10v6" /><path d="M16 12v4" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" /></>,
    network: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8.2 7.4 11 15.5" /><path d="m15.8 7.4-2.8 8.1" /><path d="M8.5 6h7" /></>,
    orbit: <><circle cx="12" cy="12" r="2" /><path d="M20.5 12c0 2.2-3.8 4-8.5 4s-8.5-1.8-8.5-4 3.8-4 8.5-4 8.5 1.8 8.5 4Z" /><path d="M16.2 19.3c-1.9 1.1-5.3-1.5-7.7-5.6S5.6 5.8 7.4 4.7s5.3 1.5 7.7 5.6 2.9 7.9 1.1 9Z" /></>,
    plug: <><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M6 8h12v5a6 6 0 0 1-12 0V8Z" /></>,
    receipt: <><path d="M4 2v20l3-2 3 2 3-2 3-2 3-2 1 .7V2l-3 2-3-2-3 2-3-2-3 2Z" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2 .4l-.2.2-4-.1-.1-.3a1.8 1.8 0 0 0-1.7-1.1 1.8 1.8 0 0 0-.8.2l-.2.1-2-3.4.1-.1a1.8 1.8 0 0 0 .4-2l-.1-.3-2.8-1.6V8.8l2.8-1.6.1-.3a1.8 1.8 0 0 0-.4-2l-.1-.1 2-3.4.2.1a1.8 1.8 0 0 0 2-.4l.2-.2h3.9l.2.2a1.8 1.8 0 0 0 2 .4l.2-.1 2 3.4-.1.1a1.8 1.8 0 0 0-.4 2l.1.3 2.8 1.6v3.6L19.5 14l-.1 1Z" /></>,
    shieldCheck: <><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></>,
    sparkles: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /><path d="m5 2 .8 2.2L8 5l-2.2.8L5 8l-.8-2.2L2 5l2.2-.8L5 2Z" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
    workflow: <><rect x="3" y="4" width="6" height="6" rx="1.5" /><rect x="15" y="4" width="6" height="6" rx="1.5" /><rect x="9" y="14" width="6" height="6" rx="1.5" /><path d="M9 7h6" /><path d="m12 10v4" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  matchHref?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export function ProjectSidebar({ 
  projectId, 
  isSidebarCollapsed, 
  setIsSidebarCollapsed,
  activeWorkspaceName,
  activeWorkspaceRole
}: { 
  projectId: string;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  activeWorkspaceName?: string;
  activeWorkspaceRole?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();

  const NAV_GROUPS: NavGroup[] = [
    {
      label: "Project",
      items: [
        { label: "Overview", href: ProjectRoutes.dashboard(projectId), icon: "folderKanban" },
        { label: "Reports", href: ProjectRoutes.reports(projectId), icon: "fileText" },
      ],
    },
    {
      label: "Research",
      items: [
        { label: "Targets", href: ProjectRoutes.targets(projectId), icon: "target" },
        { label: "Molecules", href: ProjectRoutes.molecules(projectId), icon: "atom" },
        { label: "Docking", href: ProjectRoutes.docking(projectId), icon: "network" },
        { label: "GNINA", href: ProjectRoutes.gnina(projectId), icon: "brain", matchHref: "/gnina" },
        { label: "Quantum", href: ProjectRoutes.quantum(projectId), icon: "orbit" },
        { label: "Simulations", href: ProjectRoutes.simulation(projectId), icon: "activity" },
        { label: "ADMET", href: ProjectRoutes.admet(projectId), icon: "shieldCheck" },
      ],
    },
    {
      label: "Visualization",
      items: [
        { label: "3D Viewer", href: ProjectRoutes.visualization(projectId), icon: "box" },
        { label: "Chemical Space", href: ProjectRoutes.chemicalSpace(projectId), icon: "workflow" },
        { label: "Similarity", href: ProjectRoutes.similarity(projectId), icon: "link" },
      ],
    },
    {
      label: "Global Navigation",
      items: [
        { label: "All Projects", href: ProjectRoutes.global.researchProjects(), icon: "folderKanban" },
        { label: "Experiments", href: ProjectRoutes.global.history(), icon: "flask" },
      ],
    }
  ];

  function isSidebarItemActive(pathname: string, currentSearch: string, label: string): boolean {
    const normPath = pathname.toLowerCase().replace(/\/$/, "");
    const normSearch = currentSearch.toLowerCase();
    
    // Exact or prefix matching based on route structure
    switch(label) {
        case "Overview":
            return normPath === `/projects/${projectId.toLowerCase()}`;
        case "Reports":
            return normPath.includes("/reports");
        case "Targets":
            return normPath.includes("/targets");
        case "Molecules":
            return normPath.includes("/molecules") || normPath.includes("/candidates");
        case "Docking":
            return normPath.includes("/docking") && !normSearch.includes("engine=gnina");
        case "GNINA":
            return normPath.includes("/gnina") || (normPath.includes("/docking") && normSearch.includes("engine=gnina"));
        case "Quantum":
            return normPath.includes("/quantum") || normPath.includes("/qm");
        case "Simulations":
            return normPath.includes("/simulation");
        case "ADMET":
            return normPath.includes("/admet") || (normPath.includes("/validation") && normSearch.includes("panel=admet"));
        case "3D Viewer":
            return normPath.includes("/visualization");
        case "Chemical Space":
            return normPath.includes("/chemical-space");
        case "Similarity":
            return normPath.includes("/similarity");
        default:
            return false;
    }
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden border-r lg:flex ${isSidebarCollapsed ? "w-20" : "w-64"}`}
      style={{ borderColor: "var(--border)", background: "var(--sidebar-bg)" }}
    >
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div className={`shrink-0 border-b ${isSidebarCollapsed ? "px-3 py-4" : "px-4 py-4"}`} style={{ borderColor: "var(--border)" }}>
          <div className={`flex ${isSidebarCollapsed ? "justify-center" : "justify-start"}`}>
            <Image
              src={logo}
              alt="Quinfosys QuDrugForge"
              width={180}
              height={43}
              priority
              className={isSidebarCollapsed ? "h-auto w-10 object-contain" : "h-auto w-40 max-w-full object-contain"}
            />
          </div>

          {!isSidebarCollapsed ? (
            <p className="mt-2 truncate text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: "var(--muted-text)" }}>
              Quantum AI Drug Discovery
            </p>
          ) : null}

          {!isSidebarCollapsed ? (
            <div
              className="mt-4 rounded-lg border px-3 py-2.5"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold" style={{ color: "var(--text)" }}>
                    {activeWorkspaceName || "Research Workspace"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] capitalize" style={{ color: "var(--muted-text)" }}>
                    {activeWorkspaceRole || "member"} Division
                  </p>
                </div>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "var(--success)" }} />
              </div>
            </div>
          ) : null}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-3">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                {!isSidebarCollapsed ? (
                  <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] opacity-50" style={{ color: "var(--muted-text)" }}>
                    {group.label}
                  </div>
                ) : null}

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = isSidebarItemActive(pathname, currentSearch, item.label);

                    return (
                      <Link
                        key={`${group.label}-${item.label}`}
                        href={item.href}
                        className={`group relative flex h-9 items-center gap-2.5 rounded-md border px-2.5 text-sm font-medium transition-colors ${isSidebarCollapsed ? "justify-center" : ""}`}
                        style={{
                          borderColor: isActive ? "color-mix(in srgb, var(--accent) 18%, var(--border))" : "transparent",
                          backgroundColor: isActive ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                          color: isActive ? "var(--text)" : "var(--muted-text)",
                          boxShadow: isActive ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent)" : "none",
                        }}
                        onMouseEnter={(event) => {
                          if (!isActive) {
                            event.currentTarget.style.backgroundColor = "var(--muted-bg)";
                            event.currentTarget.style.color = "var(--text)";
                          }
                        }}
                        onMouseLeave={(event) => {
                          if (!isActive) {
                            event.currentTarget.style.backgroundColor = "transparent";
                            event.currentTarget.style.color = "var(--muted-text)";
                          }
                        }}
                        aria-label={item.label}
                        aria-current={isActive ? "page" : undefined}
                        title={isSidebarCollapsed ? item.label : undefined}
                      >
                        {isActive && !isSidebarCollapsed ? (
                          <span className="absolute left-0 top-2 h-5 w-0.5 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                        ) : null}
                        <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                        {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            className={`flex h-9 w-full items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-[color:var(--muted-bg)] ${isSidebarCollapsed ? "justify-center" : "justify-start"}`}
            style={{ borderColor: "var(--border)", color: "var(--muted-text)", backgroundColor: "transparent" }}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={isSidebarCollapsed ? "chevronRight" : "chevronLeft"} className="h-4 w-4" />
            {!isSidebarCollapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
