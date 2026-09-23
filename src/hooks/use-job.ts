import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { JobDto } from "@/types/api";

const ACTIVE = new Set(["QUEUED", "RUNNING"]);

export function isJobActive(status: string): boolean {
  return ACTIVE.has(status);
}

/** Polls while the job is in flight, stops once it settles. */
export function useJob(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => apiGet<{ job: JobDto }>(`/api/jobs/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.job.status;
      return status && isJobActive(status) ? 1200 : false;
    },
  });
}
