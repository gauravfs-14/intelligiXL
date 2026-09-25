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
//
// The Data Grid alone opts into pagination via `?page=&pageSize=` so a huge
// dataset doesn't have to be pulled into the browser in one shot — Review,
// Insights, and Export omit those params and keep getting the full snapshot,
// since they genuinely need every row to compute correctly.
export const GET = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const url = new URL(req.url);
  const pageParam = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize");
  const paginated = pageParam !== null || pageSizeParam !== null;
  const page = Math.max(1, Number(pageParam) || 1);
  const pageSize = Math.min(2000, Math.max(1, Number(pageSizeParam) || 200));

  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: { columns: { orderBy: { position: "asc" } } },
  });
  if (!dataset) notFound("Dataset");

  const [rows, totalRows, smartColumns] = await Promise.all([
    prisma.datasetRow.findMany({
      where: { datasetId: id },
      orderBy: { rowIndex: "asc" },
      ...(paginated ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    }),
    paginated ? prisma.datasetRow.count({ where: { datasetId: id } }) : Promise.resolve(dataset.rowCount),
    prisma.smartColumn.findMany({
      where: { datasetId: id },
      orderBy: { createdAt: "asc" },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    }),
  ]);

  const activeVersionIds = smartColumns.map((sc) => sc.activeVersionId).filter((v): v is string => Boolean(v));

  const predictions = await prisma.prediction.findMany({
    where: {
      smartColumnVersionId: { in: activeVersionIds },
      datasetRow: paginated ? { id: { in: rows.map((r) => r.id) } } : { datasetId: id },
    },
    include: { review: true },
  });

  return NextResponse.json({
    dataset,
    rows,
    ...(paginated ? { page, pageSize, totalRows } : {}),
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
