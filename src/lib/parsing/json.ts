import { DatasetValidationError } from "./errors";

function collectHeaders(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  return [...seen];
}

function assertRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DatasetValidationError(`Expected an object at ${context}, got ${Array.isArray(value) ? "an array" : typeof value}.`);
  }
  return value as Record<string, unknown>;
}

export function parseJson(content: string) {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (e) {
    throw new DatasetValidationError("The JSON file could not be parsed.", [e instanceof Error ? e.message : String(e)]);
  }
  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) {
    throw new DatasetValidationError("The file is empty.");
  }
  const rows = arr.map((row, i) => assertRecord(row, `row ${i + 1}`));
  const headers = collectHeaders(rows);
  return { headers, rows, warning: undefined as string | undefined };
}

export function parseJsonl(content: string) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new DatasetValidationError("The file is empty.");
  }
  const rows = lines.map((line, i) => {
    try {
      return assertRecord(JSON.parse(line), `line ${i + 1}`);
    } catch (e) {
      throw new DatasetValidationError(`Line ${i + 1} is not valid JSON.`, [e instanceof Error ? e.message : String(e)]);
    }
  });
  const headers = collectHeaders(rows);
  return { headers, rows, warning: undefined as string | undefined };
}
