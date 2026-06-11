"use client";

import DockingView from "@/components/views/DockingView";

interface PageProps {
  params: {
    projectId: string;
  };
}

export default function DockingPage({ params }: PageProps) {
  return <DockingView projectId={params.projectId} />;
}
