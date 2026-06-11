import VisualizationView from "@/components/views/VisualizationView";

export default function ProjectVisualizationPage({ params }: { params: { projectId: string } }) {
  return <VisualizationView projectId={params.projectId} />;
}
