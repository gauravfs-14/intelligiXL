"use client";

import { Activity } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { ChangeLogPanel } from "@/components/data-grid/change-log-panel";
import { useJobs } from "@/hooks/use-jobs";
import { isJobActive } from "@/hooks/use-job";
import { JobRow } from "./job-row";

// FR-017/018/019 living in one place: every generation/retry run for this
// workspace (or, when a dataset is selected, scoped to it), with live
// progress for active runs and a per-row failure log for finished ones.
// When a dataset is selected, a second tab holds its data change history
// (cell edits, row/column changes) with undo/redo/revert.
export function JobsDrawer({
  open,
  onOpenChange,
  workspaceId,
  datasetId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  datasetId?: string;
}) {
  const { data, isLoading, isError, refetch } = useJobs(open ? workspaceId : undefined, datasetId);
  const jobs = data?.jobs ?? [];
  const activeJobs = jobs.filter((j) => isJobActive(j.status));
  const pastJobs = jobs.filter((j) => !isJobActive(j.status));

  const jobsList = (
    <div className="flex flex-col gap-6">
      {isLoading && <TableSkeleton rows={3} cols={1} />}
      {isError && <ErrorState description="Couldn't load jobs." onRetry={() => refetch()} />}

      {!isLoading && !isError && jobs.length === 0 && (
        <EmptyState icon={Activity} title="No jobs yet" description="Generate a Smart Column to see progress and logs here." />
      )}

      {activeJobs.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active</p>
          {activeJobs.map((job) => (
            <JobRow key={job.id} job={job} onOpenLive={() => onOpenChange(false)} />
          ))}
        </div>
      )}

      {pastJobs.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</p>
          {pastJobs.map((job) => (
            <JobRow key={job.id} job={job} onOpenLive={() => onOpenChange(false)} />
          ))}
        </div>
      )}
    </div>
  );

  if (!datasetId) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Generation jobs" description="Live progress and per-row logs for every run.">
        {jobsList}
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Activity" description="Generation jobs and data changes for this dataset.">
      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="changes">Data changes</TabsTrigger>
        </TabsList>
        <TabsContent value="jobs" className="mt-4">
          {jobsList}
        </TabsContent>
        <TabsContent value="changes" className="mt-4">
          <ChangeLogPanel datasetId={datasetId} open={open} />
        </TabsContent>
      </Tabs>
    </Sheet>
  );
}
