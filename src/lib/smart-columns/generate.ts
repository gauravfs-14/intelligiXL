import { prisma } from "@/lib/prisma";
import { JobStatus, JobType, PredictionStatus } from "@/generated/prisma/client";
import { asyncPool } from "@/lib/utils/async-pool";
import { PREDICTION_ERROR_LABEL } from "@/lib/prediction-error-labels";
import { isLowConfidence, resolveSettings } from "@/lib/decision-models/catalog";
import { JobLogger } from "./job-log";
import { logActivity, plural } from "@/lib/activity/log";
import { decisionResultToPredictionData, runSmartColumnOnRow } from "./run";

const CHECKPOINT_EVERY = 25;

/** Executes a queued Smart Column generation or retry job row-by-row with
 * bounded concurrency, fault isolation per row (NFR-004), and cooperative
 * cancellation (FR-018). Shared by the BullMQ worker; also callable inline
 * for local/dev use when no worker process is running. */
export async function runGenerationJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { smartColumnVersion: { include: { smartColumn: true } }, workspace: { include: { owner: true } } },
  });

  const log = new JobLogger();

  // A queued BullMQ entry may still be delivered after the user cancels it.
  if (job.status === JobStatus.CANCELLED || job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) return;

  if (!job.datasetId || !job.smartColumnVersion) {
    log.add("error", "Job is missing its dataset or Smart Column version.");
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        finishedAt: new Date(),
        errorLog: { message: "Job is missing its dataset or Smart Column version." },
        logs: log.toJson(),
      },
    });
    return;
  }

  const version = job.smartColumnVersion;
  const settings = resolveSettings(version.settings);
  log.add("info", `Run started by ${job.workspace.owner.email}`);
  log.add(
    "info",
    `Model: ${version.modelIdentifier} (${version.modelProvider}) · threshold ${Math.round(settings.confidenceThreshold * 100)}%${settings.lowConfidenceAction === "none" ? " (flagging off)" : ""} · concurrency ${settings.concurrency} · timeout ${Math.round(settings.timeoutMs / 1000)}s · ${settings.maxRetries} retr${settings.maxRetries === 1 ? "y" : "ies"}`,
  );
  const claimed = await prisma.job.updateMany({
    where: { id: jobId, status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } },
    data: { status: JobStatus.RUNNING, logs: log.toJson() },
  });
  if (claimed.count === 0) return;

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

  log.add("info", `Processing ${rows.length.toLocaleString()} row(s) with concurrency ${settings.concurrency}`);

  let completed = 0;
  let failed = 0;
  let cancelled = false;
  let sinceFlush = 0;
  let sinceCheckpoint = 0;
  const startedAt = Date.now();

  async function flushProgress(force = false) {
    sinceFlush += 1;
    // Flush every row (not just every 3rd) now that each row gets its own
    // log line — a per-request log otherwise lags a couple of requests
    // behind what the Jobs panel polls for.
    if (!force && sinceFlush < 1) return;
    sinceFlush = 0;
    await prisma.job.update({ where: { id: jobId }, data: { completedItems: completed, failedItems: failed, logs: log.toJson() } });
  }

  function maybeCheckpoint() {
    sinceCheckpoint += 1;
    if (sinceCheckpoint < CHECKPOINT_EVERY) return;
    sinceCheckpoint = 0;
    const elapsedSec = Math.max(1, (Date.now() - startedAt) / 1000);
    const rate = ((completed + failed) / elapsedSec).toFixed(1);
    log.add("info", `Checkpoint — ${(completed + failed).toLocaleString()}/${rows.length.toLocaleString()} processed (${failed} flagged/failed) · ${rate} rows/s`);
  }

  async function processRow(row: (typeof rows)[number]) {
    if (cancelled) return;
    const current = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    if (current?.status === JobStatus.CANCELLED) {
      cancelled = true;
      return;
    }

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
      modelProvider: version.modelProvider,
      modelIdentifier: version.modelIdentifier,
      settings,
    });
    const data = decisionResultToPredictionData(result);

    await prisma.prediction.upsert({
      where: { datasetRowId_smartColumnVersionId: { datasetRowId: row.id, smartColumnVersionId: version.id } },
      create: { datasetRowId: row.id, smartColumnVersionId: version.id, jobId, ...data },
      update: { jobId, ...data },
    });

    if (data.status === PredictionStatus.FAILED) {
      failed += 1;
      log.add("error", `Row ${row.rowIndex + 1}: ${PREDICTION_ERROR_LABEL[data.errorReason ?? "UNKNOWN"]} — will retry`);
    } else {
      completed += 1;
      // No batching here — each row is its own Jev request, so every
      // request gets its own timestamped line, not just the flagged ones.
      const pct = data.confidence !== null && data.confidence !== undefined ? Math.round(data.confidence * 100) : null;
      const flagged = isLowConfidence(data.confidence, settings);
      log.add(
        flagged ? "warning" : "info",
        `Row ${row.rowIndex + 1}: ${data.predictedLabel ?? "—"}${pct !== null ? ` (${pct}%)` : ""}${flagged ? " — flagged" : ""}`,
      );
    }

    maybeCheckpoint();
    await flushProgress();
  }

  await asyncPool(settings.concurrency, rows, processRow);

  // Re-check right before the final write: cancellation may have been
  // requested after the last in-loop poll but before the pool drained.
  if (!cancelled) {
    const fresh = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    if (fresh?.status === JobStatus.CANCELLED) cancelled = true;
  }

  log.add(
    cancelled ? "warning" : "success",
    cancelled
      ? `Run cancelled — ${(completed + failed).toLocaleString()}/${rows.length.toLocaleString()} processed`
      : `Run complete — ${completed.toLocaleString()} ok, ${failed.toLocaleString()} flagged/failed`,
  );

  // Never overwrite a cancellation that races with the final status check.
  const finalized = await prisma.job.updateMany({
    where: { id: jobId, status: JobStatus.RUNNING },
    data: {
      status: cancelled ? JobStatus.CANCELLED : JobStatus.COMPLETED,
      completedItems: completed,
      failedItems: failed,
      finishedAt: new Date(),
      logs: log.toJson(),
    },
  });

  if (finalized.count === 0) {
    cancelled = true;
    await prisma.job.updateMany({
      where: { id: jobId, status: JobStatus.CANCELLED },
      data: { completedItems: completed, failedItems: failed, logs: log.toJson() },
    });
  }

  // A user-initiated cancel is already logged by the cancel route.
  if (!cancelled) {
    const dataset = await prisma.dataset.findUnique({ where: { id: job.datasetId }, select: { id: true, filename: true } });
    await logActivity({
      workspaceId: job.workspaceId,
      category: "generation",
      action: "generation.completed",
      summary: `Finished ${job.jobType === JobType.SMART_COLUMN_RETRY ? "retrying" : "generating"} “${version.smartColumn.name}” — ${plural(completed, "row")} ok, ${failed.toLocaleString()} flagged/failed`,
      dataset: dataset ? { id: dataset.id, name: dataset.filename } : null,
      metadata: { jobId, completed, failed },
    });
  }
}
