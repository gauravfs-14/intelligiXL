import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decisionModel } from "@/lib/decision-models";
import { withErrorHandling } from "@/lib/api/respond";

const NEW_COLUMN_KEY = "__new_smart_column__";

const askSchema = z.object({
  workspaceId: z.string().min(1),
  datasetId: z.string().min(1),
  question: z.string().min(1).max(500),
});

// FR-044 (P2) — a lightweight router, not a full analyst: classifies whether
// an existing Smart Column can answer the question, or a new one is needed.
export const POST = withErrorHandling(async (req: Request) => {
  const body = askSchema.parse(await req.json());

  const smartColumns = await prisma.smartColumn.findMany({
    where: { datasetId: body.datasetId },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });

  if (smartColumns.length === 0) {
    return NextResponse.json({
      verdict: "new_smart_column",
      message: "This dataset has no Smart Columns yet. Create one to start answering questions like this.",
      matchedSmartColumn: null,
    });
  }

  const labels: Record<string, string | null> = { [NEW_COLUMN_KEY]: "None of the existing columns can answer this — a new Smart Column is needed" };
  for (const sc of smartColumns) {
    labels[sc.id] = `"${sc.name}": ${sc.versions[0]?.question ?? sc.name}`;
  }

  const result = await decisionModel.categoricalDecision(
    { question: body.question },
    "Which of these existing analysis columns, if any, can answer this question about the dataset? Choose the new-column option if none apply.",
    labels,
  );

  if (result.status !== "success") {
    return NextResponse.json({ verdict: "unknown", message: "Couldn't reach Jev to route this question.", error: result.message }, { status: 200 });
  }

  if (result.predictedLabel === NEW_COLUMN_KEY) {
    return NextResponse.json({
      verdict: "new_smart_column",
      confidence: result.confidence,
      message: "None of the existing Smart Columns cover this — try creating a new one.",
      matchedSmartColumn: null,
    });
  }

  const matched = smartColumns.find((sc) => sc.id === result.predictedLabel) ?? null;
  return NextResponse.json({
    verdict: "existing_data",
    confidence: result.confidence,
    message: matched ? `Try filtering or viewing Insights on "${matched.name}".` : "A related Smart Column may answer this.",
    matchedSmartColumn: matched ? { id: matched.id, name: matched.name } : null,
  });
});
