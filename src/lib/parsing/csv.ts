import Papa from "papaparse";
import { assembleRows, dedupeHeaders } from "./assemble";
import { DatasetValidationError } from "./errors";

export function parseCsv(content: string) {
  const result = Papa.parse<unknown[]>(content, {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
  });

  const fatal = result.errors.filter((e) => e.type !== "FieldMismatch");
  if (fatal.length > 0) {
    throw new DatasetValidationError(
      "The CSV file could not be parsed.",
      fatal.slice(0, 5).map((e) => `Row ${e.row ?? "?"}: ${e.message}`),
    );
  }

  const rows = result.data;
  if (rows.length === 0) {
    throw new DatasetValidationError("The file is empty.");
  }

  const [rawHeader, ...rawRows] = rows;
  const { headers, warning } = dedupeHeaders(rawHeader);
  return { headers, rows: assembleRows(headers, rawRows), warning };
}
