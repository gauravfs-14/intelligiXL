import * as XLSX from "xlsx";
import { assembleRows, dedupeHeaders } from "./assemble";
import { DatasetValidationError } from "./errors";

export function parseXlsx(buffer: Buffer) {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new DatasetValidationError("The XLSX file could not be read. It may be corrupted.");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new DatasetValidationError("The workbook has no sheets.");
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });

  if (rows.length === 0) {
    throw new DatasetValidationError("The file is empty.");
  }

  const [rawHeader, ...rawRows] = rows;
  const { headers, warning } = dedupeHeaders(rawHeader);
  return { headers, rows: assembleRows(headers, rawRows), warning };
}
