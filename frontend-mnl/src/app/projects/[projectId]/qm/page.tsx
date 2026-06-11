"use client";

import QMView from "@/components/views/QMView";

interface PageProps {
  params: {
    projectId: string;
  };
}

export default function QMPage({ params }: PageProps) {
  return <QMView projectId={params.projectId} />;
}
