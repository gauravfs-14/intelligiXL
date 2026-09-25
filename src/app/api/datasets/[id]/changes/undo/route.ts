import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound, ApiError } from "@/lib/api/respond";
import { undoLastChange } from "@/lib/change-log";
import { logActivity } from "@/lib/activity/log";

type Params = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const dataset = await prisma.dataset.findUnique({ where: { id } });
  if (!dataset) notFound("Dataset");

  const log = await prisma.$transaction((tx) => undoLastChange(tx, id));
  if (!log) throw new ApiError(409, "Nothing to undo.");
  await logActivity({
    workspaceId: dataset.workspaceId,
    category: "history",
    action: "change.undone",
    summary: `Undid: ${log.summary}`,
    dataset: { id, name: dataset.filename },
  });

  return NextResponse.json({ undone: { id: log.id, action: log.action, summary: log.summary } });
});
