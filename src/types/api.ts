import type { JobStatus, JobType } from "@/generated/prisma/browser";

export interface WorkspaceDto {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { datasets: number; smartColumns: number };
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
}

export interface TemplateDto {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  isBuiltIn: boolean;
  createdAt: string;
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
}
