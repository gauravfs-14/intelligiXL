import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PredictionStatus } from "@/generated/prisma/client";
import { buildSourceState } from "@/lib/decision-models/normalize";
import { withErrorHandling, notFound } from "@/lib/api/respond";

type Params = { params: Promise<{ id: string }> };

const LOG_LIMIT = 200;

// The per-row "log" behind a job: every row this specific run left FAILED,
// with the error reason and a snippet of the text that was sent, so a
// failure can actually be diagnosed instead of just counted.
export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: { smartColumnVersion: true, smartColumn: { select: { name: true, type: true } } },
  });
  if (!job) notFound("Job");

  const failures = await prisma.prediction.findMany({
    where: { jobId: id, status: PredictionStatus.FAILED },
    include: { datasetRow: true },
    orderBy: { updatedAt: "desc" },
    take: LOG_LIMIT,
  });

  const sourceColumns = job.smartColumnVersion?.sourceColumns ?? [];

  return NextResponse.json({
    job,
    smartColumnName: job.smartColumn?.name ?? null,
    totalFailures: job.failedItems,
    truncated: job.failedItems > LOG_LIMIT,
    failures: failures.map((p) => ({
      id: p.id,
      datasetRowId: p.datasetRowId,
      rowIndex: p.datasetRow.rowIndex,
      errorReason: p.errorReason,
      updatedAt: p.updatedAt,
      sourceSnippet: buildSourceState(p.datasetRow.data as Record<string, unknown>, sourceColumns).text.slice(0, 200),
    })),
  });
});
