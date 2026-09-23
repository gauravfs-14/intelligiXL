"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { toast } from "sonner";
import { X, XCircle } from "lucide-react";
import { useJob, isJobActive } from "@/hooks/use-job";
import { apiPatch } from "@/lib/api-client";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/ui/states";

// FR-017 progress tracking + FR-018 cancellation, rendered inline above the
// grid so generation never blocks the rest of the UI (NFR-003).
export function JobProgressBanner({ jobId, name, datasetId, onDismiss }: { jobId: string; name: string; datasetId: string; onDismiss: () => void }) {
  const { data } = useJob(jobId);
  const qc = useQueryClient();
  const job = data?.job;
  const lastCompletedRef = React.useRef(-1);

  React.useEffect(() => {
    if (!job) return;
    if (job.completedItems !== lastCompletedRef.current) {
      lastCompletedRef.current = job.completedItems;
      qc.invalidateQueries({ queryKey: ["workbench", datasetId] });
    }
    if (!isJobActive(job.status)) {
      qc.invalidateQueries({ queryKey: ["workbench", datasetId] });
      if (job.status === "COMPLETED") {
        toast.success(`"${name}" finished — ${job.completedItems.toLocaleString()} generated, ${job.failedItems} failed.`);
      } else if (job.status === "CANCELLED") {
        toast.info(`"${name}" cancelled. Already-generated rows were kept.`);
      } else if (job.status === "FAILED") {
        toast.error(`"${name}" failed to run.`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status, job?.completedItems]);

  if (!job) return null;

  async function cancel() {
    try {
      await apiPatch(`/api/jobs/${jobId}`, { status: "CANCELLED" });
    } catch {
      toast.error("Couldn't cancel — it may have already finished.");
    }
  }

  const active = isJobActive(job.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-3 border-b border-border-strong bg-accent-muted px-4 py-2"
    >
      {active ? <InlineSpinner className="text-accent" /> : job.status === "COMPLETED" ? null : <XCircle className="h-3.5 w-3.5 text-danger" />}
      <span className="shrink-0 text-sm font-medium">{name}</span>
      <div className="max-w-xs flex-1">
        <ProgressBar value={job.completedItems} max={job.totalItems} />
      </div>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {job.completedItems.toLocaleString()}/{job.totalItems.toLocaleString()}
        {job.failedItems > 0 && <span className="text-danger"> · {job.failedItems} failed</span>}
      </span>
      {active ? (
        <Button variant="ghost" size="sm" onClick={cancel}>
          Cancel
        </Button>
      ) : (
        <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      )}
    </motion.div>
  );
}
