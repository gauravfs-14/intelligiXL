import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type { DatasetListItemDto } from "@/types/api";
import type { WorkbenchResponse } from "@/types/workbench";
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
  sample: Record<string, unknown>[];
}

export function useUploadDataset() {
  return useMutation({
    mutationFn: ({ workspaceId, file }: { workspaceId: string; file: File }) => {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("file", file);
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
      columns: { name: string; dataType: ColumnDataType; isSource: boolean }[];
    }) => apiPost<{ dataset: { id: string } }>("/api/datasets", data),
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ["datasets", variables.workspaceId] }),
  });
}

export function useDeleteDataset(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: true }>(`/api/datasets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets", workspaceId] }),
  });
}

export function useWorkbench(datasetId: string | undefined) {
  return useQuery({
    queryKey: ["workbench", datasetId],
    queryFn: () => apiGet<WorkbenchResponse>(`/api/datasets/${datasetId}/workbench`),
    enabled: Boolean(datasetId),
  });
}
