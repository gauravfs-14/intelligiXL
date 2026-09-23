-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN     "jobId" TEXT;

-- CreateIndex
CREATE INDEX "Prediction_jobId_status_idx" ON "Prediction"("jobId", "status");

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
