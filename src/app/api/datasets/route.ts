import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ColumnDataType, DatasetFormat, DatasetStatus, type Prisma } from "@/generated/prisma/client";
import { parseDataset } from "@/lib/parsing";
import { storage } from "@/lib/storage";
import { ApiError, withErrorHandling } from "@/lib/api/respond";

export const GET = withErrorHandling(async (req: Request) => {
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) throw new ApiError(422, "workspaceId is required.");
  const datasets = await prisma.dataset.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { smartColumns: true } } },
  });
  return NextResponse.json({ datasets });
});

const confirmSchema = z.object({
  workspaceId: z.string().min(1),
  storageKey: z.string().min(1),
  filename: z.string().min(1),
  format: z.nativeEnum(DatasetFormat),
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
  const parsed = parseDataset(buffer, body.format);

  const dataset = await prisma.$transaction(async (tx) => {
    const created = await tx.dataset.create({
      data: {
        workspaceId: body.workspaceId,
        filename: body.filename,
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

    return created;
  }, { timeout: 60_000 });

  return NextResponse.json({ dataset }, { status: 201 });
});
