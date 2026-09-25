import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound } from "@/lib/api/respond";

type Params = { params: Promise<{ id: string }> };

// Recent change-log entries for the "what changed" panel — newest first,
// capped since a long editing session shouldn't make this list unbounded.
export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const dataset = await prisma.dataset.findUnique({ where: { id } });
  if (!dataset) notFound("Dataset");

  const [changes, canUndoCount, canRedoCount] = await Promise.all([
    prisma.datasetChangeLog.findMany({
      where: { datasetId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, action: true, summary: true, undone: true, createdAt: true },
    }),
    prisma.datasetChangeLog.count({ where: { datasetId: id, undone: false } }),
    prisma.datasetChangeLog.count({ where: { datasetId: id, undone: true } }),
  ]);

  return NextResponse.json({ changes, canUndo: canUndoCount > 0, canRedo: canRedoCount > 0 });
});
