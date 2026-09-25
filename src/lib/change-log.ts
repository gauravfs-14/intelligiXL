import { Prisma, ChangeLogAction, type ColumnDataType } from "@/generated/prisma/client";
import { datasetRef, logActivity, type ActivityCategory } from "@/lib/activity/log";

type Tx = Prisma.TransactionClient;

export { ChangeLogAction };

export interface RowSnapshot {
  id: string;
  rowIndex: number;
  data: Prisma.JsonValue;
}

export interface ColumnSnapshot {
  id: string;
  name: string;
  position: number;
  dataType: ColumnDataType;
  isSource: boolean;
}

export interface ColumnValueSnapshot {
  rowId: string;
  value: Prisma.JsonValue;
}

// Every payload below is a plain object (never null/undefined) — the side an
// action doesn't need is just `{}` — so callers and this module never have
// to juggle Prisma's DbNull/JsonNull distinction for an optional Json column.
type CellEditPayload = { rowId: string; columnName: string; value: unknown };
type RowsPayload = { rows: RowSnapshot[] };
type ColumnPayload = { column: ColumnSnapshot; values: ColumnValueSnapshot[] };
type RenamePayload = { columnId: string; name: string };

/** A cell value as it should read in a change-log summary — quoted and
 * truncated for long text, "(empty)" for null/undefined, so a summary never
 * turns into an unreadable wall of text for a long "Article Text" cell. */
export function formatLogValue(value: unknown, max = 30): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  const str = String(value);
  return `"${str.length > max ? `${str.slice(0, max - 1)}…` : str}"`;
}

/** "1, 2, 3" for a handful of 0-based row indexes, capped so a 500-row bulk
 * delete doesn't produce a summary longer than the change itself. */
export function formatRowNumbers(rowIndexes: number[], cap = 10): string {
  const sorted = [...rowIndexes].sort((a, b) => a - b).map((i) => i + 1);
  if (sorted.length <= cap) return sorted.join(", ");
  return `${sorted.slice(0, cap).join(", ")}, +${sorted.length - cap} more`;
}

const ACTIVITY_FOR_ACTION: Record<ChangeLogAction, { category: ActivityCategory; action: string }> = {
  CELL_EDIT: { category: "cells", action: "cell.edited" },
  ROW_INSERT: { category: "rows", action: "rows.added" },
  ROW_DELETE: { category: "rows", action: "rows.deleted" },
  COLUMN_INSERT: { category: "columns", action: "column.added" },
  COLUMN_DELETE: { category: "columns", action: "column.deleted" },
  COLUMN_RENAME: { category: "columns", action: "column.renamed" },
  COLUMN_DUPLICATE: { category: "columns", action: "column.duplicated" },
};

/** Records one invertible change and — per the standard undo/redo rule —
 * discards whatever redo history existed, since a fresh edit invalidates it.
 * Every data edit funnels through here, so this is also where it lands in
 * the workspace activity log (same transaction). */
export async function logChange(tx: Tx, datasetId: string, action: ChangeLogAction, summary: string, before: object, after: object) {
  await tx.datasetChangeLog.deleteMany({ where: { datasetId, undone: true } });
  await tx.datasetChangeLog.create({
    data: { datasetId, action, summary, before: before as Prisma.InputJsonValue, after: after as Prisma.InputJsonValue },
  });
  const ref = await datasetRef(datasetId, tx);
  if (ref) await logActivity({ ...ref, ...ACTIVITY_FOR_ACTION[action], summary }, tx);
}

/** Snapshot every row's current value for a column, for COLUMN_DELETE/COLUMN_DUPLICATE payloads. */
export async function getColumnValues(tx: Tx, datasetId: string, columnName: string): Promise<ColumnValueSnapshot[]> {
  const rows = await tx.datasetRow.findMany({ where: { datasetId }, select: { id: true, data: true } });
  return rows
    .filter((r) => Object.prototype.hasOwnProperty.call(r.data as object, columnName))
    .map((r) => ({ rowId: r.id, value: (r.data as Record<string, Prisma.JsonValue>)[columnName] }));
}

async function recreateRows(tx: Tx, datasetId: string, rows: RowSnapshot[]) {
  if (rows.length === 0) return;
  for (const r of rows) {
    await tx.datasetRow.create({ data: { id: r.id, datasetId, rowIndex: r.rowIndex, data: r.data as Prisma.InputJsonValue } });
  }
  await tx.dataset.update({ where: { id: datasetId }, data: { rowCount: { increment: rows.length } } });
}

async function removeRows(tx: Tx, datasetId: string, rowIds: string[]) {
  if (rowIds.length === 0) return;
  const { count } = await tx.datasetRow.deleteMany({ where: { id: { in: rowIds }, datasetId } });
  if (count > 0) await tx.dataset.update({ where: { id: datasetId }, data: { rowCount: { decrement: count } } });
}

async function setCellValue(tx: Tx, rowId: string, columnName: string, value: unknown) {
  const json = JSON.stringify(value ?? null);
  await tx.$executeRaw`UPDATE "DatasetRow" SET data = jsonb_set(data, ARRAY[${columnName}]::text[], ${json}::jsonb, true) WHERE id = ${rowId}`;
}

async function recreateColumn(tx: Tx, datasetId: string, column: ColumnSnapshot, values: ColumnValueSnapshot[]) {
  await tx.datasetColumn.create({
    data: { id: column.id, datasetId, name: column.name, dataType: column.dataType, position: column.position, isSource: column.isSource },
  });
  await tx.dataset.update({ where: { id: datasetId }, data: { columnCount: { increment: 1 } } });
  for (const v of values) await setCellValue(tx, v.rowId, column.name, v.value);
}

async function removeColumn(tx: Tx, datasetId: string, columnId: string, columnName: string) {
  await tx.$executeRaw`UPDATE "DatasetRow" SET data = data - ${columnName}::text WHERE "datasetId" = ${datasetId}`;
  await tx.datasetColumn.delete({ where: { id: columnId } });
  await tx.dataset.update({ where: { id: datasetId }, data: { columnCount: { decrement: 1 } } });
}

export async function renameColumnKeys(tx: Tx, datasetId: string, columnId: string, fromName: string, toName: string) {
  await tx.$executeRaw`
    UPDATE "DatasetRow"
    SET data = (data - ${fromName}::text) || jsonb_build_object(${toName}::text, data -> ${fromName}::text)
    WHERE "datasetId" = ${datasetId} AND jsonb_exists(data, ${fromName}::text)
  `;
  await tx.datasetColumn.update({ where: { id: columnId }, data: { name: toName } });
}

/** Reverse one change-log entry — restores the state captured in `before`
 * (or removes what `after` had created). Column position / row-index gaps
 * left behind are intentional (see the row/column routes' own comments). */
export async function undoLastChange(tx: Tx, datasetId: string) {
  const log = await tx.datasetChangeLog.findFirst({ where: { datasetId, undone: false }, orderBy: { createdAt: "desc" } });
  if (!log) return null;

  switch (log.action) {
    case ChangeLogAction.CELL_EDIT: {
      const p = log.before as unknown as CellEditPayload;
      await setCellValue(tx, p.rowId, p.columnName, p.value);
      break;
    }
    case ChangeLogAction.ROW_INSERT:
      await removeRows(tx, datasetId, (log.after as unknown as RowsPayload).rows.map((r) => r.id));
      break;
    case ChangeLogAction.ROW_DELETE:
      await recreateRows(tx, datasetId, (log.before as unknown as RowsPayload).rows);
      break;
    case ChangeLogAction.COLUMN_INSERT:
    case ChangeLogAction.COLUMN_DUPLICATE: {
      const p = log.after as unknown as ColumnPayload;
      await removeColumn(tx, datasetId, p.column.id, p.column.name);
      break;
    }
    case ChangeLogAction.COLUMN_DELETE: {
      const p = log.before as unknown as ColumnPayload;
      await recreateColumn(tx, datasetId, p.column, p.values);
      break;
    }
    case ChangeLogAction.COLUMN_RENAME: {
      const b = log.before as unknown as RenamePayload;
      const a = log.after as unknown as RenamePayload;
      await renameColumnKeys(tx, datasetId, b.columnId, a.name, b.name);
      break;
    }
  }

  await tx.datasetChangeLog.update({ where: { id: log.id }, data: { undone: true } });
  return log;
}

/** Re-apply the most recently undone entry for this dataset — the mirror of undoLastChange. */
export async function redoLastChange(tx: Tx, datasetId: string) {
  const log = await tx.datasetChangeLog.findFirst({ where: { datasetId, undone: true }, orderBy: { createdAt: "desc" } });
  if (!log) return null;

  switch (log.action) {
    case ChangeLogAction.CELL_EDIT: {
      const p = log.after as unknown as CellEditPayload;
      await setCellValue(tx, p.rowId, p.columnName, p.value);
      break;
    }
    case ChangeLogAction.ROW_INSERT:
      await recreateRows(tx, datasetId, (log.after as unknown as RowsPayload).rows);
      break;
    case ChangeLogAction.ROW_DELETE:
      await removeRows(tx, datasetId, (log.before as unknown as RowsPayload).rows.map((r) => r.id));
      break;
    case ChangeLogAction.COLUMN_INSERT:
    case ChangeLogAction.COLUMN_DUPLICATE: {
      const p = log.after as unknown as ColumnPayload;
      await recreateColumn(tx, datasetId, p.column, p.values);
      break;
    }
    case ChangeLogAction.COLUMN_DELETE: {
      const p = log.before as unknown as ColumnPayload;
      await removeColumn(tx, datasetId, p.column.id, p.column.name);
      break;
    }
    case ChangeLogAction.COLUMN_RENAME: {
      const b = log.before as unknown as RenamePayload;
      const a = log.after as unknown as RenamePayload;
      await renameColumnKeys(tx, datasetId, b.columnId, b.name, a.name);
      break;
    }
  }

  await tx.datasetChangeLog.update({ where: { id: log.id }, data: { undone: false } });
  return log;
}
