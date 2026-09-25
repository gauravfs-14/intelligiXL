import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { smartColumnConfigSchema } from "@/lib/validation/smart-column";
import { withErrorHandling, notFound } from "@/lib/api/respond";
import { assertNoActiveJobs } from "@/lib/jobs/guard";
import { versionModelData } from "@/lib/smart-columns/version-model-data";
import { logActivity } from "@/lib/activity/log";

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

  const existing = await prisma.smartColumn.findUnique({
    where: { id },
    include: { versions: true, dataset: { select: { id: true, filename: true } } },
  });
  if (!existing) notFound("Smart Column");

  const nextVersionNumber = Math.max(...existing.versions.map((v) => v.versionNumber), 0) + 1;
  // Model/settings the request omits carry over from the version being edited.
  const previous =
    existing.versions.find((v) => v.id === existing.activeVersionId) ??
    [...existing.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0] ??
    null;
  const modelData = versionModelData(config, previous);

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
        ...modelData,
      },
    });
    const updated = await tx.smartColumn.update({
      where: { id },
      data: { name: config.name, type: config.type, activeVersionId: version.id },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });
    const renamed = existing.name !== config.name;
    await logActivity(
      {
        workspaceId: existing.workspaceId,
        category: "smartColumns",
        action: "smartColumn.edited",
        summary: renamed
          ? `Edited Smart Column “${existing.name}” (now “${config.name}”) — saved as version ${nextVersionNumber}`
          : `Edited Smart Column “${config.name}” — saved as version ${nextVersionNumber}`,
        dataset: { id: existing.dataset.id, name: existing.dataset.filename },
        metadata: {
          smartColumnId: id,
          version: nextVersionNumber,
          ...(renamed && { name: { from: existing.name, to: config.name } }),
          ...(previous && previous.question !== config.question && { question: { from: previous.question, to: config.question } }),
        },
      },
      tx,
    );
    return updated;
  });

  return NextResponse.json({ smartColumn });
});

export const DELETE = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const existing = await prisma.smartColumn.findUnique({
    where: { id },
    select: { id: true, name: true, workspaceId: true, dataset: { select: { id: true, filename: true } } },
  });
  if (!existing) notFound("Smart Column");
  await assertNoActiveJobs({ smartColumnId: id }, "Smart Column");
  await prisma.smartColumn.delete({ where: { id } });
  await logActivity({
    workspaceId: existing.workspaceId,
    category: "smartColumns",
    action: "smartColumn.deleted",
    summary: `Deleted Smart Column “${existing.name}” and its predictions`,
    dataset: { id: existing.dataset.id, name: existing.dataset.filename },
    metadata: { smartColumnId: id },
  });
  return NextResponse.json({ ok: true });
});
