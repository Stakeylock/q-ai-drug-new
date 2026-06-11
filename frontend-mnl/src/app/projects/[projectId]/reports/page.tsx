import ReportsView from "@/components/views/ReportsView";

export default function ProjectReportsPage({ params }: { params: { projectId: string } }) {
  return <ReportsView projectId={params.projectId} />;
}
