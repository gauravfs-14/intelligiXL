"use client";

import * as React from "react";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { JobsDrawer } from "./jobs-drawer";

interface JobsDrawerContextValue {
  openJobsDrawer: () => void;
}

const JobsDrawerContext = React.createContext<JobsDrawerContextValue | null>(null);

/** Owns the one Jobs drawer for the workspace, so anything — the sidebar
 * button, the Overview "Active jobs" tile — can open it. */
export function JobsDrawerProvider({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const { datasetId } = useDatasetContext();
  const value = React.useMemo(() => ({ openJobsDrawer: () => setOpen(true) }), []);

  return (
    <JobsDrawerContext.Provider value={value}>
      {children}
      <JobsDrawer open={open} onOpenChange={setOpen} workspaceId={workspaceId} datasetId={datasetId ?? undefined} />
    </JobsDrawerContext.Provider>
  );
}

export function useJobsDrawer() {
  const ctx = React.useContext(JobsDrawerContext);
  if (!ctx) throw new Error("useJobsDrawer must be used inside JobsDrawerProvider");
  return ctx;
}
