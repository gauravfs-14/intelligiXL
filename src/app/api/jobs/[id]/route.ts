import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@/generated/prisma/client";
import { ApiError, withErrorHandling, notFound } from "@/lib/api/respond";

type Params = { params: Promise<{ id: string }> };

// FR-017 — polled by the client for status/completed/failed/percentage.
export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) notFound("Job");
  return NextResponse.json({ job });
});

const patchSchema = z.object({ status: z.literal("CANCELLED") });

// FR-018 — cooperative cancellation: the worker checks for this on its next
// poll tick and stops scheduling new rows; already-processed rows are kept.
export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  patchSchema.parse(await req.json());

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) notFound("Job");
  if (job.status !== JobStatus.QUEUED && job.status !== JobStatus.RUNNING) {
    throw new ApiError(409, `Cannot cancel a job that is already ${job.status.toLowerCase()}.`);
  }

  const updated = await prisma.job.update({ where: { id }, data: { status: JobStatus.CANCELLED, finishedAt: new Date() } });
  return NextResponse.json({ job: updated });
});
