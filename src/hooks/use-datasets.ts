import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { DatasetChangesResponse, DatasetListItemDto } from "@/types/api";
import type { DatasetColumnDto, DatasetRowDto, WorkbenchResponse } from "@/types/workbench";
import type { ColumnDataType, DatasetFormat } from "@/generated/prisma/browser";

export function useDatasets(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["datasets", workspaceId],
    queryFn: () => apiGet<{ datasets: DatasetListItemDto[] }>(`/api/datasets?workspaceId=${workspaceId}`),
    enabled: Boolean(workspaceId),
  });
}

export interface UploadPreview {
  storageKey: string;
  filename: string;
  format: DatasetFormat;
  columns: { name: string; dataType: ColumnDataType }[];
  rowCount: number;
  columnCount: number;
  warning?: string;
  // XLSX only — every sheet in the workbook, and the one being previewed.
  sheets?: string[];
  sheet?: string;
  sample: Record<string, unknown>[];
}

type UploadInput =
  | { workspaceId: string; file: File; sheet?: string }
  // Re-preview an already-staged workbook with a different sheet.
  | { workspaceId: string; storageKey: string; filename: string; sheet: string };

export function useUploadDataset() {
  return useMutation({
    mutationFn: (input: UploadInput) => {
      const form = new FormData();
      form.append("workspaceId", input.workspaceId);
      if ("file" in input) {
        form.append("file", input.file);
      } else {
        form.append("storageKey", input.storageKey);
        form.append("filename", input.filename);
      }
      if (input.sheet) form.append("sheet", input.sheet);
      return apiPost<UploadPreview>("/api/uploads", form);
    },
  });
}

export function useConfirmDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      storageKey: string;
      filename: string;
      format: DatasetFormat;
      sheet?: string;
      columns: { name: string; dataType: ColumnDataType; isSource: boolean }[];
    }) => apiPost<{ dataset: { id: string } }>("/api/datasets", data),
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ["datasets", variables.workspaceId] }),
  });
}

export function useRenameDataset(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, filename }: { id: string; filename: string }) =>
      apiPatch<{ dataset: { id: string; filename: string } }>(`/api/datasets/${id}`, { filename }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["datasets", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workbench", id], exact: false });
      qc.invalidateQueries({ queryKey: ["workspace-changes", workspaceId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useDeleteDataset(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: true }>(`/api/datasets/${id}`),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ["workbench", id] });
      qc.invalidateQueries({ queryKey: ["datasets", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["workspace-changes", workspaceId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useWorkbench(datasetId: string | undefined, page?: { page: number; pageSize: number }, enabled = true) {
  return useQuery({
    queryKey: page ? ["workbench", datasetId, page.page, page.pageSize] : ["workbench", datasetId],
    queryFn: () =>
      apiGet<WorkbenchResponse>(
        page ? `/api/datasets/${datasetId}/workbench?page=${page.page}&pageSize=${page.pageSize}` : `/api/datasets/${datasetId}/workbench`,
      ),
    enabled: Boolean(datasetId) && enabled,
    placeholderData: (prev) => prev,
  });
}

// Every row/column mutation below also writes a change-log entry (see
// src/lib/change-log.ts), so invalidating the workbench always invalidates
// the undo/redo history alongside it — one place to keep them in sync.
function invalidateWorkbench(qc: ReturnType<typeof useQueryClient>, datasetId: string) {
  qc.invalidateQueries({ queryKey: ["workbench", datasetId], exact: false });
  qc.invalidateQueries({ queryKey: ["datasets"], exact: false });
  qc.invalidateQueries({ queryKey: ["dataset-changes", datasetId] });
  qc.invalidateQueries({ queryKey: ["workspace-changes"], exact: false });
}

// --- Row wrangling: add / duplicate / edit / delete -------------------------

export interface CreateRowsInput {
  duplicateOf?: string[];
  anchorRowId?: string;
  position?: "above" | "below";
}

export function useCreateRows(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input?: CreateRowsInput) => apiPost<{ rows: DatasetRowDto[] }>(`/api/datasets/${datasetId}/rows`, input ?? {}),
    onSuccess: () => invalidateWorkbench(qc, datasetId),
  });
}

export function useUpdateRow(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, data }: { rowId: string; data: Record<string, unknown> }) =>
      apiPatch<{ row: DatasetRowDto }>(`/api/datasets/${datasetId}/rows/${rowId}`, { data }),
    onSuccess: () => invalidateWorkbench(qc, datasetId),
  });
}

export function useDeleteRows(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowIds: string[]) => apiPost<{ deleted: number }>(`/api/datasets/${datasetId}/rows/delete`, { rowIds }),
    onSuccess: () => invalidateWorkbench(qc, datasetId),
  });
}

// --- Column wrangling: add / rename / duplicate / delete --------------------

export interface AddColumnInput {
  name: string;
  anchorColumnId?: string;
  position?: "left" | "right";
}

export function useAddColumn(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddColumnInput) => apiPost<{ column: DatasetColumnDto }>(`/api/datasets/${datasetId}/columns`, input),
    onSuccess: () => invalidateWorkbench(qc, datasetId),
  });
}

export function useRenameColumn(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, name }: { columnId: string; name: string }) =>
      apiPatch<{ column: DatasetColumnDto }>(`/api/datasets/${datasetId}/columns/${columnId}`, { name }),
    onSuccess: () => invalidateWorkbench(qc, datasetId),
  });
}

export function useDuplicateColumn(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (columnId: string) => apiPost<{ column: DatasetColumnDto }>(`/api/datasets/${datasetId}/columns/${columnId}/duplicate`, {}),
    onSuccess: () => invalidateWorkbench(qc, datasetId),
  });
}

export function useDeleteColumn(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (columnId: string) => apiDelete<{ ok: true }>(`/api/datasets/${datasetId}/columns/${columnId}`),
    onSuccess: () => invalidateWorkbench(qc, datasetId),
  });
}

// --- Change log: undo / redo / revert ---------------------------------------

export function useDatasetChanges(datasetId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["dataset-changes", datasetId],
    queryFn: () => apiGet<DatasetChangesResponse>(`/api/datasets/${datasetId}/changes`),
    enabled: Boolean(datasetId) && enabled,
  });
}

export function useUndoChange(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ undone: { id: string; summary: string } }>(`/api/datasets/${datasetId}/changes/undo`, {}),
    onSuccess: () => invalidateWorkbench(qc, datasetId),
  });
}

export function useRedoChange(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ redone: { id: string; summary: string } }>(`/api/datasets/${datasetId}/changes/redo`, {}),
    onSuccess: () => invalidateWorkbench(qc, datasetId),
  });
}

export function useRevertChange(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changeId: string) =>
      apiPost<{ undone: { id: string; summary: string }[] }>(`/api/datasets/${datasetId}/changes/revert`, { changeId }),
    onSuccess: () => invalidateWorkbench(qc, datasetId),
  });
}
