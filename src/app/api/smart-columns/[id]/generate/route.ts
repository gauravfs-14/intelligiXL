import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobStatus, JobType } from "@/generated/prisma/client";
import { getSmartColumnQueue } from "@/lib/queue/smart-column-queue";
import { ApiError, withErrorHandling, notFound } from "@/lib/api/respond";
import { logActivity, plural } from "@/lib/activity/log";

type Params = { params: Promise<{ id: string }> };

// FR-015 — generates predictions for every eligible row via a background job.
export const POST = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const smartColumn = await prisma.smartColumn.findUnique({ where: { id }, include: { dataset: true } });
  if (!smartColumn) notFound("Smart Column");
  if (!smartColumn.activeVersionId) throw new ApiError(409, "This Smart Column has no active version yet.");

  const existingActiveJob = await prisma.job.findFirst({
    where: { smartColumnId: id, status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } },
  });
  if (existingActiveJob) throw new ApiError(409, "A generation job is already running for this Smart Column.", [existingActiveJob.id]);

  const job = await prisma.job.create({
    data: {
      workspaceId: smartColumn.workspaceId,
      jobType: JobType.SMART_COLUMN_GENERATION,
      status: JobStatus.QUEUED,
      totalItems: smartColumn.dataset.rowCount,
      datasetId: smartColumn.datasetId,
      smartColumnId: smartColumn.id,
      smartColumnVersionId: smartColumn.activeVersionId,
    },
  });

  await getSmartColumnQueue().add("generate", { jobId: job.id });
  await logActivity({
    workspaceId: smartColumn.workspaceId,
    category: "generation",
    action: "generation.started",
    summary: `Started generating “${smartColumn.name}” for ${plural(smartColumn.dataset.rowCount, "row")}`,
    dataset: { id: smartColumn.datasetId, name: smartColumn.dataset.filename },
    metadata: { jobId: job.id, smartColumnId: id },
  });

  return NextResponse.json({ job }, { status: 202 });
});
