import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound, ApiError } from "@/lib/api/respond";
import { redoLastChange } from "@/lib/change-log";
import { logActivity } from "@/lib/activity/log";

type Params = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const dataset = await prisma.dataset.findUnique({ where: { id } });
  if (!dataset) notFound("Dataset");

  const log = await prisma.$transaction((tx) => redoLastChange(tx, id));
  if (!log) throw new ApiError(409, "Nothing to redo.");
  await logActivity({
    workspaceId: dataset.workspaceId,
    category: "history",
    action: "change.redone",
    summary: `Redid: ${log.summary}`,
    dataset: { id, name: dataset.filename },
  });

  return NextResponse.json({ redone: { id: log.id, action: log.action, summary: log.summary } });
});
