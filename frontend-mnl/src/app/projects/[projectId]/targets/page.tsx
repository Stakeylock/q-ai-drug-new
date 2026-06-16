import TargetsView from "@/components/views/TargetsView";

type PageParams = Promise<{ projectId: string }>;

export default async function ProjectTargetsPage({ params }: { params: PageParams }) {
  const { projectId } = await params;

  return <TargetsView projectId={projectId} />;
}
