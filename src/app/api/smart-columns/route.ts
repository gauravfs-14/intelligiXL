import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { smartColumnConfigSchema } from "@/lib/validation/smart-column";
import { ApiError, withErrorHandling } from "@/lib/api/respond";
import { versionModelData } from "@/lib/smart-columns/version-model-data";
import { logActivity } from "@/lib/activity/log";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  datasetId: z.string().min(1),
  config: smartColumnConfigSchema,
});

// FR-007 — creates a Smart Column and its first version (version 1).
export const POST = withErrorHandling(async (req: Request) => {
  const body = createSchema.parse(await req.json());

  const dup = await prisma.smartColumn.findUnique({
    where: { datasetId_name: { datasetId: body.datasetId, name: body.config.name } },
  });
  if (dup) throw new ApiError(409, `A Smart Column named "${body.config.name}" already exists on this dataset.`);

  const modelData = versionModelData(body.config);

  const { smartColumn } = await prisma.$transaction(async (tx) => {
    const smartColumn = await tx.smartColumn.create({
      data: {
        workspaceId: body.workspaceId,
        datasetId: body.datasetId,
        name: body.config.name,
        type: body.config.type,
      },
    });
    const version = await tx.smartColumnVersion.create({
      data: {
        smartColumnId: smartColumn.id,
        versionNumber: 1,
        question: body.config.question,
        instructions: body.config.instructions,
        sourceColumns: body.config.sourceColumns,
        labels: body.config.labels,
        unclearEnabled: body.config.unclearEnabled ?? false,
        ...modelData,
      },
    });
    const updated = await tx.smartColumn.update({
      where: { id: smartColumn.id },
      data: { activeVersionId: version.id },
      include: { versions: true },
    });
    const dataset = await tx.dataset.findUniqueOrThrow({ where: { id: body.datasetId }, select: { id: true, filename: true } });
    await logActivity(
      {
        workspaceId: body.workspaceId,
        category: "smartColumns",
        action: "smartColumn.created",
        summary: `Created Smart Column “${body.config.name}” (${body.config.type.toLowerCase()}) — “${body.config.question}”`,
        dataset: { id: dataset.id, name: dataset.filename },
        metadata: { smartColumnId: smartColumn.id, type: body.config.type, sourceColumns: body.config.sourceColumns },
      },
      tx,
    );
    return { smartColumn: updated };
  });

  return NextResponse.json({ smartColumn }, { status: 201 });
});
