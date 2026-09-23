import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PredictionStatus } from "@/generated/prisma/client";
import { ApiError, withErrorHandling } from "@/lib/api/respond";

type Params = { params: Promise<{ id: string }> };

// FR-041 — agreement/disagreement and confidence deltas between two versions
// of the same Smart Column.
export const GET = withErrorHandling(async (req: Request, { params }: Params) => {
  await params;
  const url = new URL(req.url);
  const versionAId = url.searchParams.get("a");
  const versionBId = url.searchParams.get("b");
  if (!versionAId || !versionBId) throw new ApiError(422, "Both `a` and `b` version ids are required.");

  const [predictionsA, predictionsB] = await Promise.all([
    prisma.prediction.findMany({ where: { smartColumnVersionId: versionAId, status: PredictionStatus.SUCCESS } }),
    prisma.prediction.findMany({ where: { smartColumnVersionId: versionBId, status: PredictionStatus.SUCCESS } }),
  ]);

  const byRowB = new Map(predictionsB.map((p) => [p.datasetRowId, p]));

  let agree = 0;
  let disagree = 0;
  let confidenceDeltaSum = 0;
  const disagreements: {
    datasetRowId: string;
    labelA: string | null;
    labelB: string | null;
    confidenceA: number | null;
    confidenceB: number | null;
  }[] = [];

  for (const a of predictionsA) {
    const b = byRowB.get(a.datasetRowId);
    if (!b) continue;
    confidenceDeltaSum += Math.abs((a.confidence ?? 0) - (b.confidence ?? 0));
    if (a.predictedLabel === b.predictedLabel) {
      agree += 1;
    } else {
      disagree += 1;
      if (disagreements.length < 200) {
        disagreements.push({
          datasetRowId: a.datasetRowId,
          labelA: a.predictedLabel,
          labelB: b.predictedLabel,
          confidenceA: a.confidence,
          confidenceB: b.confidence,
        });
      }
    }
  }

  const comparable = agree + disagree;

  return NextResponse.json({
    comparable,
    agree,
    disagree,
    agreementRate: comparable > 0 ? agree / comparable : null,
    avgConfidenceDelta: comparable > 0 ? confidenceDeltaSum / comparable : null,
    disagreements,
  });
});
