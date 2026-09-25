-- CreateEnum
CREATE TYPE "ChangeLogAction" AS ENUM ('CELL_EDIT', 'ROW_INSERT', 'ROW_DELETE', 'COLUMN_INSERT', 'COLUMN_DELETE', 'COLUMN_RENAME', 'COLUMN_DUPLICATE');

-- CreateTable
CREATE TABLE "DatasetChangeLog" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "action" "ChangeLogAction" NOT NULL,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "undone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatasetChangeLog_datasetId_createdAt_idx" ON "DatasetChangeLog"("datasetId", "createdAt");

-- AddForeignKey
ALTER TABLE "DatasetChangeLog" ADD CONSTRAINT "DatasetChangeLog_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
