import ProjectOverviewView from "@/components/views/ProjectOverviewView";

type PageParams = Promise<{ projectId: string }>;

export default async function OverviewPage({ params }: { params: PageParams }) {
  const { projectId } = await params;

  return <ProjectOverviewView projectId={projectId} />;
}
