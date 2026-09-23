import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/respond";

type Params = { params: Promise<{ id: string }> };

// FR-040 — full version history for a Smart Column.
export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const versions = await prisma.smartColumnVersion.findMany({
    where: { smartColumnId: id },
    orderBy: { versionNumber: "desc" },
    include: { _count: { select: { predictions: true } } },
  });
  return NextResponse.json({ versions });
});
