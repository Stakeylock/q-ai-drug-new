"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, Suspense } from "react";

import { isAuthenticated, removeToken, apiClient, isDemoMode } from "@/services";
import { ThemeToggle, PharmaAssistantWidget } from "@/components/shared";
import { BackendStatusBanner, ConnectionHealthIndicator } from "@/components/ui";
import logo from "../../../public/logo.png";

type IconName =
  | "activity"
  | "archive"
  | "atom"
  | "bell"
  | "blocks"
  | "box"
  | "brain"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "circleGauge"
  | "cloud"
  | "code"
  | "database"
  | "fileText"
  | "flask"
  | "folderKanban"
  | "link"
  | "network"
  | "orbit"
  | "plug"
  | "receipt"
  | "search"
  | "settings"
  | "shieldCheck"
  | "sparkles"
  | "target"
  | "users"
  | "workflow";

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

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "circleGauge" },
      { label: "Investor Hub", href: "/investor", icon: "sparkles" },
      { label: "Research Projects", href: "/research-projects", icon: "folderKanban" },
      { label: "Experiments", href: "/dashboard/history", icon: "flask" },
      { label: "Reports", href: "/results", icon: "fileText" },
    ],
  },
  {
    label: "Research",
    items: [
      { label: "Targets", href: "/targets", icon: "target" },
      { label: "Molecules", href: "/molecules", icon: "atom" },
      { label: "Docking", href: "/docking", icon: "network" },
      { label: "GNINA", href: "/docking?engine=gnina", icon: "brain", matchHref: "/gnina" },
      { label: "Quantum", href: "/quantum", icon: "orbit" },
      { label: "Simulations", href: "/simulation", icon: "activity" },
      { label: "ADMET", href: "/validation?panel=admet", icon: "shieldCheck" },
    ],
  },
  {
    label: "Visualization",
    items: [
      { label: "3D Viewer", href: "/visualization", icon: "box" },
      { label: "Chemical Space", href: "/chemical-space", icon: "workflow" },
      { label: "Similarity", href: "/similarity", icon: "link" },
    ],
  },
  {
    label: "AI",
    items: [
      { label: "Models", href: "/models", icon: "blocks" },
      { label: "Pharma LLM", href: "/copilot", icon: "sparkles" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { label: "Compute", href: "/settings?section=compute", icon: "cloud", matchHref: "/compute" },
      { label: "Storage", href: "/settings?section=storage", icon: "database", matchHref: "/storage" },
      { label: "API", href: "/settings?section=api", icon: "code", matchHref: "/api" },
      { label: "Integrations", href: "/settings?section=integrations", icon: "plug", matchHref: "/integrations" },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Team", href: "/settings?section=team", icon: "users", matchHref: "/team" },
      { label: "Billing", href: "/settings?section=billing", icon: "receipt", matchHref: "/billing" },
      { label: "Audit Logs", href: "/settings?section=audit", icon: "archive", matchHref: "/audit-logs" },
      { label: "Settings", href: "/settings", icon: "settings" },
    ],
  },
];

const PAGE_CONTEXTS: Array<{ href: string; title: string; breadcrumb: string }> = [
  { href: "/dashboard/history", title: "Experiment History", breadcrumb: "Research Projects / Pipeline history" },
  { href: "/research-projects", title: "Research Projects", breadcrumb: "QuDrugForge™ / Research Projects" },
  { href: "/investor", title: "Investor Hub", breadcrumb: "Research OS / Investor Pitch" },
  { href: "/results", title: "Reports", breadcrumb: "Reports / Candidate evidence packages" },
  { href: "/targets", title: "Targets", breadcrumb: "Research / Target intelligence" },
  { href: "/molecules", title: "Molecules", breadcrumb: "Research / Molecular library" },
  { href: "/docking", title: "Docking", breadcrumb: "Research / Docking and GNINA" },
  { href: "/quantum", title: "Quantum", breadcrumb: "Research / Quantum scoring" },
  { href: "/simulation", title: "Simulations", breadcrumb: "Research / Molecular dynamics" },
  { href: "/validation", title: "ADMET", breadcrumb: "Research / Validation and ADMET" },
  { href: "/visualization", title: "3D Viewer", breadcrumb: "Research / 3D structural discovery" },
  { href: "/chemical-space", title: "Chemical Space", breadcrumb: "Research / Spatial intelligence" },
  { href: "/similarity", title: "Similarity", breadcrumb: "Research / Structural similarity" },
  { href: "/models", title: "Models", breadcrumb: "AI / Model registry" },
  { href: "/copilot", title: "Pharma LLM", breadcrumb: "AI / Literature and workflow assistant" },
  { href: "/settings", title: "Settings", breadcrumb: "Organization / Platform controls" },
  { href: "/dashboard", title: "Dashboard", breadcrumb: "Research OS / Oncology Division" },
];

const MOBILE_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

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
    receipt: <><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-3 2-3-2-3 2-3-2-3 2Z" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></>,
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

function ResearchContextBar() {
  return (
    <div 
      className="shrink-0 border-b px-6 py-2 flex items-center justify-between gap-6"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div className="flex items-center gap-6 min-w-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Active Project</span>
          <h2 className="text-sm font-black text-text truncate">EGFR NSCLC Discovery Program</h2>
        </div>
        
        <div className="h-8 w-px bg-border/40 hidden md:block" />
        
        <div className="hidden md:flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Disease / Target</span>
          <span className="text-[11px] font-bold text-text/80 truncate">Lung Cancer / EGFR (P00533)</span>
        </div>

        <div className="h-8 w-px bg-border/40 hidden lg:block" />

        <div className="hidden lg:flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Current Stage</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-text/80 truncate">Docking & Quantum Reranking</span>
            <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          </div>
        </div>

        <div className="h-8 w-px bg-border/40 hidden xl:block" />

        <div className="hidden xl:flex flex-col w-32">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Progress</span>
            <span className="text-[9px] font-black text-accent">68%</span>
          </div>
          <div className="h-1 w-full bg-border/20 rounded-full overflow-hidden">
            <div className="h-full bg-accent" style={{ width: '68%' }} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link 
          href="/research-projects"
          className="hidden sm:flex items-center gap-2 rounded border border-border/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-text hover:text-text hover:border-border transition-all"
        >
          Switch Project
        </Link>
        <button className="flex items-center gap-2 rounded bg-accent px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-bg hover:bg-accent/90 transition-all shadow-lg shadow-accent/10">
          Run Pipeline
        </button>
        <button className="hidden sm:flex h-8 w-8 items-center justify-center rounded border border-border/40 text-muted-text hover:text-text transition-all" title="Generate Report">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 10-8 0v2a2 2 0 002 2h4a2 2 0 002-2zm3-9a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>
        </button>
      </div>
    </div>
  );
}

function isRouteActive(pathname: string, href: string, currentSearch: string = "") {
  const [baseHref, search] = href.split("?");
  
  // If there's a search string in the target href, it must match the current search exactly for a specific section
  if (search) {
    return pathname === baseHref && currentSearch.includes(search);
  }
  
  // Standard base route matching
  return pathname === baseHref || (baseHref !== "/" && pathname.startsWith(`${baseHref}/`));
}

function isSidebarItemActive(pathname: string, currentSearch: string, label: string): boolean {
  const normPath = pathname.toLowerCase().replace(/\/$/, "");
  const normSearch = currentSearch.toLowerCase();

  switch (label) {
    case "Dashboard":
      return normPath === "/dashboard";
    case "Investor Hub":
      return normPath === "/investor" || normPath.startsWith("/investor/");
    case "Research Projects":
      return normPath === "/research-projects" || 
             normPath.startsWith("/research-projects/") || 
             normPath === "/projects" || 
             normPath.startsWith("/projects/");
    case "Experiments":
      return normPath === "/dashboard/history" || 
             normPath.startsWith("/dashboard/history/") || 
             normPath === "/experiments" || 
             normPath.startsWith("/experiments/");
    case "Reports":
      return normPath === "/results" || 
             normPath.startsWith("/results/") || 
             normPath === "/reports" || 
             normPath.startsWith("/reports/");
    case "Targets":
      return normPath === "/targets" || normPath.startsWith("/targets/");
    case "Molecules":
      return normPath === "/molecules" || normPath.startsWith("/molecules/");
    case "Docking":
      return (normPath === "/docking" || normPath.startsWith("/docking/")) && !normSearch.includes("engine=gnina");
    case "GNINA":
      return normPath === "/gnina" || 
             normPath.startsWith("/gnina/") || 
             ((normPath === "/docking" || normPath.startsWith("/docking/")) && normSearch.includes("engine=gnina"));
    case "Quantum":
      return normPath === "/quantum" || normPath.startsWith("/quantum/");
    case "Simulations":
      return normPath === "/simulation" || 
             normPath.startsWith("/simulation/") || 
             normPath === "/simulations" || 
             normPath.startsWith("/simulations/");
    case "ADMET":
      return normPath === "/admet" || 
             normPath.startsWith("/admet/") || 
             normPath === "/validation" || 
             normPath.startsWith("/validation/") ||
             ((normPath === "/validation" || normPath.startsWith("/validation/")) && normSearch.includes("panel=admet"));
    case "3D Viewer":
      return normPath === "/visualization" || 
             normPath.startsWith("/visualization/") || 
             normPath === "/3d-viewer" || 
             normPath.startsWith("/3d-viewer/") || 
             normPath === "/viewer" || 
             normPath.startsWith("/viewer/");
    case "Chemical Space":
      return normPath === "/chemical-space" || normPath.startsWith("/chemical-space/");
    case "Similarity":
      return normPath === "/similarity" || normPath.startsWith("/similarity/");
    case "Models":
      return normPath === "/models" || normPath.startsWith("/models/");
    case "Pharma LLM":
      return normPath === "/copilot" || 
             normPath.startsWith("/copilot/") || 
             normPath === "/pharma-llm" || 
             normPath.startsWith("/pharma-llm/");
    case "Compute":
      return normPath === "/compute" || 
             normPath.startsWith("/compute/") || 
             (normPath === "/settings" && normSearch.includes("section=compute"));
    case "Storage":
      return normPath === "/storage" || 
             normPath.startsWith("/storage/") || 
             (normPath === "/settings" && normSearch.includes("section=storage"));
    case "API":
      return normPath === "/api" || 
             normPath.startsWith("/api/") || 
             (normPath === "/settings" && normSearch.includes("section=api"));
    case "Integrations":
      return normPath === "/integrations" || 
             normPath.startsWith("/integrations/") || 
             (normPath === "/settings" && normSearch.includes("section=integrations"));
    case "Team":
      return normPath === "/team" || 
             normPath.startsWith("/team/") || 
             (normPath === "/settings" && normSearch.includes("section=team"));
    case "Billing":
      return normPath === "/billing" || 
             normPath.startsWith("/billing/") || 
             (normPath === "/settings" && normSearch.includes("section=billing"));
    case "Audit Logs":
      return normPath === "/audit" || 
             normPath === "/audit-logs" || 
             normPath.startsWith("/audit-logs/") || 
             (normPath === "/settings" && normSearch.includes("section=audit"));
    case "Settings":
      return normPath === "/settings" && !normSearch.includes("section=");
    default:
      return false;
  }
}

function getPageContext(pathname: string) {
  return PAGE_CONTEXTS.find((item) => isRouteActive(pathname, item.href)) ?? PAGE_CONTEXTS[PAGE_CONTEXTS.length - 1];
}

function DashboardLayoutContent({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const router = useRouter();
  const [canAccess, setCanAccess] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const pageContext = useMemo(() => getPageContext(pathname), [pathname]);

  const [userInfo, setUserInfo] = useState<{ full_name: string; email: string } | null>(null);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string>("Research Workspace");
  const [activeWorkspaceRole, setActiveWorkspaceRole] = useState<string>("member");

  const handleLogout = () => {
    removeToken();
    router.replace("/login");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const showContextBar = useMemo(() => {
    const contextRoutes = [
      "/research-projects",
      "/targets",
      "/molecules",
      "/docking",
      "/quantum",
      "/simulation",
      "/validation",
      "/visualization",
      "/chemical-space",
      "/similarity"
    ];
    return contextRoutes.some(route => pathname.startsWith(route));
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    const fetchUserAndWorkspaces = async () => {
      if (isDemoMode()) {
        setUserInfo({ full_name: "Research User", email: "demo@qudrugforge.com" });
        const localWsName = localStorage.getItem("active_workspace_name");
        setActiveWorkspaceName(localWsName || "Oncology Research Workspace");
        setActiveWorkspaceRole("owner");
        setCanAccess(true);
        return;
      }
      try {
        const res = await apiClient.get<any>("/auth/me");
        if (res.success && res.data) {
          const user = res.data.user;
          setUserInfo({ full_name: user.full_name, email: user.email });

          const localWsId = localStorage.getItem("active_workspace_id");
          const workspaces = res.data.workspaces || [];
          const activeWs = workspaces.find((w: any) => w.id === localWsId) || workspaces[0];

          if (activeWs) {
            setActiveWorkspaceName(activeWs.name);
            setActiveWorkspaceRole(activeWs.role);
            localStorage.setItem("active_workspace_id", activeWs.id);
            localStorage.setItem("active_workspace_name", activeWs.name);
          }
          setCanAccess(true);
        }
      } catch (err: any) {
        console.error("Failed to load user session context:", err);
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        const isMockToken = token && (!token.includes(".") || token.startsWith("mock-") || token.startsWith("e2e-"));
        if (isMockToken) {
          setCanAccess(true);
        } else if (err && (err.status === 401 || err.message?.includes("401"))) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("active_workspace_id");
          localStorage.removeItem("active_workspace_name");
          localStorage.removeItem("active_project_id");
          router.replace("/login");
        }
      }
    };

    fetchUserAndWorkspaces();
  }, [router]);

  if (!canAccess || !mounted) {
    return <div className="min-h-screen" style={{ background: "var(--bg)" }} />;
  }

  return (
    <div className="h-screen overflow-hidden aurora-bg relative" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Cinematic grid mesh background overlay */}
      <div className="absolute inset-0 bg-grid-noise pointer-events-none opacity-30 z-0" aria-hidden="true" />

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
                      {activeWorkspaceName}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] capitalize" style={{ color: "var(--muted-text)" }}>
                      {activeWorkspaceRole} Division
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

      <div className="relative z-10 flex h-screen min-w-0 flex-col transition-[padding] duration-200 lg:pl-64" style={{ paddingLeft: isSidebarCollapsed ? "5rem" : undefined }}>
        <header
          className="z-30 shrink-0 border-b backdrop-blur-xl"
          style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 92%, transparent)" }}
        >
          <div className="grid min-h-[56px] grid-cols-1 items-center gap-3 px-4 py-2 sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,1fr)_auto] lg:px-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--muted-text)" }}>
                <span>{pageContext.breadcrumb.split(" / ")[0]}</span>
                <Icon name="chevronRight" className="h-2.5 w-2.5 opacity-40" />
                <span>{pageContext.breadcrumb.split(" / ").slice(1).join(" / ")}</span>
              </div>
              <h1 className="mt-0.5 truncate text-base font-bold tracking-tight" style={{ color: "var(--text)" }}>
                {pageContext.title}
              </h1>
            </div>

            <label
              className="hidden h-9 min-w-0 items-center gap-2 rounded-lg border px-3 lg:flex"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-text)" }}
            >
              <Icon name="search" className="h-4 w-4 shrink-0" />
              <input
                type="search"
                placeholder="Search molecules, targets, reports..."
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--muted-text)]"
                style={{ color: "var(--text)" }}
              />
            </label>

            <div className="flex shrink-0 items-center gap-2 lg:justify-end">
              <span
                className="hidden h-8 items-center rounded-full border px-3 text-xs font-medium md:inline-flex"
                style={{
                  borderColor: "color-mix(in srgb, var(--success) 20%, var(--border))",
                  background: "color-mix(in srgb, var(--success) 7%, transparent)",
                  color: "var(--text)",
                }}
              >
                EGFR NSCLC active
              </span>

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-md border transition-colors hover:bg-[color:var(--muted-bg)]"
                style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}
                aria-label="Notifications"
                title="Notifications"
              >
                <Icon name="bell" className="h-4 w-4" />
              </button>

              <ConnectionHealthIndicator />
              <ThemeToggle />

              <details className="group relative">
                <summary
                  className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border px-2.5 transition-colors hover:bg-[color:var(--muted-bg)] [&::-webkit-details-marker]:hidden"
                  style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}
                  aria-label="User profile"
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{ background: "var(--accent)", color: "var(--bg)" }}
                  >
                    {userInfo?.full_name
                      ? userInfo.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                      : "RU"}
                  </span>
                  <span className="hidden text-sm font-medium xl:inline">
                    {userInfo?.full_name || "Research User"}
                  </span>
                  <Icon name="chevronDown" className="hidden h-3.5 w-3.5 xl:block" />
                </summary>
                <div
                  className="absolute right-0 mt-2 w-48 rounded-lg border p-2 shadow-lg"
                  style={{ borderColor: "var(--border)", background: "var(--card)" }}
                >
                  <div className="px-2 py-2">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                      {userInfo?.full_name || "Research User"}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--muted-text)" }}>
                      {activeWorkspaceName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-[color:var(--muted-bg)]"
                    style={{ color: "var(--text)" }}
                  >
                    Logout
                  </button>
                </div>
              </details>
            </div>
          </div>

          <div className="border-t px-4 py-2 lg:hidden" style={{ borderColor: "var(--border)" }}>
            <label
              className="flex h-9 items-center gap-2 rounded-md border px-3"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-text)" }}
            >
              <Icon name="search" className="h-4 w-4 shrink-0" />
              <input
                type="search"
                placeholder="Search molecules, targets, reports..."
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--muted-text)]"
                style={{ color: "var(--text)" }}
              />
            </label>
          </div>

          <nav className="border-t px-4 py-1.5 lg:hidden" style={{ borderColor: "var(--border)" }} aria-label="Mobile navigation">
            <div className="flex gap-2 overflow-x-auto">
              {MOBILE_NAV_ITEMS.map((item) => {
                const isActive = isSidebarItemActive(pathname, currentSearch, item.label);

                return (
                  <Link
                    key={`mobile-${item.label}`}
                    href={item.href}
                    className="flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors"
                    style={{
                      borderColor: isActive ? "color-mix(in srgb, var(--accent) 24%, var(--border))" : "var(--border)",
                      background: isActive ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--card)",
                      color: isActive ? "var(--text)" : "var(--muted-text)",
                    }}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon name={item.icon} className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </header>

        {showContextBar && <ResearchContextBar />}
        <BackendStatusBanner />

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 lg:px-10">
          {children}
        </main>
        <PharmaAssistantWidget />
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--bg)" }} />}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
