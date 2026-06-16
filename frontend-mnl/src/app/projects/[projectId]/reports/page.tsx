import ReportsView from "@/components/views/ReportsView";

type PageParams = Promise<{ projectId: string }>;

export default async function ProjectReportsPage({ params }: { params: PageParams }) {
  const { projectId } = await params;

  return <ReportsView projectId={projectId} />;
}
