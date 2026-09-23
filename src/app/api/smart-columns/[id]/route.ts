import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { smartColumnConfigSchema } from "@/lib/validation/smart-column";
import { withErrorHandling, notFound } from "@/lib/api/respond";

type Params = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const smartColumn = await prisma.smartColumn.findUnique({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });
  if (!smartColumn) notFound("Smart Column");
  return NextResponse.json({ smartColumn });
});

// FR-040 — editing a Smart Column's definition creates a new version instead
// of mutating the active one in place, so past predictions stay attributable
// to the exact question/labels that produced them.
export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const config = smartColumnConfigSchema.parse(await req.json());

  const existing = await prisma.smartColumn.findUnique({ where: { id }, include: { versions: true } });
  if (!existing) notFound("Smart Column");

  const nextVersionNumber = Math.max(...existing.versions.map((v) => v.versionNumber), 0) + 1;

  const smartColumn = await prisma.$transaction(async (tx) => {
    const version = await tx.smartColumnVersion.create({
      data: {
        smartColumnId: id,
        versionNumber: nextVersionNumber,
        question: config.question,
        instructions: config.instructions,
        sourceColumns: config.sourceColumns,
        labels: config.labels,
        unclearEnabled: config.unclearEnabled ?? false,
      },
    });
    return tx.smartColumn.update({
      where: { id },
      data: { name: config.name, type: config.type, activeVersionId: version.id },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });
  });

  return NextResponse.json({ smartColumn });
});

export const DELETE = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  await prisma.smartColumn.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
