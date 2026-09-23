"use client";

import * as React from "react";
import { Activity } from "lucide-react";
import { useJobs } from "@/hooks/use-jobs";
import { isJobActive } from "@/hooks/use-job";
import { JobsDrawer } from "./jobs-drawer";

/** Always mounted in the nav (not just on the Data page) so generation
 * activity stays visible no matter which section you're looking at. */
export function JobsNavButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = React.useState(false);
  const { data } = useJobs(workspaceId);
  const activeCount = data?.jobs.filter((j) => isJobActive(j.status)).length ?? 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex h-9 items-center gap-1.5 border border-border-strong bg-surface px-3 text-sm font-medium transition-shadow hover:shadow-flat-sm"
        aria-label="Generation jobs"
      >
        <Activity className="h-3.5 w-3.5 text-muted" />
        <span className="hidden sm:inline">Jobs</span>
        {activeCount > 0 && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 bg-accent" />
          </span>
        )}
      </button>
      <JobsDrawer open={open} onOpenChange={setOpen} workspaceId={workspaceId} />
    </>
  );
}
