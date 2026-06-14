"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkspaceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const activeProjectId = localStorage.getItem("active_project_id");
      if (activeProjectId) {
        router.replace(`/research-projects/${activeProjectId}`);
      } else {
        router.replace("/research-projects");
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
          Loading active workspace...
        </span>
      </div>
    </div>
  );
}
