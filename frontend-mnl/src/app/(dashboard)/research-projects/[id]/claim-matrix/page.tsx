"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ClaimMatrixSummaryCards, ClaimMatrixTable } from "@/components/claim-matrix";
import { claimMatrixApi, apiClient } from "@/services";
import type { ClaimMatrixEntry, ClaimMatrixSummary } from "@/types/claimMatrix";
import { LoadingState, ErrorState, ActionButtonGroup, ActionButton } from "@/components/ui";

interface ClaimMatrixPageProps {
  params: {
    id: string;
  };
}

export default function ClaimMatrixPage({ params }: ClaimMatrixPageProps) {
  const [project, setProject] = useState<any>(null);
  const [summary, setSummary] = useState<ClaimMatrixSummary | null>(null);
  const [claims, setClaims] = useState<ClaimMatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = params.id;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch project for the header name
        const projRes = await apiClient.get<any>(`/projects/${projectId}`);
        if (projRes.success && projRes.data) {
          setProject(projRes.data);
        }

        // Fetch summary
        const summaryRes = await claimMatrixApi.getProjectClaimMatrixSummary(projectId);
        if (summaryRes.success && summaryRes.data) {
          setSummary(summaryRes.data);
        }

        // Fetch claims
        const claimsRes = await claimMatrixApi.getProjectClaimMatrix(projectId);
        if (claimsRes.success && claimsRes.data) {
          setClaims(claimsRes.data.items);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load claim matrix data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  if (loading) {
    return <LoadingState message="Loading claim matrix..." />;
  }

  if (error) {
    return <ErrorState title="Failed to load claims" explanation={error} />;
  }

  return (
    <div className="page-shell ui-fade-in flex flex-col gap-0 pb-10">
      <header className="mb-8 space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/50">
              <Link href={`/research-projects/${projectId}`} className="hover:text-accent transition-colors">
                {project ? project.name : "Project Overview"}
              </Link>
              <span className="opacity-30">/</span>
              <span className="text-accent/80">Claim Matrix</span>
            </div>
            
            <h1 className="text-2xl font-black tracking-tight text-text md:text-3xl">
              Scientific Claim Matrix
            </h1>
            
            <p className="text-[12px] font-medium text-muted-text/80 leading-relaxed max-w-2xl mt-2">
              Review and validate AI-generated scientific claims regarding molecular efficacy, safety profiles, and novelty for the candidates in this research project.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <ActionButtonGroup>
              <ActionButton 
                label="Refresh Data" 
                onClick={() => window.location.reload()}
                icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} 
              />
            </ActionButtonGroup>
          </div>
        </div>
      </header>

      {summary && <ClaimMatrixSummaryCards summary={summary} />}
      
      <ClaimMatrixTable claims={claims} />
    </div>
  );
}
