import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api-client";
import type { ActivityLogDto, WorkspaceChangeDto, WorkspaceDto } from "@/types/api";
import type { ActivityCategory, ActivitySettings } from "@/lib/activity/categories";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: () => apiGet<{ workspaces: WorkspaceDto[] }>("/api/workspaces"),
  });
}

export function useWorkspace(id: string | undefined) {
  return useQuery({
    queryKey: ["workspace", id],
    queryFn: () => apiGet<{ workspace: WorkspaceDto }>(`/api/workspaces/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiPost<{ workspace: WorkspaceDto }>("/api/workspaces", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useUpdateWorkspace(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; description?: string | null }) =>
      apiPatch<{ workspace: WorkspaceDto }>(`/api/workspaces/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["workspace", id] });
    },
  });
}

/** Recent cell/row/column edits across every dataset in the workspace — the
 * Overview page's "what changed recently" panel. */
export function useWorkspaceChanges(id: string | undefined) {
  return useQuery({
    queryKey: ["workspace-changes", id],
    queryFn: () => apiGet<{ changes: WorkspaceChangeDto[] }>(`/api/workspaces/${id}/changes`),
    enabled: Boolean(id),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: true }>(`/api/workspaces/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export interface ActivityFilters {
  categories?: ActivityCategory[];
  datasetId?: string;
  q?: string;
}

/** The workspace activity log, newest first, loaded a page at a time. Polls
 * while mounted so background events (a generation run finishing) show up. */
export function useActivityLog(workspaceId: string | undefined, filters: ActivityFilters) {
  return useInfiniteQuery({
    queryKey: ["activity", workspaceId, "log", filters],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filters.categories?.length) params.set("categories", filters.categories.join(","));
      if (filters.datasetId) params.set("datasetId", filters.datasetId);
      if (filters.q) params.set("q", filters.q);
      if (pageParam) params.set("cursor", pageParam);
      return apiGet<{ entries: ActivityLogDto[]; nextCursor: string | null }>(`/api/workspaces/${workspaceId}/activity?${params}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(workspaceId),
    refetchInterval: 15_000,
  });
}

export function useActivitySettings(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["activity", workspaceId, "settings"],
    queryFn: () => apiGet<{ settings: ActivitySettings }>(`/api/workspaces/${workspaceId}/activity/settings`),
    enabled: Boolean(workspaceId),
  });
}

export function useUpdateActivitySettings(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<ActivitySettings>) =>
      apiPut<{ settings: ActivitySettings }>(`/api/workspaces/${workspaceId}/activity/settings`, { settings }),
    onSuccess: (data) => qc.setQueryData(["activity", workspaceId, "settings"], data),
  });
}
