import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { withErrorHandling, notFound } from "@/lib/api/respond";

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

// NFR-010 — deleting a dataset removes its rows, columns, Smart Columns, and
// predictions (DB cascade), plus the underlying uploaded file.
export const DELETE = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const dataset = await prisma.dataset.findUnique({ where: { id } });
  if (!dataset) notFound("Dataset");
  await prisma.dataset.delete({ where: { id } });
  await storage.delete(dataset.storageKey);
  return NextResponse.json({ ok: true });
});
