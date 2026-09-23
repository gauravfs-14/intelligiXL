import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { smartColumnConfigSchema } from "@/lib/validation/smart-column";
import { ApiError, withErrorHandling } from "@/lib/api/respond";

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
      },
    });
    const updated = await tx.smartColumn.update({
      where: { id: smartColumn.id },
      data: { activeVersionId: version.id },
      include: { versions: true },
    });
    return { smartColumn: updated };
  });

  return NextResponse.json({ smartColumn }, { status: 201 });
});
