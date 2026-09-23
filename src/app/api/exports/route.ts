import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ExportFormat } from "@/generated/prisma/client";
import { withErrorHandling } from "@/lib/api/respond";

// FR-037/038 — the CSV/XLSX bytes are generated client-side from data the
// browser already has (the dataset workbench). This endpoint just records
// that an export happened, for provenance/audit (NFR-013/014) — what was
// exported, in what shape, and when.
const logSchema = z.object({
  workspaceId: z.string().min(1),
  datasetId: z.string().min(1),
  format: z.nativeEnum(ExportFormat),
  fields: z.array(z.string()),
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = logSchema.parse(await req.json());
  const record = await prisma.exportRecord.create({
    data: {
      workspaceId: body.workspaceId,
      datasetId: body.datasetId,
      format: body.format,
      fields: body.fields,
      storageKey: "",
    },
  });
  return NextResponse.json({ record }, { status: 201 });
});

export const GET = withErrorHandling(async (req: Request) => {
  const datasetId = new URL(req.url).searchParams.get("datasetId");
  const records = await prisma.exportRecord.findMany({
    where: datasetId ? { datasetId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ records });
});
