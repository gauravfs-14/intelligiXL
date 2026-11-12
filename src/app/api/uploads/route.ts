import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DatasetFormat } from "@/generated/prisma/client";
import { parseDataset } from "@/lib/parsing";
import { storage, storageKeyFor } from "@/lib/storage";
import { ApiError, withErrorHandling } from "@/lib/api/respond";

export const runtime = "nodejs";

const EXTENSION_FORMAT: Record<string, DatasetFormat> = {
  csv: DatasetFormat.CSV,
  xlsx: DatasetFormat.XLSX,
  json: DatasetFormat.JSON,
  jsonl: DatasetFormat.JSONL,
  ndjson: DatasetFormat.JSONL,
};

const SAMPLE_SIZE = 20;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// FR-003 — validate, detect headers/types, and return a sample for the user
// to confirm import. The raw file is written to storage immediately so the
// confirm step (POST /api/datasets) never has to re-upload anything.
//
// For workbooks, `sheet` selects which sheet to preview. Switching sheets
// re-previews the already-staged file: send `storageKey` + `filename` instead
// of `file`.
export const POST = withErrorHandling(async (req: Request) => {
  const form = await req.formData();
  const file = form.get("file");
  const workspaceId = form.get("workspaceId");
  const sheetField = form.get("sheet");
  const sheet = typeof sheetField === "string" && sheetField ? sheetField : undefined;

  if (typeof workspaceId !== "string" || !workspaceId) throw new ApiError(422, "workspaceId is required.");

  let filename: string;
  let buffer: Buffer;
  let storageKey: string;
  let staged = false;

  if (file instanceof File) {
    if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "Uploads are limited to 20 MiB.");
    filename = file.name;
    buffer = Buffer.from(await file.arrayBuffer());
    storageKey = "";
  } else {
    const stagedKey = form.get("storageKey");
    const stagedName = form.get("filename");
    if (typeof stagedKey !== "string" || !stagedKey) throw new ApiError(422, "No file was uploaded.");
    if (typeof stagedName !== "string" || !stagedName) throw new ApiError(422, "filename is required.");
    // Only files this workspace staged itself — never an arbitrary path.
    const prefix = storageKeyFor("datasets", workspaceId) + "/";
    if (!stagedKey.startsWith(prefix) || stagedKey.includes("..")) throw new ApiError(422, "Invalid storageKey.");
    if (!(await storage.exists(stagedKey))) {
      throw new ApiError(410, "The staged upload has expired. Please upload the file again.");
    }
    filename = stagedName;
    buffer = await storage.get(stagedKey);
    storageKey = stagedKey;
    staged = true;
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const format = EXTENSION_FORMAT[ext];
  if (!format) {
    throw new ApiError(422, `Unsupported file type ".${ext}". Supported formats: CSV, XLSX, JSON, JSONL.`);
  }
  if (buffer.byteLength === 0) throw new ApiError(422, "The file is empty.");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new ApiError(413, "Uploads are limited to 20 MiB.");

  const parsed = parseDataset(buffer, format, { sheet });

  if (!staged) {
    storageKey = storageKeyFor("datasets", workspaceId, `${randomUUID()}.${ext}`);
    await storage.put(storageKey, buffer);
  }

  return NextResponse.json({
    storageKey,
    filename,
    format,
    columns: parsed.columns,
    rowCount: parsed.rowCount,
    columnCount: parsed.columnCount,
    warning: parsed.warning,
    sheets: parsed.sheets,
    sheet: parsed.sheet,
    sample: parsed.rows.slice(0, SAMPLE_SIZE),
  });
});
