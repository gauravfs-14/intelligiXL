import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type { TemplateDto } from "@/types/api";

export function useTemplates(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["templates", workspaceId],
    queryFn: () => apiGet<{ templates: TemplateDto[] }>(`/api/templates?workspaceId=${workspaceId}`),
    enabled: Boolean(workspaceId),
  });
}

export function useSaveTemplate(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; config: Record<string, unknown> }) =>
      apiPost<{ template: TemplateDto }>("/api/templates", { workspaceId, ...data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates", workspaceId] }),
  });
}

export function useDeleteTemplate(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: true }>(`/api/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates", workspaceId] }),
  });
}

export function useUseTemplate(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ template: TemplateDto }>(`/api/templates/${id}/use`, { workspaceId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates", workspaceId] }),
  });
}
