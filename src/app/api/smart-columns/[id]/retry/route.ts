import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobStatus, JobType, PredictionStatus } from "@/generated/prisma/client";
import { getSmartColumnQueue } from "@/lib/queue/smart-column-queue";
import { ApiError, withErrorHandling, notFound } from "@/lib/api/respond";
import { logActivity, plural } from "@/lib/activity/log";

type Params = { params: Promise<{ id: string }> };

// FR-019 — retries only the rows that previously failed, independently of
// the rest of the column.
export const POST = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const smartColumn = await prisma.smartColumn.findUnique({ where: { id }, include: { dataset: { select: { filename: true } } } });
  if (!smartColumn) notFound("Smart Column");
  if (!smartColumn.activeVersionId) throw new ApiError(409, "This Smart Column has no active version yet.");

  const existingActiveJob = await prisma.job.findFirst({
    where: { smartColumnId: id, status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } },
  });
  if (existingActiveJob) throw new ApiError(409, "A job is already running for this Smart Column.", [existingActiveJob.id]);

  const failedCount = await prisma.prediction.count({
    where: { smartColumnVersionId: smartColumn.activeVersionId, status: PredictionStatus.FAILED },
  });
  if (failedCount === 0) throw new ApiError(409, "There are no failed rows to retry.");

  const job = await prisma.job.create({
    data: {
      workspaceId: smartColumn.workspaceId,
      jobType: JobType.SMART_COLUMN_RETRY,
      status: JobStatus.QUEUED,
      totalItems: failedCount,
      datasetId: smartColumn.datasetId,
      smartColumnId: smartColumn.id,
      smartColumnVersionId: smartColumn.activeVersionId,
    },
  });

  await getSmartColumnQueue().add("retry", { jobId: job.id });
  await logActivity({
    workspaceId: smartColumn.workspaceId,
    category: "generation",
    action: "generation.retried",
    summary: `Retrying ${plural(failedCount, "failed row")} of “${smartColumn.name}”`,
    dataset: { id: smartColumn.datasetId, name: smartColumn.dataset.filename },
    metadata: { jobId: job.id, smartColumnId: id },
  });

  return NextResponse.json({ job }, { status: 202 });
});
