import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { withErrorHandling, notFound } from "@/lib/api/respond";
import { assertNoActiveJobs } from "@/lib/jobs/guard";
import { logActivity } from "@/lib/activity/log";

type Params = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: { _count: { select: { datasets: true, smartColumns: true } } },
  });
  if (!workspace) notFound("Workspace");
  return NextResponse.json({ workspace });
});

const updateSchema = z.object({
  name: z.string().trim().min(1, "Name can't be empty.").max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const body = updateSchema.parse(await req.json());
  const existing = await prisma.workspace.findUnique({ where: { id }, select: { name: true, description: true } });
  if (!existing) notFound("Workspace");
  // An emptied description is stored as null rather than "".
  const description = body.description === undefined ? undefined : body.description || null;
  const workspace = await prisma.workspace.update({
    where: { id },
    data: { ...body, ...(description !== undefined && { description }) },
  });

  const renamed = body.name !== undefined && body.name !== existing.name;
  const describedChange = description !== undefined && description !== existing.description;
  const descriptionPhrase = description ? "updated the description" : "cleared the description";
  const changes: string[] = [];
  if (renamed) changes.push(`Renamed workspace “${existing.name}” to “${body.name}”`);
  if (describedChange) changes.push(renamed ? descriptionPhrase : `${descriptionPhrase[0].toUpperCase()}${descriptionPhrase.slice(1)} of the workspace`);
  if (changes.length > 0) {
    await logActivity({
      workspaceId: id,
      category: "workspace",
      action: "workspace.updated",
      summary: changes.join(" and "),
      metadata: {
        ...(renamed && { name: { from: existing.name, to: body.name } }),
        ...(describedChange && { description: { from: existing.description, to: description } }),
      },
    });
  }
  return NextResponse.json({ workspace });
});

// NFR-010 — deleting a Workspace cascades to its datasets, Smart Columns,
// jobs, templates, and exports at the database level.
// Deletes the workspace and everything in it (DB cascade), then the
// uploaded dataset files and generated exports it owned.
export const DELETE = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { datasets: { select: { storageKey: true } }, exports: { select: { storageKey: true } } },
  });
  if (!workspace) notFound("Workspace");
  await assertNoActiveJobs({ workspaceId: id }, "workspace");

  await prisma.workspace.delete({ where: { id } });
  // Files last: if the DB delete fails, nothing is lost. Missing files are fine.
  const keys = [...workspace.datasets, ...workspace.exports].map((f) => f.storageKey);
  await Promise.all(keys.map((key) => storage.delete(key).catch(() => undefined)));
  return NextResponse.json({ ok: true });
});
