import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ReviewStatus } from "@/generated/prisma/client";
import { getDefaultUserId } from "@/lib/current-user";
import { withErrorHandling, notFound } from "@/lib/api/respond";
import { formatLogValue } from "@/lib/change-log";
import { logActivity } from "@/lib/activity/log";

const upsertSchema = z.object({
  predictionId: z.string().min(1),
  status: z.nativeEnum(ReviewStatus),
  reviewedValue: z.string().nullable().optional(),
});

// FR-027/028 — records a human review decision. The AI prediction row is
// never modified; the human value lives here alongside it (§19).
export const POST = withErrorHandling(async (req: Request) => {
  const body = upsertSchema.parse(await req.json());
  const reviewerId = await getDefaultUserId();

  const prediction = await prisma.prediction.findUnique({
    where: { id: body.predictionId },
    select: {
      predictedLabel: true,
      review: { select: { status: true, reviewedValue: true } },
      datasetRow: { select: { rowIndex: true } },
      smartColumnVersion: {
        select: { smartColumn: { select: { name: true, workspaceId: true, dataset: { select: { id: true, filename: true } } } } },
      },
    },
  });
  if (!prediction) notFound("Prediction");

  const review = await prisma.review.upsert({
    where: { predictionId: body.predictionId },
    create: {
      predictionId: body.predictionId,
      status: body.status,
      reviewedValue: body.reviewedValue ?? null,
      reviewerId,
    },
    update: {
      status: body.status,
      reviewedValue: body.reviewedValue ?? null,
      reviewerId,
    },
  });

  const { smartColumn } = prediction.smartColumnVersion;
  const where = `row ${prediction.datasetRow.rowIndex + 1} of “${smartColumn.name}”`;
  const ai = formatLogValue(prediction.predictedLabel);
  const summary =
    body.status === ReviewStatus.CONFIRMED
      ? `Confirmed ${ai} on ${where}`
      : body.status === ReviewStatus.CORRECTED
        ? `Corrected ${where}: ${ai} → ${formatLogValue(body.reviewedValue)}`
        : body.status === ReviewStatus.SKIPPED
          ? `Skipped reviewing ${where}`
          : `Cleared the review on ${where}`;
  await logActivity({
    workspaceId: smartColumn.workspaceId,
    category: "reviews",
    action: `review.${body.status.toLowerCase()}`,
    summary,
    dataset: { id: smartColumn.dataset.id, name: smartColumn.dataset.filename },
    metadata: {
      predictionId: body.predictionId,
      predictedLabel: prediction.predictedLabel,
      previous: prediction.review ? { status: prediction.review.status, value: prediction.review.reviewedValue } : null,
      status: body.status,
      reviewedValue: body.reviewedValue ?? null,
    },
  });

  return NextResponse.json({ review });
});
