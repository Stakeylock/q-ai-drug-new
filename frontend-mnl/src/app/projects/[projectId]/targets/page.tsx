import TargetsView from "@/components/views/TargetsView";

export default function ProjectTargetsPage({ params }: { params: { projectId: string } }) {
  return <TargetsView projectId={params.projectId} />;
}
