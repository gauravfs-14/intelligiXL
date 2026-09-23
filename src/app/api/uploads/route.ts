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

// FR-003 — validate, detect headers/types, and return a sample for the user
// to confirm import. The raw file is written to storage immediately so the
// confirm step (POST /api/datasets) never has to re-upload anything.
export const POST = withErrorHandling(async (req: Request) => {
  const form = await req.formData();
  const file = form.get("file");
  const workspaceId = form.get("workspaceId");

  if (!(file instanceof File)) throw new ApiError(422, "No file was uploaded.");
  if (typeof workspaceId !== "string" || !workspaceId) throw new ApiError(422, "workspaceId is required.");

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const format = EXTENSION_FORMAT[ext];
  if (!format) {
    throw new ApiError(422, `Unsupported file type ".${ext}". Supported formats: CSV, XLSX, JSON, JSONL.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength === 0) throw new ApiError(422, "The file is empty.");

  const parsed = parseDataset(buffer, format);

  const storageKey = storageKeyFor("datasets", workspaceId, `${randomUUID()}.${ext}`);
  await storage.put(storageKey, buffer);

  return NextResponse.json({
    storageKey,
    filename: file.name,
    format,
    columns: parsed.columns,
    rowCount: parsed.rowCount,
    columnCount: parsed.columnCount,
    warning: parsed.warning,
    sample: parsed.rows.slice(0, SAMPLE_SIZE),
  });
});
