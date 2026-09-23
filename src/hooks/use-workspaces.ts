import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { WorkspaceDto } from "@/types/api";

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

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: true }>(`/api/workspaces/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}
