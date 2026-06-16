import VisualizationView from "@/components/views/VisualizationView";

type PageParams = Promise<{ projectId: string }>;

export default async function ProjectVisualizationPage({ params }: { params: PageParams }) {
  const { projectId } = await params;

  return <VisualizationView projectId={projectId} />;
}
