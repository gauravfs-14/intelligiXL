import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { withErrorHandling, notFound } from "@/lib/api/respond";
import { ChangeLogAction, formatLogValue, logChange } from "@/lib/change-log";

type Params = { params: Promise<{ id: string; rowId: string }> };

const patchSchema = z.object({ data: z.record(z.string(), z.unknown()) });

// Cell edit — merges the given keys into the row's data blob rather than
// replacing it wholesale, so editing one cell can't clobber others. Each
// changed key gets its own change-log entry (so undo reverts one cell at a
// time, matching a spreadsheet's granularity) rather than one entry per PATCH.
export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id, rowId } = await params;
  const body = patchSchema.parse(await req.json());

  const row = await prisma.datasetRow.findFirst({ where: { id: rowId, datasetId: id } });
  if (!row) notFound("Row");

  const oldData = row.data as Record<string, unknown>;
  const merged = { ...oldData, ...body.data };
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.datasetRow.update({ where: { id: rowId }, data: { data: merged as Prisma.InputJsonValue } });
    for (const [columnName, value] of Object.entries(body.data)) {
      const oldValue = oldData[columnName] ?? null;
      const newValue = value ?? null;
      await logChange(
        tx,
        id,
        ChangeLogAction.CELL_EDIT,
        `Row ${row.rowIndex + 1} — "${columnName}": ${formatLogValue(oldValue)} → ${formatLogValue(newValue)}`,
        { rowId, columnName, value: oldValue },
        { rowId, columnName, value: newValue },
      );
    }
    return result;
  });
  return NextResponse.json({ row: updated });
});

export const DELETE = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id, rowId } = await params;
  const row = await prisma.datasetRow.findFirst({ where: { id: rowId, datasetId: id } });
  if (!row) notFound("Row");

  await prisma.$transaction(async (tx) => {
    await tx.datasetRow.delete({ where: { id: rowId } });
    await tx.dataset.update({ where: { id }, data: { rowCount: { decrement: 1 } } });
    await logChange(
      tx,
      id,
      ChangeLogAction.ROW_DELETE,
      `Deleted row ${row.rowIndex + 1}`,
      { rows: [{ id: row.id, rowIndex: row.rowIndex, data: row.data }] },
      {},
    );
  });
  return NextResponse.json({ ok: true });
});
