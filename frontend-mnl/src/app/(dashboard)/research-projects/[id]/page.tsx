"use client";

import ProjectOverviewView from "@/components/views/ProjectOverviewView";

interface ProjectDetailProps {
  params: {
    id: string;
  };
}

export default function ProjectDetailPage({ params }: ProjectDetailProps) {
  return <ProjectOverviewView projectId={params.id} />;
}
