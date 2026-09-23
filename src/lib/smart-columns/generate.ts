import { prisma } from "@/lib/prisma";
import { JobStatus, JobType, PredictionStatus } from "@/generated/prisma/client";
import { asyncPool } from "@/lib/utils/async-pool";
import { decisionResultToPredictionData, runSmartColumnOnRow } from "./run";

const CONCURRENCY = 6;
const CANCEL_CHECK_EVERY = 20;

/** Executes a queued Smart Column generation or retry job row-by-row with
 * bounded concurrency, fault isolation per row (NFR-004), and cooperative
 * cancellation (FR-018). Shared by the BullMQ worker; also callable inline
 * for local/dev use when no worker process is running. */
export async function runGenerationJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { smartColumnVersion: { include: { smartColumn: true } } },
  });

  if (!job.datasetId || !job.smartColumnVersion) {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.FAILED, finishedAt: new Date(), errorLog: { message: "Job is missing its dataset or Smart Column version." } },
    });
    return;
  }

  const version = job.smartColumnVersion;
  await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING } });

  const rows =
    job.jobType === JobType.SMART_COLUMN_RETRY
      ? await prisma.datasetRow.findMany({
          where: {
            datasetId: job.datasetId,
            predictions: { some: { smartColumnVersionId: version.id, status: PredictionStatus.FAILED } },
          },
          orderBy: { rowIndex: "asc" },
        })
      : await prisma.datasetRow.findMany({ where: { datasetId: job.datasetId }, orderBy: { rowIndex: "asc" } });

  let completed = 0;
  let failed = 0;
  let cancelled = false;
  let sinceCancelCheck = 0;
  let sinceFlush = 0;

  async function flushProgress(force = false) {
    sinceFlush += 1;
    if (!force && sinceFlush < 3) return;
    sinceFlush = 0;
    await prisma.job.update({ where: { id: jobId }, data: { completedItems: completed, failedItems: failed } });
  }

  async function processRow(row: (typeof rows)[number]) {
    if (cancelled) return;

    if (job.jobType === JobType.SMART_COLUMN_GENERATION) {
      const existing = await prisma.prediction.findUnique({
        where: { datasetRowId_smartColumnVersionId: { datasetRowId: row.id, smartColumnVersionId: version.id } },
      });
      if (existing?.status === PredictionStatus.SUCCESS) {
        completed += 1;
        await flushProgress();
        return;
      }
    }

    const result = await runSmartColumnOnRow({
      type: version.smartColumn.type,
      question: version.question,
      instructions: version.instructions,
      labels: version.labels,
      sourceColumns: version.sourceColumns,
      row: row.data as Record<string, unknown>,
    });
    const data = decisionResultToPredictionData(result);

    await prisma.prediction.upsert({
      where: { datasetRowId_smartColumnVersionId: { datasetRowId: row.id, smartColumnVersionId: version.id } },
      create: { datasetRowId: row.id, smartColumnVersionId: version.id, jobId, ...data },
      update: { jobId, ...data },
    });

    if (data.status === PredictionStatus.FAILED) failed += 1;
    else completed += 1;

    await flushProgress();

    sinceCancelCheck += 1;
    if (sinceCancelCheck >= CANCEL_CHECK_EVERY) {
      sinceCancelCheck = 0;
      const fresh = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
      if (fresh?.status === JobStatus.CANCELLED) cancelled = true;
    }
  }

  await asyncPool(CONCURRENCY, rows, processRow);

  // Re-check right before the final write: cancellation may have been
  // requested after the last in-loop poll but before the pool drained.
  if (!cancelled) {
    const fresh = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    if (fresh?.status === JobStatus.CANCELLED) cancelled = true;
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: cancelled ? JobStatus.CANCELLED : JobStatus.COMPLETED,
      completedItems: completed,
      failedItems: failed,
      finishedAt: new Date(),
    },
  });
}
