import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound, ApiError } from "@/lib/api/respond";
import { ChangeLogAction, getColumnValues, logChange } from "@/lib/change-log";

type Params = { params: Promise<{ id: string; columnId: string }> };

// Duplicate a column — copies its value into a new "<name> (Copy)" key on
// every row (single jsonb statement) and appends a matching DatasetColumn.
export const POST = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id, columnId } = await params;
  const column = await prisma.datasetColumn.findFirst({ where: { id: columnId, datasetId: id } });
  if (!column) notFound("Column");

  let newName = `${column.name} (Copy)`;
  let n = 2;
  while (await prisma.datasetColumn.findUnique({ where: { datasetId_name: { datasetId: id, name: newName } } })) {
    newName = `${column.name} (Copy ${n})`;
    n += 1;
  }

  const maxPosition = await prisma.datasetColumn.aggregate({ where: { datasetId: id }, _max: { position: true } });
  if (maxPosition._max.position === null) throw new ApiError(500, "Dataset has no columns.");

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "DatasetRow"
      SET data = data || jsonb_build_object(${newName}::text, data -> ${column.name}::text)
      WHERE "datasetId" = ${id}
    `;
    const newColumn = await tx.datasetColumn.create({
      data: { datasetId: id, name: newName, dataType: column.dataType, position: (maxPosition._max.position ?? 0) + 1, isSource: true },
    });
    await tx.dataset.update({ where: { id }, data: { columnCount: { increment: 1 } } });
    const values = await getColumnValues(tx, id, newName);
    await logChange(
      tx,
      id,
      ChangeLogAction.COLUMN_DUPLICATE,
      `Duplicated column "${column.name}" as "${newName}" at position ${newColumn.position + 1}`,
      {},
      { column: newColumn, values },
    );
    return newColumn;
  });

  return NextResponse.json({ column: created }, { status: 201 });
});
