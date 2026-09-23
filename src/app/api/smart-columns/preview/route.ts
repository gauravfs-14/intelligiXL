import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { smartColumnConfigSchema } from "@/lib/validation/smart-column";
import { previewSmartColumn } from "@/lib/smart-columns/preview";
import { withErrorHandling } from "@/lib/api/respond";

const DEFAULT_SAMPLE_SIZE = 10;

const previewSchema = z.object({
  datasetId: z.string().min(1),
  config: smartColumnConfigSchema,
  sampleMode: z.enum(["random", "first", "manual"]).default("random"),
  sampleSize: z.number().int().min(1).max(50).default(DEFAULT_SAMPLE_SIZE),
  rowIds: z.array(z.string()).optional(),
});

// FR-012/013 — runs a Smart Column definition against a sample without
// persisting anything, so the wizard can be previewed and re-edited freely
// (FR-014) before the user commits to a full Generate run.
export const POST = withErrorHandling(async (req: Request) => {
  const body = previewSchema.parse(await req.json());

  const rows =
    body.sampleMode === "manual" && body.rowIds?.length
      ? await prisma.datasetRow.findMany({ where: { datasetId: body.datasetId, id: { in: body.rowIds } } })
      : body.sampleMode === "first"
        ? await prisma.datasetRow.findMany({
            where: { datasetId: body.datasetId },
            orderBy: { rowIndex: "asc" },
            take: body.sampleSize,
          })
        : await prisma.$queryRaw<{ id: string; rowIndex: number; data: Prisma.JsonValue }[]>(
            Prisma.sql`SELECT id, "rowIndex", data FROM "DatasetRow" WHERE "datasetId" = ${body.datasetId} ORDER BY random() LIMIT ${body.sampleSize}`,
          );

  const results = await previewSmartColumn({
    type: body.config.type,
    question: body.config.question,
    instructions: body.config.instructions,
    labels: body.config.labels,
    sourceColumns: body.config.sourceColumns,
    rows: rows.map((r) => ({ id: r.id, rowIndex: r.rowIndex, data: r.data as Record<string, unknown> })),
  });

  return NextResponse.json({ results });
});
