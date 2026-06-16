import MoleculesView from "@/components/views/MoleculesView";

type PageParams = Promise<{ projectId: string }>;

export default async function CandidatesPage({ params }: { params: PageParams }) {
  const { projectId } = await params;

  return <MoleculesView projectId={projectId} />;
}
