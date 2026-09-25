import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound, ApiError } from "@/lib/api/respond";
import { ChangeLogAction, getColumnValues, logChange, renameColumnKeys } from "@/lib/change-log";

type Params = { params: Promise<{ id: string; columnId: string }> };

const patchSchema = z.object({ name: z.string().min(1).max(200) });

// Rename a column — renames the DatasetColumn row and, via a single jsonb
// key-rename, every row's data blob in one statement (Postgres `-`/`||`
// operators) instead of reading and rewriting every row in JS.
export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id, columnId } = await params;
  const { name: newName } = patchSchema.parse(await req.json());

  const column = await prisma.datasetColumn.findFirst({ where: { id: columnId, datasetId: id } });
  if (!column) notFound("Column");
  if (column.name === newName) return NextResponse.json({ column });

  const collision = await prisma.datasetColumn.findUnique({ where: { datasetId_name: { datasetId: id, name: newName } } });
  if (collision) throw new ApiError(409, `A column named "${newName}" already exists.`);

  const updated = await prisma.$transaction(async (tx) => {
    await renameColumnKeys(tx, id, columnId, column.name, newName);
    await logChange(
      tx,
      id,
      ChangeLogAction.COLUMN_RENAME,
      `Renamed column "${column.name}" to "${newName}"`,
      { columnId, name: column.name },
      { columnId, name: newName },
    );
    return tx.datasetColumn.findUniqueOrThrow({ where: { id: columnId } });
  });

  return NextResponse.json({ column: updated });
});

// Deletes the column definition and strips its key from every row's data
// blob (single jsonb `-` statement). Historical predictions/versions that
// reference the old name as a source-column hint are left as-is.
export const DELETE = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id, columnId } = await params;
  const column = await prisma.datasetColumn.findFirst({ where: { id: columnId, datasetId: id } });
  if (!column) notFound("Column");

  await prisma.$transaction(async (tx) => {
    const values = await getColumnValues(tx, id, column.name);
    await tx.$executeRaw`UPDATE "DatasetRow" SET data = data - ${column.name}::text WHERE "datasetId" = ${id}`;
    await tx.datasetColumn.delete({ where: { id: columnId } });
    await tx.dataset.update({ where: { id }, data: { columnCount: { decrement: 1 } } });
    await logChange(
      tx,
      id,
      ChangeLogAction.COLUMN_DELETE,
      `Deleted column "${column.name}" (position ${column.position + 1}, ${values.length} value${values.length === 1 ? "" : "s"})`,
      { column, values },
      {},
    );
  });

  return NextResponse.json({ ok: true });
});
