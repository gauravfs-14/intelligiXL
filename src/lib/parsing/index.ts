import { DatasetFormat, ColumnDataType } from "@/generated/prisma/client";
import { parseCsv } from "./csv";
import { parseXlsx } from "./xlsx";
import { parseJson, parseJsonl } from "./json";
import { inferColumnType } from "./detect-types";
import { DatasetValidationError } from "./errors";

export { DatasetValidationError };

export interface ParsedColumn {
  name: string;
  dataType: ColumnDataType;
}

export interface ParsedDataset {
  columns: ParsedColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  columnCount: number;
  warning?: string;
}

// FR-004 minimums the prototype must support without complaint.
const WARN_ROW_COUNT = 20_000;
const WARN_COLUMN_COUNT = 150;
const TYPE_SAMPLE_SIZE = 1000;

export function parseDataset(buffer: Buffer, format: DatasetFormat): ParsedDataset {
  const { headers, rows, warning: headerWarning } =
    format === DatasetFormat.CSV
      ? parseCsv(buffer.toString("utf-8"))
      : format === DatasetFormat.XLSX
        ? parseXlsx(buffer)
        : format === DatasetFormat.JSON
          ? parseJson(buffer.toString("utf-8"))
          : parseJsonl(buffer.toString("utf-8"));

  const sample = rows.slice(0, TYPE_SAMPLE_SIZE);
  const columns: ParsedColumn[] = headers.map((name) => ({
    name,
    dataType: inferColumnType(sample.map((r) => r[name])),
  }));

  const warnings = [headerWarning].filter((w): w is string => Boolean(w));
  if (rows.length > WARN_ROW_COUNT) {
    warnings.push(`This dataset has ${rows.length.toLocaleString()} rows; imports this large may take a while to process.`);
  }
  if (headers.length > WARN_COLUMN_COUNT) {
    warnings.push(`This dataset has ${headers.length} columns; consider hiding columns you don't need in the grid.`);
  }

  return {
    columns,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}
