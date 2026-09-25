import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { withErrorHandling, notFound } from "@/lib/api/respond";
import { assertNoActiveJobs } from "@/lib/jobs/guard";
import { logActivity, plural } from "@/lib/activity/log";

type Params = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: {
      columns: { orderBy: { position: "asc" } },
      _count: { select: { smartColumns: true } },
    },
  });
  if (!dataset) notFound("Dataset");
  return NextResponse.json({ dataset });
});

const updateSchema = z.object({
  filename: z.string().trim().min(1, "Name can't be empty.").max(200),
});

// Rename only — `filename` is the dataset's display name; the stored upload
// keeps its own storageKey, so nothing on disk moves.
export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const body = updateSchema.parse(await req.json());
  const existing = await prisma.dataset.findUnique({ where: { id }, select: { id: true, filename: true, workspaceId: true } });
  if (!existing) notFound("Dataset");
  const dataset = await prisma.dataset.update({ where: { id }, data: { filename: body.filename } });
  if (existing.filename !== body.filename) {
    await logActivity({
      workspaceId: existing.workspaceId,
      category: "datasets",
      action: "dataset.renamed",
      summary: `Renamed dataset “${existing.filename}” to “${body.filename}”`,
      dataset: { id, name: body.filename },
      metadata: { from: existing.filename, to: body.filename },
    });
  }
  return NextResponse.json({ dataset });
});

// NFR-010 — deleting a dataset removes its rows, columns, Smart Columns,
// predictions, reviews, jobs and change log (DB cascade), plus the uploaded
// file and any generated export files.
export const DELETE = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const dataset = await prisma.dataset.findUnique({ where: { id }, include: { exports: { select: { storageKey: true } } } });
  if (!dataset) notFound("Dataset");

  // A running job would keep writing predictions for rows that no longer
  // exist; make the user stop it first rather than racing the worker.
  await assertNoActiveJobs({ datasetId: id }, "dataset");

  await prisma.dataset.delete({ where: { id } });
  await logActivity({
    workspaceId: dataset.workspaceId,
    category: "datasets",
    action: "dataset.deleted",
    summary: `Deleted dataset “${dataset.filename}” (${plural(dataset.rowCount, "row")})`,
    dataset: { id, name: dataset.filename },
  });
  // Files last: if the DB delete fails, nothing is lost. Missing files are fine.
  await Promise.all([dataset.storageKey, ...dataset.exports.map((e) => e.storageKey)].map((key) => storage.delete(key).catch(() => undefined)));
  return NextResponse.json({ ok: true });
});
