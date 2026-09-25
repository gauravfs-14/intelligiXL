-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "logs" JSONB;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "category" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0;
