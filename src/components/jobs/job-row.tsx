"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RotateCcw, XCircle } from "lucide-react";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { InlineSpinner } from "@/components/ui/states";
import { apiPatch } from "@/lib/api-client";
import { PREDICTION_ERROR_LABEL } from "@/lib/prediction-error-labels";
import { useJobFailures } from "@/hooks/use-jobs";
import { useRetrySmartColumn } from "@/hooks/use-smart-columns";
import { isJobActive } from "@/hooks/use-job";
import { JobStatusBadge } from "./job-status-badge";
import type { JobDto } from "@/types/api";

const JOB_TYPE_LABEL: Record<string, string> = {
  SMART_COLUMN_GENERATION: "Generate",
  SMART_COLUMN_RETRY: "Retry failed rows",
  EXPORT: "Export",
};

export function JobRow({ job }: { job: JobDto }) {
  const [expanded, setExpanded] = React.useState(false);
  const active = isJobActive(job.status);
  const retry = useRetrySmartColumn(job.datasetId ?? "");
  const { data: failuresData, isLoading: failuresLoading } = useJobFailures(expanded ? job.id : undefined);

  async function cancel() {
    try {
      await apiPatch(`/api/jobs/${job.id}`, { status: "CANCELLED" });
    } catch {
      toast.error("Couldn't cancel — it may have already finished.");
    }
  }

  async function retryFailed() {
    if (!job.smartColumnId) return;
    try {
      await retry.mutateAsync(job.smartColumnId);
      toast.success("Retrying failed rows…");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't retry.");
    }
  }

  return (
    <Panel>
      <PanelBody className="flex flex-col gap-2 p-3">
        <div
          role="button"
          tabIndex={0}
          className="flex w-full cursor-pointer items-start gap-2 text-left"
          onClick={() => setExpanded((e) => !e)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold">{job.smartColumn?.name ?? "Deleted Smart Column"}</span>
              <JobStatusBadge status={job.status} />
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{JOB_TYPE_LABEL[job.jobType] ?? job.jobType}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
              {job.dataset && <> · {job.dataset.filename}</>}
            </p>
            {active && (
              <div className="mt-2 max-w-xs">
                <ProgressBar value={job.completedItems} max={job.totalItems} />
              </div>
            )}
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {job.completedItems.toLocaleString()}/{job.totalItems.toLocaleString()}
              {job.failedItems > 0 && <span className="text-danger"> · {job.failedItems} failed</span>}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
            {active && (
              <Button variant="ghost" size="sm" onClick={cancel}>
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
            {!active && job.failedItems > 0 && job.smartColumnId && (
              <Button variant="outline" size="sm" onClick={retryFailed} loading={retry.isPending}>
                <RotateCcw className="h-3.5 w-3.5" /> Retry
              </Button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="ml-5 border-t border-border pt-2">
            {failuresLoading && (
              <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                <InlineSpinner /> Loading log…
              </div>
            )}
            {!failuresLoading && failuresData && failuresData.failures.length === 0 && (
              <p className="py-2 text-xs text-muted-foreground">No failed rows for this run.</p>
            )}
            {!failuresLoading && failuresData && failuresData.failures.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {failuresData.truncated && (
                  <p className="text-[11px] text-muted-foreground">
                    Showing the first {failuresData.failures.length} of {failuresData.totalFailures.toLocaleString()} failures.
                  </p>
                )}
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  {failuresData.failures.map((f) => (
                    <div key={f.id} className="flex items-start gap-2 border-b border-border px-2 py-1.5 text-xs last:border-b-0">
                      <span className="shrink-0 font-mono text-muted-foreground">#{f.rowIndex + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={f.sourceSnippet}>
                        {f.sourceSnippet || "(empty)"}
                      </span>
                      <span className="shrink-0 text-danger">{PREDICTION_ERROR_LABEL[f.errorReason ?? "UNKNOWN"]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
