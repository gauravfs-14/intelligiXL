import * as XLSX from "xlsx";
import { assembleRows, dedupeHeaders } from "./assemble";
import { DatasetValidationError } from "./errors";

function sheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
}

// `sheetName` picks which sheet to import; when omitted we default to the
// first sheet that has any content, so a blank cover sheet doesn't block the
// preview. `sheets` lists every sheet so the upload step can offer a picker.
export function parseXlsx(buffer: Buffer, sheetName?: string) {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new DatasetValidationError("The XLSX file could not be read. It may be corrupted.");
  }

  const sheets = workbook.SheetNames;
  if (sheets.length === 0) {
    throw new DatasetValidationError("The workbook has no sheets.");
  }

  let sheet: string;
  let rows: unknown[][];
  if (sheetName !== undefined) {
    if (!sheets.includes(sheetName)) {
      throw new DatasetValidationError(`The workbook has no sheet named "${sheetName}".`);
    }
    sheet = sheetName;
    rows = sheetRows(workbook, sheet);
    if (rows.length === 0) {
      throw new DatasetValidationError(`The sheet "${sheet}" is empty.`);
    }
  } else {
    const found = sheets.map((name) => ({ name, rows: sheetRows(workbook, name) })).find((s) => s.rows.length > 0);
    if (!found) {
      throw new DatasetValidationError("The file is empty.");
    }
    sheet = found.name;
    rows = found.rows;
  }

  const [rawHeader, ...rawRows] = rows;
  const { headers, warning } = dedupeHeaders(rawHeader);
  return { headers, rows: assembleRows(headers, rawRows), warning, sheets, sheet };
}
