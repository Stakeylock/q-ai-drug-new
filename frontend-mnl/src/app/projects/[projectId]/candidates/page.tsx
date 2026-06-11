"use client";

import MoleculesView from "@/components/views/MoleculesView";

interface PageProps {
  params: {
    projectId: string;
  };
}

export default function CandidatesPage({ params }: PageProps) {
  return <MoleculesView projectId={params.projectId} />;
}
