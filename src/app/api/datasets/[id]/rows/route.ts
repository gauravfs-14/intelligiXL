import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { withErrorHandling, notFound } from "@/lib/api/respond";
import { ChangeLogAction, formatRowNumbers, logChange } from "@/lib/change-log";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  // Omit both to append one blank row at the end; pass `duplicateOf` to
  // append duplicates of each row (in order) right after the last row.
  duplicateOf: z.array(z.string().min(1)).optional(),
  // Insert relative to a specific row instead of appending — shifts every
  // row at/after the insertion point down by one first.
  anchorRowId: z.string().min(1).optional(),
  position: z.enum(["above", "below"]).optional(),
});

// Excel-style "insert row" — appends at the end by default (cheap, no
// renumbering), or inserts directly above/below an anchor row. The negate-
// then-flip shift below avoids transient collisions with the dataset's
// unique (datasetId, rowIndex) constraint: a single `SET rowIndex = rowIndex
// + 1` can momentarily collide mid-statement depending on row write order,
// but moving through the negative range first never overlaps live rows.
export const POST = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const body = bodySchema.parse(await req.json().catch(() => ({})));

  const dataset = await prisma.dataset.findUnique({ where: { id } });
  if (!dataset) notFound("Dataset");

  let sourceRows: { data: Prisma.JsonValue }[] = [{ data: {} }];
  if (body.duplicateOf && body.duplicateOf.length > 0) {
    const found = await prisma.datasetRow.findMany({ where: { id: { in: body.duplicateOf }, datasetId: id } });
    const byId = new Map(found.map((r) => [r.id, r]));
    const ordered = body.duplicateOf.map((rid) => byId.get(rid)).filter((r): r is (typeof found)[number] => Boolean(r));
    if (ordered.length === 0) notFound("Row");
    sourceRows = ordered;
  }

  let insertAt: number | null = null;
  if (body.anchorRowId && body.position) {
    const anchor = await prisma.datasetRow.findFirst({ where: { id: body.anchorRowId, datasetId: id } });
    if (!anchor) notFound("Row");
    insertAt = body.position === "above" ? anchor.rowIndex : anchor.rowIndex + 1;
  }

  const created = await prisma.$transaction(async (tx) => {
    let startIndex: number;
    if (insertAt === null) {
      startIndex = dataset.rowCount;
    } else {
      startIndex = insertAt;
      await tx.$executeRaw`UPDATE "DatasetRow" SET "rowIndex" = -("rowIndex" + ${sourceRows.length}) WHERE "datasetId" = ${id} AND "rowIndex" >= ${insertAt}`;
      await tx.$executeRaw`UPDATE "DatasetRow" SET "rowIndex" = -"rowIndex" WHERE "datasetId" = ${id} AND "rowIndex" < 0`;
    }

    const rows: Awaited<ReturnType<typeof tx.datasetRow.create>>[] = [];
    let nextIndex = startIndex;
    for (const src of sourceRows) {
      const row = await tx.datasetRow.create({
        data: { datasetId: id, rowIndex: nextIndex, data: (src.data ?? {}) as Prisma.InputJsonValue },
      });
      rows.push(row);
      nextIndex += 1;
    }
    await tx.dataset.update({ where: { id }, data: { rowCount: { increment: sourceRows.length } } });
    const verb = body.duplicateOf ? "Duplicated" : "Inserted";
    await logChange(
      tx,
      id,
      ChangeLogAction.ROW_INSERT,
      `${verb} ${rows.length} row${rows.length > 1 ? "s" : ""} at row${rows.length > 1 ? "s" : ""} ${formatRowNumbers(rows.map((r) => r.rowIndex))}`,
      {},
      { rows: rows.map((r) => ({ id: r.id, rowIndex: r.rowIndex, data: r.data })) },
    );
    return rows;
  });

  return NextResponse.json({ rows: created }, { status: 201 });
});
