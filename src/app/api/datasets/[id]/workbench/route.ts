import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound } from "@/lib/api/respond";

type Params = { params: Promise<{ id: string }> };

// The single data source behind the Data Grid, Review Queue, and Insights:
// one fetch returns every row, every Smart Column's active version, and
// every prediction + review for this dataset. At the SRS's target scale
// (<=10k rows, <=100 cols) this is simpler and faster than re-deriving
// filter/sort state on the server for every view, and keeps all three
// screens reading from one consistent in-memory snapshot.
export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;

  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: { columns: { orderBy: { position: "asc" } } },
  });
  if (!dataset) notFound("Dataset");

  const [rows, smartColumns] = await Promise.all([
    prisma.datasetRow.findMany({ where: { datasetId: id }, orderBy: { rowIndex: "asc" } }),
    prisma.smartColumn.findMany({
      where: { datasetId: id },
      orderBy: { createdAt: "asc" },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    }),
  ]);

  const activeVersionIds = smartColumns.map((sc) => sc.activeVersionId).filter((v): v is string => Boolean(v));

  const predictions = await prisma.prediction.findMany({
    where: { smartColumnVersionId: { in: activeVersionIds }, datasetRow: { datasetId: id } },
    include: { review: true },
  });

  return NextResponse.json({
    dataset,
    rows,
    smartColumns: smartColumns.map((sc) => ({
      id: sc.id,
      workspaceId: sc.workspaceId,
      datasetId: sc.datasetId,
      name: sc.name,
      type: sc.type,
      createdAt: sc.createdAt,
      updatedAt: sc.updatedAt,
      activeVersion: sc.versions.find((v) => v.id === sc.activeVersionId) ?? null,
      versionCount: sc.versions.length,
    })),
    predictions,
  });
});
