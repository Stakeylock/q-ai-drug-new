"use client";

import ProjectOverviewView from "@/components/views/ProjectOverviewView";

interface PageProps {
  params: {
    projectId: string;
  };
}

export default function OverviewPage({ params }: PageProps) {
  return <ProjectOverviewView projectId={params.projectId} />;
}
