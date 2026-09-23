import { ColumnDataType } from "@/generated/prisma/client";

const BOOL_STRINGS = new Set(["true", "false"]);

function isBoolLike(v: unknown): boolean {
  return typeof v === "boolean" || (typeof v === "string" && BOOL_STRINGS.has(v.trim().toLowerCase()));
}

function isNumberLike(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (s === "") return false;
  return Number.isFinite(Number(s));
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function isDateLike(v: unknown): boolean {
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v !== "string") return false;
  const s = v.trim();
  return DATE_PATTERN.test(s) && !Number.isNaN(Date.parse(s));
}

/** Infers a column's type from a sample of its values (FR-003 step 3). */
export function inferColumnType(values: unknown[]): ColumnDataType {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonNull.length === 0) return ColumnDataType.STRING;
  if (nonNull.some((v) => typeof v === "object" && v !== null && !(v instanceof Date))) {
    return ColumnDataType.JSON;
  }
  if (nonNull.every(isBoolLike)) return ColumnDataType.BOOLEAN;
  if (nonNull.every(isDateLike)) return ColumnDataType.DATE;
  if (nonNull.every(isNumberLike)) return ColumnDataType.NUMBER;
  return ColumnDataType.STRING;
}
