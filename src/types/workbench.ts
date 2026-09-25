import type {
  ColumnDataType,
  DatasetFormat,
  DatasetStatus,
  PredictionErrorReason,
  PredictionStatus,
  ReviewStatus,
  SmartColumnType,
} from "@/generated/prisma/browser";
import type { SmartColumnLabels } from "@/types/smart-column";
import type { SmartColumnSettings } from "@/lib/decision-models/catalog";

// Hand-written client-side DTOs (not the raw Prisma model types): API
// responses serialize Date -> ISO string over JSON, so these mirror what
// actually arrives on the wire rather than fighting a mapped Date->string type.

export interface DatasetColumnDto {
  id: string;
  name: string;
  dataType: ColumnDataType;
  position: number;
  isSource: boolean;
}

export interface DatasetDto {
  id: string;
  workspaceId: string;
  filename: string;
  originalFormat: DatasetFormat;
  rowCount: number;
  columnCount: number;
  status: DatasetStatus;
  warning: string | null;
  createdAt: string;
  columns: DatasetColumnDto[];
}

export interface DatasetRowDto {
  id: string;
  datasetId: string;
  rowIndex: number;
  data: Record<string, unknown>;
}

export interface SmartColumnVersionDto {
  id: string;
  smartColumnId: string;
  versionNumber: number;
  question: string;
  instructions: string | null;
  sourceColumns: string[];
  labels: SmartColumnLabels;
  unclearEnabled: boolean;
  modelProvider: string;
  modelIdentifier: string;
  /** null for versions created before run settings existed — pass through
   * resolveSettings() to get the effective values. */
  settings: Partial<SmartColumnSettings> | null;
  createdAt: string;
}

export interface WorkbenchSmartColumnDto {
  id: string;
  workspaceId: string;
  datasetId: string;
  name: string;
  type: SmartColumnType;
  createdAt: string;
  updatedAt: string;
  activeVersion: SmartColumnVersionDto | null;
  versionCount: number;
}

export interface ReviewDto {
  id: string;
  predictionId: string;
  reviewedValue: string | null;
  status: ReviewStatus;
  reviewerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PredictionDto {
  id: string;
  datasetRowId: string;
  smartColumnVersionId: string;
  status: PredictionStatus;
  errorReason: PredictionErrorReason | null;
  predictedLabel: string | null;
  confidence: number | null;
  probabilities: Record<string, number> | null;
  score: number | null;
  legend: Record<string, string> | null;
  modelVersion: string | null;
  createdAt: string;
  updatedAt: string;
  review: ReviewDto | null;
}

export interface WorkbenchResponse {
  dataset: DatasetDto;
  rows: DatasetRowDto[];
  smartColumns: WorkbenchSmartColumnDto[];
  predictions: PredictionDto[];
  // Present only when the request opted into pagination (`?page=&pageSize=`).
  page?: number;
  pageSize?: number;
  totalRows?: number;
}
