import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound } from "@/lib/api/respond";

type Params = { params: Promise<{ id: string }> };

// Workspace-wide activity feed for the Overview page — the per-dataset
// change log (see /api/datasets/[id]/changes) joined across every dataset
// in this workspace, newest first. Read-only: undo/redo/revert stay scoped
// to a single dataset (src/lib/change-log.ts), this is just "what happened".
export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound("Workspace");

  const changes = await prisma.datasetChangeLog.findMany({
    where: { dataset: { workspaceId: id } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      action: true,
      summary: true,
      undone: true,
      createdAt: true,
      datasetId: true,
      dataset: { select: { filename: true } },
    },
  });

  return NextResponse.json({
    changes: changes.map(({ dataset, ...c }) => ({ ...c, datasetFilename: dataset.filename })),
  });
});
