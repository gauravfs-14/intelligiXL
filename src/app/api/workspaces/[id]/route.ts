import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound } from "@/lib/api/respond";

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
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const body = updateSchema.parse(await req.json());
  const workspace = await prisma.workspace.update({ where: { id }, data: body });
  return NextResponse.json({ workspace });
});

// NFR-010 — deleting a Workspace cascades to its datasets, Smart Columns,
// jobs, templates, and exports at the database level.
export const DELETE = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  await prisma.workspace.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
