"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { GNINAMetricsCards, GNINARankingTable } from "@/components/gnina";
import { apiClient } from "@/services";
import type { GninaResult } from "@/types/api";
import { LoadingState, ErrorState, ActionButtonGroup, ActionButton } from "@/components/ui";

interface GNINAPageProps {
  params: {
    projectId: string;
  };
}

export default function GNINAPage({ params }: GNINAPageProps) {
  const [project, setProject] = useState<any>(null);
  const [gninaResults, setGninaResults] = useState<GninaResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = params.projectId;

  const fetchGninaData = async () => {
    try {
      setLoading(true);
      setError(null);

      const projRes = await apiClient.get<any>(`/projects/${projectId}`);
      if (projRes.success && projRes.data) {
        setProject(projRes.data);
      }

      const gninaRes = await apiClient.get<any>(`/projects/${projectId}/gnina/results`);
      
      if (gninaRes.success && gninaRes.data?.items) {
        const normalized = (gninaRes.data.items as any[]).map((item, index) => {
          return {
            molecule_id: String(item.molecule_id ?? item.id ?? item.candidate_id ?? `gnina-${index + 1}`),
            cnn_score: Number(item.cnn_score ?? item.score ?? 0),
            cnn_affinity: Number(item.cnn_affinity ?? item.affinity ?? 0),
            vina_score: Number(item.vina_score ?? item.vina ?? item.binding_energy ?? 0),
            pose_evidence: String(item.pose_evidence ?? item.evidence ?? item.pose_download_url ?? item.pose_file_id ?? "Pose verified"),
          } as GninaResult;
        });
        setGninaResults(normalized);
      } else {
        setGninaResults([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load GNINA data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGninaData();
  }, [projectId]);

  if (loading) {
    return <LoadingState message="Loading GNINA CNN results..." />;
  }

  if (error) {
    return <ErrorState title="Failed to load GNINA data" explanation={error} />;
  }

  return (
    <div className="page-shell ui-fade-in flex flex-col gap-0 pb-10">
      <header className="mb-8 space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/50">
              <Link href={`/projects/${projectId}`} className="hover:text-accent transition-colors">
                {project ? project.name : "Project Overview"}
              </Link>
              <span className="opacity-30">/</span>
              <span className="text-accent/80">GNINA Rescoring</span>
            </div>
            
            <h1 className="text-2xl font-black tracking-tight text-text md:text-3xl">
              GNINA CNN Rescoring
            </h1>
            
            <p className="text-[12px] font-medium text-muted-text/80 leading-relaxed max-w-2xl mt-2">
              Review convolutional neural network (CNN) predictions for protein-ligand binding affinity and pose evidence. Filter and analyze highest confidence hits prior to quantum reranking.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <ActionButtonGroup>
              <ActionButton 
                label="Refresh Data" 
                onClick={fetchGninaData}
                icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} 
              />
            </ActionButtonGroup>
          </div>
        </div>
      </header>

      <GNINAMetricsCards items={gninaResults} />
      
      <GNINARankingTable items={gninaResults} projectId={projectId} />
    </div>
  );
}
