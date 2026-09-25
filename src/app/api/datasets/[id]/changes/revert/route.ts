import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound, ApiError } from "@/lib/api/respond";
import { undoLastChange } from "@/lib/change-log";
import { datasetRef, logActivity, plural } from "@/lib/activity/log";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ changeId: z.string().min(1) });

// "Revert to here" — undoes every not-yet-undone entry newer than (and
// including) the target, in one request. Just a loop over undoLastChange:
// each step is exactly what a single Undo click would do, applied repeatedly.
export const POST = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const { changeId } = bodySchema.parse(await req.json());

  const target = await prisma.datasetChangeLog.findFirst({ where: { id: changeId, datasetId: id } });
  if (!target) notFound("Change");
  if (target.undone) throw new ApiError(409, "That change is already undone.");

  const undone = await prisma.$transaction(async (tx) => {
    const steps: { id: string; summary: string }[] = [];
    for (let i = 0; i < 500; i++) {
      const log = await undoLastChange(tx, id);
      if (!log) break;
      steps.push({ id: log.id, summary: log.summary });
      if (log.id === changeId) break;
    }
    if (steps[steps.length - 1]?.id !== changeId) throw new ApiError(409, "Couldn't revert to that point.");
    return steps;
  });

  const ref = await datasetRef(id);
  if (ref) {
    await logActivity({
      ...ref,
      category: "history",
      action: "change.reverted",
      summary: `Reverted to before “${target.summary}” (undid ${plural(undone.length, "change")})`,
      metadata: { undone: undone.map((u) => u.summary).slice(0, 50) },
    });
  }
  return NextResponse.json({ undone });
});
