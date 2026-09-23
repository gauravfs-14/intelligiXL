import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { SmartColumnConfig } from "@/types/smart-column";
import type { SmartColumnVersionDto } from "@/types/workbench";
import type { JobDto } from "@/types/api";
import type { PreviewRowResult } from "@/lib/smart-columns/preview";

export function useCreateSmartColumn(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { workspaceId: string; datasetId: string; config: SmartColumnConfig }) =>
      apiPost<{ smartColumn: { id: string } }>("/api/smart-columns", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workbench", datasetId] }),
  });
}

export function useUpdateSmartColumn(smartColumnId: string, datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: SmartColumnConfig) =>
      apiPatch<{ smartColumn: { id: string } }>(`/api/smart-columns/${smartColumnId}`, config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workbench", datasetId] }),
  });
}

export function useDeleteSmartColumn(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: true }>(`/api/smart-columns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workbench", datasetId] }),
  });
}

export interface PreviewRequest {
  datasetId: string;
  config: SmartColumnConfig;
  sampleMode: "random" | "first" | "manual";
  sampleSize?: number;
  rowIds?: string[];
}

export function usePreviewSmartColumn() {
  return useMutation({
    mutationFn: (data: PreviewRequest) => apiPost<{ results: PreviewRowResult[] }>("/api/smart-columns/preview", data),
  });
}

export function useGenerateSmartColumn(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (smartColumnId: string) => apiPost<{ job: JobDto }>(`/api/smart-columns/${smartColumnId}/generate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workbench", datasetId] }),
  });
}

export function useRetrySmartColumn(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (smartColumnId: string) => apiPost<{ job: JobDto }>(`/api/smart-columns/${smartColumnId}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workbench", datasetId] }),
  });
}

export function useSmartColumnVersions(smartColumnId: string | undefined) {
  return useQuery({
    queryKey: ["smart-column-versions", smartColumnId],
    queryFn: () =>
      apiGet<{ versions: (SmartColumnVersionDto & { _count: { predictions: number } })[] }>(
        `/api/smart-columns/${smartColumnId}/versions`,
      ),
    enabled: Boolean(smartColumnId),
  });
}

export interface CompareVersionsResult {
  comparable: number;
  agree: number;
  disagree: number;
  agreementRate: number | null;
  avgConfidenceDelta: number | null;
  disagreements: { datasetRowId: string; labelA: string | null; labelB: string | null; confidenceA: number | null; confidenceB: number | null }[];
}

export function useCompareVersions(smartColumnId: string | undefined, a: string | undefined, b: string | undefined) {
  return useQuery({
    queryKey: ["compare-versions", smartColumnId, a, b],
    queryFn: () => apiGet<CompareVersionsResult>(`/api/smart-columns/${smartColumnId}/compare-versions?a=${a}&b=${b}`),
    enabled: Boolean(smartColumnId && a && b),
  });
}
