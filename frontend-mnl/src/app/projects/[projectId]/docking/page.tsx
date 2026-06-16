import DockingView from "@/components/views/DockingView";

type PageParams = Promise<{ projectId: string }>;

export default async function DockingPage({ params }: { params: PageParams }) {
  const { projectId } = await params;

  return <DockingView projectId={projectId} />;
}
