"use client";

import ProjectOverviewView from "@/components/views/ProjectOverviewView";

interface PageProps {
  params: {
    projectId: string;
  };
}

export default function ProjectDashboardPage({ params }: PageProps) {
  return <ProjectOverviewView projectId={params.projectId} />;
}
