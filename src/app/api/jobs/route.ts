import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, withErrorHandling } from "@/lib/api/respond";

const LIST_LIMIT = 100;

// Backs the Jobs/Activity panel — generation history for a workspace (or
// scoped to one dataset), newest first, with enough joined context to
// render a readable log without a second round trip per row.
export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const datasetId = url.searchParams.get("datasetId") ?? undefined;
  if (!workspaceId) throw new ApiError(422, "workspaceId is required.");

  const jobs = await prisma.job.findMany({
    where: { workspaceId, datasetId },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    include: {
      smartColumn: { select: { id: true, name: true, type: true } },
      dataset: { select: { id: true, filename: true } },
    },
  });

  return NextResponse.json({ jobs });
});
