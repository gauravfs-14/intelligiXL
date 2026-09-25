import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { DatasetProvider } from "@/components/workspace/dataset-context";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) notFound();

  return (
    <DatasetProvider workspaceId={workspaceId}>
      <WorkspaceShell workspaceId={workspaceId} workspaceName={workspace.name}>
        {children}
      </WorkspaceShell>
    </DatasetProvider>
  );
}
