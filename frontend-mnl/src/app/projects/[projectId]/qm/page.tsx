import QMView from "@/components/views/QMView";

type PageParams = Promise<{ projectId: string }>;

export default async function QMPage({ params }: { params: PageParams }) {
  const { projectId } = await params;

  return <QMView projectId={projectId} />;
}
