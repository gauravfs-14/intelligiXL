import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { withErrorHandling, notFound } from "@/lib/api/respond";
import { isActivityCategory } from "@/lib/activity/categories";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// The workspace's activity log, newest first, cursor-paginated.
// ?categories=a,b  ?datasetId=…  ?q=text  ?cursor=<last entry id>  ?limit=n
export const GET = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const url = new URL(req.url);
  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { id: true } });
  if (!workspace) notFound("Workspace");

  const categories = (url.searchParams.get("categories") ?? "").split(",").filter(isActivityCategory);
  const datasetId = url.searchParams.get("datasetId");
  const q = url.searchParams.get("q")?.trim();
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const where: Prisma.ActivityLogWhereInput = {
    workspaceId: id,
    ...(categories.length > 0 && { category: { in: categories } }),
    ...(datasetId && { datasetId }),
    ...(q && {
      OR: [{ summary: { contains: q, mode: "insensitive" } }, { datasetName: { contains: q, mode: "insensitive" } }],
    }),
  };

  const rows = await prisma.activityLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
  const entries = rows.slice(0, limit);
  return NextResponse.json({ entries, nextCursor: rows.length > limit ? entries[entries.length - 1].id : null });
});
