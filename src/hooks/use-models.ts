import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { ModelProviderInfo } from "@/lib/decision-models/catalog";

export interface ModelsResponse {
  providers: ModelProviderInfo[];
}

/** Providers + models for the Smart Column model selector (GET /api/models). */
export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: () => apiGet<ModelsResponse>("/api/models"),
    staleTime: 60_000,
  });
}
