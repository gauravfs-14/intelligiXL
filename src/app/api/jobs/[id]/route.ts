import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@/generated/prisma/client";
import { ApiError, withErrorHandling, notFound } from "@/lib/api/respond";
import { logActivity } from "@/lib/activity/log";

type Params = { params: Promise<{ id: string }> };

// FR-017 — polled by the client for status/completed/failed/percentage.
export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      smartColumn: { select: { id: true, name: true, type: true } },
      dataset: { select: { id: true, filename: true } },
      smartColumnVersion: { select: { versionNumber: true, modelProvider: true, modelIdentifier: true } },
    },
  });
  if (!job) notFound("Job");

  // There's no startedAt column, and the "Run started" log line scrolls out
  // of the ring buffer on long runs — so derive when processing really began
  // from the first row this run wrote. Falls back to createdAt (queue time
  // included) before the first row lands.
  const first = await prisma.prediction.aggregate({ where: { jobId: id }, _min: { updatedAt: true } });
  const startedAt = first._min.updatedAt ?? null;

  return NextResponse.json({ job: { ...job, startedAt } });
});

const patchSchema = z.object({ status: z.literal("CANCELLED") });

// FR-018 — cooperative cancellation: the worker checks for this on its next
// poll tick and stops scheduling new rows; already-processed rows are kept.
export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  patchSchema.parse(await req.json());

  const job = await prisma.job.findUnique({
    where: { id },
    include: { smartColumn: { select: { name: true } }, dataset: { select: { id: true, filename: true } } },
  });
  if (!job) notFound("Job");
  if (job.status !== JobStatus.QUEUED && job.status !== JobStatus.RUNNING) {
    throw new ApiError(409, `Cannot cancel a job that is already ${job.status.toLowerCase()}.`);
  }

  const updated = await prisma.job.update({ where: { id }, data: { status: JobStatus.CANCELLED, finishedAt: new Date() } });
  await logActivity({
    workspaceId: job.workspaceId,
    category: "generation",
    action: "generation.cancelled",
    summary: `Cancelled the ${job.smartColumn ? `“${job.smartColumn.name}” ` : ""}generation run (${job.completedItems.toLocaleString()} of ${job.totalItems.toLocaleString()} rows done)`,
    dataset: job.dataset ? { id: job.dataset.id, name: job.dataset.filename } : null,
    metadata: { jobId: id },
  });
  return NextResponse.json({ job: updated });
});
