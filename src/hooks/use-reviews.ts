import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import type { ReviewStatus } from "@/generated/prisma/browser";
import type { ReviewDto } from "@/types/workbench";

export function useUpsertReview(datasetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { predictionId: string; status: ReviewStatus; reviewedValue?: string | null }) =>
      apiPost<{ review: ReviewDto }>("/api/reviews", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workbench", datasetId] }),
  });
}
