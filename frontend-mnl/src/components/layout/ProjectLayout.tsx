"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle, PharmaAssistantWidget } from "@/components/shared";
import { BackendStatusBanner, ConnectionHealthIndicator } from "@/components/ui";
import { ProjectSidebar } from "./ProjectSidebar";
import { ProjectBreadcrumbs } from "./ProjectBreadcrumbs";
import { isAuthenticated, removeToken, apiClient } from "@/services";

export function ProjectLayout({ 
  children,
  projectId
}: { 
  children: ReactNode;
  projectId: string;
}) {
  const router = useRouter();
  const [canAccess, setCanAccess] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [userInfo, setUserInfo] = useState<{ full_name: string; email: string } | null>(null);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string>("Research Workspace");
  const [activeWorkspaceRole, setActiveWorkspaceRole] = useState<string>("member");
  const [projectName, setProjectName] = useState<string>("Loading Project...");

  const handleLogout = () => {
    removeToken();
    router.replace("/login");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setCanAccess(true);

    const fetchUserAndWorkspaces = async () => {
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
        }
      } catch (err) {
        console.error("Failed to load user session context:", err);
      }
    };

    const fetchProjectDetails = async () => {
      try {
        const res = await apiClient.get<any>(`/projects/${projectId}`);
        if (res.success && res.data) {
          setProjectName(res.data.name);
        } else {
          setProjectName("Project " + projectId.slice(0, 8));
        }
      } catch (err) {
        setProjectName("Project " + projectId.slice(0, 8));
      }
    };

    fetchUserAndWorkspaces();
    fetchProjectDetails();
  }, [router, projectId]);

  if (!canAccess || !mounted) {
    return <div className="min-h-screen" style={{ background: "var(--bg)" }} />;
  }

  return (
    <div className="h-screen overflow-hidden aurora-bg relative" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Cinematic grid mesh background overlay */}
      <div className="absolute inset-0 bg-grid-noise pointer-events-none opacity-30 z-0" aria-hidden="true" />

      <ProjectSidebar 
        projectId={projectId}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        activeWorkspaceName={activeWorkspaceName}
        activeWorkspaceRole={activeWorkspaceRole}
      />

      <div className="relative z-10 flex h-screen min-w-0 flex-col transition-[padding] duration-200 lg:pl-64" style={{ paddingLeft: isSidebarCollapsed ? "5rem" : undefined }}>
        <header
          className="z-30 shrink-0 border-b backdrop-blur-xl"
          style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 92%, transparent)" }}
        >
          <div className="grid min-h-[56px] grid-cols-1 items-center gap-3 px-4 py-2 sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,1fr)_auto] lg:px-8">
            
            <ProjectBreadcrumbs projectName={projectName} projectId={projectId} />

            <label
              className="hidden h-9 min-w-0 items-center gap-2 rounded-lg border px-3 lg:flex"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-text)" }}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                type="search"
                placeholder={`Search within ${projectName}...`}
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
                Project Active
              </span>

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-md border transition-colors hover:bg-[color:var(--muted-bg)]"
                style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}
                aria-label="Notifications"
                title="Notifications"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
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
                  <svg className="hidden h-3.5 w-3.5 xl:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
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
        </header>

        <BackendStatusBanner />

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 lg:px-10">
          {children}
        </main>
        
        <PharmaAssistantWidget />
      </div>
    </div>
  );
}
