import type { ReactNode } from "react";
import { ProjectLayout } from "@/components/layout";

export default function ProjectRouteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { projectId: string };
}) {
  return (
    <ProjectLayout projectId={params.projectId}>
      {children}
    </ProjectLayout>
  );
}
