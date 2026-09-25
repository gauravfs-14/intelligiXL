import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound } from "@/lib/api/respond";
import { ChangeLogAction, formatRowNumbers, logChange } from "@/lib/change-log";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ rowIds: z.array(z.string().min(1)).min(1) });

// Bulk row delete (also covers single-row delete) — predictions cascade via
// the FK, and rowIndex gaps are left in place rather than renumbered.
export const POST = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const { rowIds } = bodySchema.parse(await req.json());

  const dataset = await prisma.dataset.findUnique({ where: { id } });
  if (!dataset) notFound("Dataset");

  const { count } = await prisma.$transaction(async (tx) => {
    const toDelete = await tx.datasetRow.findMany({ where: { id: { in: rowIds }, datasetId: id } });
    const result = await tx.datasetRow.deleteMany({ where: { id: { in: rowIds }, datasetId: id } });
    if (result.count > 0) {
      await tx.dataset.update({ where: { id }, data: { rowCount: { decrement: result.count } } });
      await logChange(
        tx,
        id,
        ChangeLogAction.ROW_DELETE,
        `Deleted ${result.count} row${result.count > 1 ? "s" : ""} (row${result.count > 1 ? "s" : ""} ${formatRowNumbers(toDelete.map((r) => r.rowIndex))})`,
        { rows: toDelete.map((r) => ({ id: r.id, rowIndex: r.rowIndex, data: r.data })) },
        {},
      );
    }
    return result;
  });

  return NextResponse.json({ deleted: count });
});
