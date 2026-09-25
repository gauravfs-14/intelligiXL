"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { CheckCircle2, SquareTerminal, X, XCircle } from "lucide-react";
import { useJob, isJobActive } from "@/hooks/use-job";
import { useJobs } from "@/hooks/use-jobs";
import { apiPatch } from "@/lib/api-client";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineSpinner } from "@/components/ui/states";
import type { JobDto } from "@/types/api";

// A finished run's banner lingers this long (unless dismissed), so a job that
// finished while you were on another page still tells you how it went.
const RECENT_MS = 10 * 60 * 1000;

function dismissedKey(workspaceId: string) {
  return `intelligixl:${workspaceId}:dismissed-jobs`;
}

function readDismissed(workspaceId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(dismissedKey(workspaceId)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** FR-017 — one banner per generation run in this workspace that's running
 * or just finished. Derived from the server's job list (not local state), so
 * it's still there after navigating away and back, or reloading. */
export function JobBanners({ workspaceId, currentDatasetId }: { workspaceId: string; currentDatasetId: string | null }) {
  const { data } = useJobs(workspaceId);
  const [dismissed, setDismissed] = React.useState(() => readDismissed(workspaceId));
  // Snapshot once per render pass; a lingering banner expiring a few seconds
  // late (on the next job poll) is fine.
  const [now] = React.useState(() => Date.now());

  const jobs = (data?.jobs ?? []).filter(
    (j) =>
      !dismissed.has(j.id) &&
      (isJobActive(j.status) || (j.finishedAt !== null && now - new Date(j.finishedAt).getTime() < RECENT_MS)),
  );

  function dismiss(id: string) {
    setDismissed((cur) => {
      const next = new Set(cur).add(id);
      try {
        sessionStorage.setItem(dismissedKey(workspaceId), JSON.stringify([...next].slice(-200)));
      } catch {
        // Blocked storage — the dismissal just won't survive navigation.
      }
      return next;
    });
  }

  return (
    <AnimatePresence initial={false}>
      {jobs.map((j) => (
        <JobProgressBanner
          key={j.id}
          summary={j}
          workspaceId={workspaceId}
          showDataset={j.datasetId !== currentDatasetId}
          onDismiss={() => dismiss(j.id)}
        />
      ))}
    </AnimatePresence>
  );
}

// FR-017 progress tracking + FR-018 cancellation, rendered inline above the
// grid so generation never blocks the rest of the UI (NFR-003).
function JobProgressBanner({
  summary,
  workspaceId,
  showDataset,
  onDismiss,
}: {
  summary: JobDto;
  workspaceId: string;
  showDataset: boolean;
  onDismiss: () => void;
}) {
  // The list polls every 2s; this polls the one job faster while it runs.
  const { data } = useJob(summary.id);
  const qc = useQueryClient();
  const job = data?.job ?? summary;
  const datasetId = job.datasetId ?? "";
  const name = `${summary.smartColumn?.name ?? "Smart Column"}${job.jobType === "SMART_COLUMN_RETRY" ? " (retry)" : ""}`;
  const lastCompletedRef = React.useRef(-1);
  const prevStatusRef = React.useRef(job.status);

  React.useEffect(() => {
    if (job.completedItems !== lastCompletedRef.current) {
      lastCompletedRef.current = job.completedItems;
      qc.invalidateQueries({ queryKey: ["workbench", datasetId] });
    }
    const wasActive = isJobActive(prevStatusRef.current);
    prevStatusRef.current = job.status;
    // Toast only on a transition we watched — not for a banner that mounted
    // already finished (that happened while you were elsewhere).
    if (wasActive && !isJobActive(job.status)) {
      qc.invalidateQueries({ queryKey: ["workbench", datasetId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      if (job.status === "COMPLETED") {
        toast.success(`"${name}" finished — ${job.completedItems.toLocaleString()} generated, ${job.failedItems} failed.`);
      } else if (job.status === "CANCELLED") {
        toast.info(`"${name}" cancelled. Already-generated rows were kept.`);
      } else if (job.status === "FAILED") {
        toast.error(`"${name}" failed to run.`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.status, job.completedItems]);

  async function cancel() {
    try {
      await apiPatch(`/api/jobs/${job.id}`, { status: "CANCELLED" });
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
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-primary/10 px-4 py-2"
    >
      {active ? (
        <InlineSpinner className="text-primary" />
      ) : job.status === "COMPLETED" ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-danger" />
      )}
      <span className="min-w-0 shrink truncate text-sm font-medium">
        {name}
        {showDataset && summary.dataset && <span className="font-normal text-muted-foreground"> · {summary.dataset.filename}</span>}
        {!active && <span className="font-normal text-muted-foreground"> · {job.status.toLowerCase()}</span>}
      </span>
      <div className="min-w-[6rem] max-w-xs flex-1">
        <ProgressBar value={job.completedItems + job.failedItems} max={job.totalItems} tone={active ? "primary" : job.status === "COMPLETED" ? "success" : "danger"} />
      </div>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {(job.completedItems + job.failedItems).toLocaleString()}/{job.totalItems.toLocaleString()}
        {job.failedItems > 0 && <span className="text-danger"> · {job.failedItems} failed</span>}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Link href={`/w/${workspaceId}/jobs/${job.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <SquareTerminal className="h-3.5 w-3.5" /> {active ? "Live log" : "View log"}
        </Link>
        {active ? (
          <Button variant="ghost" size="sm" onClick={cancel}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
