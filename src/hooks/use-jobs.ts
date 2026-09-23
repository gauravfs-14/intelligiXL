import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { JobDto, JobFailuresResponse } from "@/types/api";
import { isJobActive } from "./use-job";

/** The Jobs/Activity panel's list — polls quickly while anything is still
 * running, and settles down (no polling) once everything has finished. */
export function useJobs(workspaceId: string | undefined, datasetId?: string) {
  return useQuery({
    queryKey: ["jobs", workspaceId, datasetId],
    queryFn: () => {
      const params = new URLSearchParams({ workspaceId: workspaceId! });
      if (datasetId) params.set("datasetId", datasetId);
      return apiGet<{ jobs: JobDto[] }>(`/api/jobs?${params.toString()}`);
    },
    enabled: Boolean(workspaceId),
    refetchInterval: (query) => (query.state.data?.jobs.some((j) => isJobActive(j.status)) ? 2000 : false),
  });
}

export function useJobFailures(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job-failures", jobId],
    queryFn: () => apiGet<JobFailuresResponse>(`/api/jobs/${jobId}/failures`),
    enabled: Boolean(jobId),
  });
}
