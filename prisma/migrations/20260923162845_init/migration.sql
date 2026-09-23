-- CreateEnum
CREATE TYPE "DatasetFormat" AS ENUM ('CSV', 'XLSX', 'JSON', 'JSONL');

-- CreateEnum
CREATE TYPE "DatasetStatus" AS ENUM ('VALIDATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ColumnDataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'JSON');

-- CreateEnum
CREATE TYPE "SmartColumnType" AS ENUM ('BINARY', 'CATEGORICAL', 'RATING');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'NOT_PROCESSED');

-- CreateEnum
CREATE TYPE "PredictionErrorReason" AS ENUM ('EMPTY_SOURCE', 'TIMEOUT', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE', 'INVALID_RESPONSE', 'AUTH_FAILURE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_REVIEWED', 'CONFIRMED', 'CORRECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SMART_COLUMN_GENERATION', 'SMART_COLUMN_RETRY', 'EXPORT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFormat" "DatasetFormat" NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "columnCount" INTEGER NOT NULL DEFAULT 0,
    "storageKey" TEXT NOT NULL,
    "status" "DatasetStatus" NOT NULL DEFAULT 'VALIDATING',
    "warning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetColumn" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataType" "ColumnDataType" NOT NULL,
    "position" INTEGER NOT NULL,
    "isSource" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DatasetColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetRow" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "DatasetRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartColumn" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SmartColumnType" NOT NULL,
    "activeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartColumnVersion" (
    "id" TEXT NOT NULL,
    "smartColumnId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "instructions" TEXT,
    "sourceColumns" TEXT[],
    "labels" JSONB NOT NULL,
    "unclearEnabled" BOOLEAN NOT NULL DEFAULT false,
    "modelProvider" TEXT NOT NULL DEFAULT 'typesafe',
    "modelIdentifier" TEXT NOT NULL DEFAULT 'jev-latest',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartColumnVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "datasetRowId" TEXT NOT NULL,
    "smartColumnVersionId" TEXT NOT NULL,
    "status" "PredictionStatus" NOT NULL DEFAULT 'PENDING',
    "errorReason" "PredictionErrorReason",
    "predictedLabel" TEXT,
    "confidence" DOUBLE PRECISION,
    "probabilities" JSONB,
    "score" DOUBLE PRECISION,
    "legend" JSONB,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "reviewedValue" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "datasetId" TEXT,
    "smartColumnId" TEXT,
    "smartColumnVersionId" TEXT,
    "errorLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "fields" JSONB NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_idx" ON "Dataset"("workspaceId");

-- CreateIndex
CREATE INDEX "DatasetColumn_datasetId_idx" ON "DatasetColumn"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetColumn_datasetId_name_key" ON "DatasetColumn"("datasetId", "name");

-- CreateIndex
CREATE INDEX "DatasetRow_datasetId_idx" ON "DatasetRow"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetRow_datasetId_rowIndex_key" ON "DatasetRow"("datasetId", "rowIndex");

-- CreateIndex
CREATE INDEX "SmartColumn_workspaceId_idx" ON "SmartColumn"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartColumn_datasetId_name_key" ON "SmartColumn"("datasetId", "name");

-- CreateIndex
CREATE INDEX "SmartColumnVersion_smartColumnId_idx" ON "SmartColumnVersion"("smartColumnId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartColumnVersion_smartColumnId_versionNumber_key" ON "SmartColumnVersion"("smartColumnId", "versionNumber");

-- CreateIndex
CREATE INDEX "Prediction_smartColumnVersionId_status_idx" ON "Prediction"("smartColumnVersionId", "status");

-- CreateIndex
CREATE INDEX "Prediction_smartColumnVersionId_confidence_idx" ON "Prediction"("smartColumnVersionId", "confidence");

-- CreateIndex
CREATE INDEX "Prediction_smartColumnVersionId_predictedLabel_idx" ON "Prediction"("smartColumnVersionId", "predictedLabel");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_datasetRowId_smartColumnVersionId_key" ON "Prediction"("datasetRowId", "smartColumnVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_predictionId_key" ON "Review"("predictionId");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Job_workspaceId_idx" ON "Job"("workspaceId");

-- CreateIndex
CREATE INDEX "Job_smartColumnVersionId_idx" ON "Job"("smartColumnVersionId");

-- CreateIndex
CREATE INDEX "Template_workspaceId_idx" ON "Template"("workspaceId");

-- CreateIndex
CREATE INDEX "StudyEvent_workspaceId_eventType_idx" ON "StudyEvent"("workspaceId", "eventType");

-- CreateIndex
CREATE INDEX "ExportRecord_workspaceId_idx" ON "ExportRecord"("workspaceId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetColumn" ADD CONSTRAINT "DatasetColumn_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRow" ADD CONSTRAINT "DatasetRow_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartColumn" ADD CONSTRAINT "SmartColumn_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartColumn" ADD CONSTRAINT "SmartColumn_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartColumnVersion" ADD CONSTRAINT "SmartColumnVersion_smartColumnId_fkey" FOREIGN KEY ("smartColumnId") REFERENCES "SmartColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_datasetRowId_fkey" FOREIGN KEY ("datasetRowId") REFERENCES "DatasetRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_smartColumnVersionId_fkey" FOREIGN KEY ("smartColumnVersionId") REFERENCES "SmartColumnVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_smartColumnId_fkey" FOREIGN KEY ("smartColumnId") REFERENCES "SmartColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_smartColumnVersionId_fkey" FOREIGN KEY ("smartColumnVersionId") REFERENCES "SmartColumnVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyEvent" ADD CONSTRAINT "StudyEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
