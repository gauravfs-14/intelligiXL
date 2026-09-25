import type { ChangeLogAction, JobStatus, JobType, PredictionErrorReason, SmartColumnType } from "@/generated/prisma/browser";

export interface WorkspaceDto {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { datasets: number; smartColumns: number };
}

export type JobLogLevel = "info" | "success" | "warning" | "error";

export interface JobLogEntry {
  ts: string;
  level: JobLogLevel;
  message: string;
}

export interface JobDto {
  id: string;
  workspaceId: string;
  jobType: JobType;
  status: JobStatus;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  datasetId: string | null;
  smartColumnId: string | null;
  smartColumnVersionId: string | null;
  createdAt: string;
  finishedAt: string | null;
  logs?: JobLogEntry[] | null;
  smartColumn?: { id: string; name: string; type: SmartColumnType } | null;
  dataset?: { id: string; filename: string } | null;
  /** Only on GET /api/jobs/[id]: when the first row of this run was written. */
  startedAt?: string | null;
  /** Only on GET /api/jobs/[id]. */
  smartColumnVersion?: { versionNumber: number; modelProvider: string; modelIdentifier: string } | null;
}

export interface JobFailureDto {
  id: string;
  datasetRowId: string;
  rowIndex: number;
  errorReason: PredictionErrorReason | null;
  updatedAt: string;
  sourceSnippet: string;
}

export interface JobFailuresResponse {
  job: JobDto;
  smartColumnName: string | null;
  totalFailures: number;
  truncated: boolean;
  failures: JobFailureDto[];
}

export interface TemplateDto {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  isBuiltIn: boolean;
  category: string | null;
  tags: string[];
  usageCount: number;
  createdAt: string;
}

export interface DatasetChangeDto {
  id: string;
  action: ChangeLogAction;
  summary: string;
  undone: boolean;
  createdAt: string;
}

export interface DatasetChangesResponse {
  changes: DatasetChangeDto[];
  canUndo: boolean;
  canRedo: boolean;
}

export interface ActivityLogDto {
  id: string;
  workspaceId: string;
  category: string;
  action: string;
  summary: string;
  datasetId: string | null;
  datasetName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkspaceChangeDto {
  id: string;
  action: ChangeLogAction;
  summary: string;
  undone: boolean;
  createdAt: string;
  datasetId: string;
  datasetFilename: string;
}

export interface DatasetListItemDto {
  id: string;
  workspaceId: string;
  filename: string;
  originalFormat: string;
  rowCount: number;
  columnCount: number;
  status: string;
  warning: string | null;
  createdAt: string;
  _count: { smartColumns: number };
  smartColumns: {
    id: string;
    name: string;
    type: SmartColumnType;
    activeVersionId: string | null;
    /** Unreviewed predictions below the column's review threshold. */
    needsReview: number;
    reviewThreshold: number;
  }[];
}
