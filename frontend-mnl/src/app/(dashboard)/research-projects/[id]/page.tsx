import ProjectOverviewView from "@/components/views/ProjectOverviewView";

type PageParams = Promise<{ id: string }>;

export default async function ProjectDetailPage({ params }: { params: PageParams }) {
  const { id } = await params;

  return <ProjectOverviewView projectId={id} />;
}
