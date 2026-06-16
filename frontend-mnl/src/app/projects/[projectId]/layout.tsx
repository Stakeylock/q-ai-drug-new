import type { ReactNode } from "react";
import { ProjectLayout } from "@/components/layout";

type ProjectRouteParams = Promise<{ projectId: string }>;

export default async function ProjectRouteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: ProjectRouteParams;
}) {
  const { projectId } = await params;

  return (
    <ProjectLayout projectId={projectId}>
      {children}
    </ProjectLayout>
  );
}
