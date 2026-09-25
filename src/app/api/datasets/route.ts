import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ColumnDataType, DatasetFormat, DatasetStatus, PredictionStatus, ReviewStatus, type Prisma } from "@/generated/prisma/client";
import { resolveSettings } from "@/lib/decision-models/catalog";
import { parseDataset } from "@/lib/parsing";
import { storage } from "@/lib/storage";
import { ApiError, withErrorHandling } from "@/lib/api/respond";
import { logActivity, plural } from "@/lib/activity/log";

export const GET = withErrorHandling(async (req: Request) => {
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) throw new ApiError(422, "workspaceId is required.");
  const datasets = await prisma.dataset.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { smartColumns: true } },
      smartColumns: {
        select: { id: true, name: true, type: true, activeVersionId: true, versions: { select: { id: true, settings: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Per Smart Column: successful predictions under that column's own review
  // threshold that nobody has confirmed/corrected yet — the same set the
  // Review queue opens on, so the dashboard number and the queue agree.
  const withCounts = await Promise.all(
    datasets.map(async ({ smartColumns, ...d }) => ({
      ...d,
      smartColumns: await Promise.all(
        smartColumns.map(async ({ versions, ...sc }) => {
          const active = versions.find((v) => v.id === sc.activeVersionId);
          const settings = resolveSettings(active?.settings);
          const needsReview =
            active && settings.lowConfidenceAction === "flag"
              ? await prisma.prediction.count({
                  where: {
                    smartColumnVersionId: active.id,
                    status: PredictionStatus.SUCCESS,
                    confidence: { lt: settings.confidenceThreshold },
                    OR: [{ review: null }, { review: { status: ReviewStatus.NOT_REVIEWED } }],
                  },
                })
              : 0;
          return { ...sc, needsReview, reviewThreshold: settings.confidenceThreshold };
        }),
      ),
    })),
  );
  return NextResponse.json({ datasets: withCounts });
});

const confirmSchema = z.object({
  workspaceId: z.string().min(1),
  storageKey: z.string().min(1),
  filename: z.string().min(1),
  format: z.nativeEnum(DatasetFormat),
  // XLSX only — which workbook sheet to import (defaults to the first non-empty one).
  sheet: z.string().min(1).optional(),
  columns: z
    .array(
      z.object({
        name: z.string().min(1),
        dataType: z.nativeEnum(ColumnDataType),
        isSource: z.boolean().default(true),
      }),
    )
    .min(1),
});

// FR-003 step 5 — confirm import: re-reads the already-staged file (written
// during POST /api/uploads) and persists the dataset, its column schema, and
// every row.
export const POST = withErrorHandling(async (req: Request) => {
  const body = confirmSchema.parse(await req.json());

  if (!(await storage.exists(body.storageKey))) {
    throw new ApiError(410, "The staged upload has expired. Please upload the file again.");
  }

  const buffer = await storage.get(body.storageKey);
  const parsed = parseDataset(buffer, body.format, { sheet: body.sheet });

  // Importing several sheets of one workbook would otherwise yield datasets
  // with identical names — tag the sheet in, keeping the extension last so
  // export filenames ("<base>_augmented.csv") still derive cleanly.
  const filename =
    parsed.sheets && parsed.sheets.length > 1 && parsed.sheet
      ? body.filename.replace(/(\.[^.]+)?$/, (ext) => ` (${parsed.sheet})${ext}`)
      : body.filename;

  const dataset = await prisma.$transaction(async (tx) => {
    const created = await tx.dataset.create({
      data: {
        workspaceId: body.workspaceId,
        filename,
        originalFormat: body.format,
        rowCount: parsed.rowCount,
        columnCount: parsed.columnCount,
        storageKey: body.storageKey,
        status: DatasetStatus.READY,
        warning: parsed.warning,
      },
    });

    await tx.datasetColumn.createMany({
      data: body.columns.map((col, position) => ({
        datasetId: created.id,
        name: col.name,
        dataType: col.dataType,
        position,
        isSource: col.isSource,
      })),
    });

    // Chunked so a 10k-row import doesn't build one enormous SQL statement.
    const CHUNK = 500;
    for (let i = 0; i < parsed.rows.length; i += CHUNK) {
      const chunk = parsed.rows.slice(i, i + CHUNK);
      await tx.datasetRow.createMany({
        data: chunk.map((data, j) => ({ datasetId: created.id, rowIndex: i + j, data: data as Prisma.InputJsonValue })),
      });
    }

    await logActivity(
      {
        workspaceId: body.workspaceId,
        category: "datasets",
        action: "dataset.imported",
        summary: `Imported “${filename}” — ${plural(parsed.rowCount, "row")}, ${plural(parsed.columnCount, "column")}`,
        dataset: { id: created.id, name: filename },
        metadata: { format: body.format, rowCount: parsed.rowCount, columnCount: parsed.columnCount, ...(parsed.sheet && { sheet: parsed.sheet }) },
      },
      tx,
    );

    return created;
  }, { timeout: 60_000 });

  return NextResponse.json({ dataset }, { status: 201 });
});
