import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import type { ConnectionStatus, SettingKey, SettingState } from "@/lib/settings/definitions";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<{ settings: SettingState[] }>("/api/settings"),
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: SettingKey; value: string | null }) => apiPut<{ settings: SettingState[] }>("/api/settings", data),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      // Provider availability in the model picker depends on these.
      qc.invalidateQueries({ queryKey: ["models"] });
      qc.invalidateQueries({ queryKey: ["connection"] });
    },
  });
}

/** Live connection check for one provider; `refetch()` re-tests. Only
 * runs when that provider has something configured. */
export function useConnectionStatus(provider: ConnectionStatus["provider"], enabled: boolean) {
  return useQuery({
    queryKey: ["connection", provider],
    queryFn: () => apiPost<{ status: ConnectionStatus }>("/api/settings/test", { provider }).then((r) => r.status),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}
