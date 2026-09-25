import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ColumnDataType } from "@/generated/prisma/client";
import { withErrorHandling, notFound, ApiError } from "@/lib/api/respond";
import { ChangeLogAction, logChange } from "@/lib/change-log";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  // Insert relative to a specific column instead of appending at the end.
  anchorColumnId: z.string().min(1).optional(),
  position: z.enum(["left", "right"]).optional(),
});

// Add a new (empty) source column — appended at the end by default, or
// inserted directly left/right of an anchor column. `position` (the
// DatasetColumn field) has no uniqueness constraint, so shifting it to make
// room is a plain increment with no collision risk (unlike row insertion).
export const POST = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const body = bodySchema.parse(await req.json());

  const dataset = await prisma.dataset.findUnique({ where: { id } });
  if (!dataset) notFound("Dataset");

  const existing = await prisma.datasetColumn.findUnique({ where: { datasetId_name: { datasetId: id, name: body.name } } });
  if (existing) throw new ApiError(409, `A column named "${body.name}" already exists.`);

  let insertAt: number | null = null;
  if (body.anchorColumnId && body.position) {
    const anchor = await prisma.datasetColumn.findFirst({ where: { id: body.anchorColumnId, datasetId: id } });
    if (!anchor) notFound("Column");
    insertAt = body.position === "left" ? anchor.position : anchor.position + 1;
  }

  const column = await prisma.$transaction(async (tx) => {
    let position: number;
    if (insertAt === null) {
      const maxPosition = await tx.datasetColumn.aggregate({ where: { datasetId: id }, _max: { position: true } });
      position = (maxPosition._max.position ?? -1) + 1;
    } else {
      position = insertAt;
      await tx.datasetColumn.updateMany({ where: { datasetId: id, position: { gte: insertAt } }, data: { position: { increment: 1 } } });
    }

    const created = await tx.datasetColumn.create({
      data: { datasetId: id, name: body.name, dataType: ColumnDataType.STRING, position, isSource: true },
    });
    await tx.dataset.update({ where: { id }, data: { columnCount: { increment: 1 } } });
    await logChange(
      tx,
      id,
      ChangeLogAction.COLUMN_INSERT,
      `Added column "${created.name}" at position ${created.position + 1}`,
      {},
      { column: created, values: [] },
    );
    return created;
  });

  return NextResponse.json({ column }, { status: 201 });
});
