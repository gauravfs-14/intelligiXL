import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { DatasetProvider } from "@/components/workspace/dataset-context";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) notFound();

  return (
    <DatasetProvider workspaceId={workspaceId}>
      <div className="flex min-h-screen flex-col">
        <WorkspaceNav workspaceId={workspaceId} workspaceName={workspace.name} />
        <main className="flex-1">{children}</main>
      </div>
    </DatasetProvider>
  );
}
