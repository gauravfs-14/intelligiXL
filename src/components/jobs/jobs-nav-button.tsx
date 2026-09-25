"use client";

import * as React from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJobs } from "@/hooks/use-jobs";
import { isJobActive } from "@/hooks/use-job";
import { useJobsDrawer } from "./jobs-drawer-context";

/** Always mounted (topbar or sidebar footer) so generation activity stays
 * visible no matter which section you're looking at. */
export function JobsNavButton({
  workspaceId,
  variant = "topbar",
  compact = false,
}: {
  workspaceId: string;
  variant?: "topbar" | "sidebar";
  /** Icon only, no "Jobs" label — for a collapsed sidebar. */
  compact?: boolean;
}) {
  const { openJobsDrawer } = useJobsDrawer();
  const { data } = useJobs(workspaceId);
  const activeCount = data?.jobs.filter((j) => isJobActive(j.status)).length ?? 0;

  return (
    <button
        onClick={openJobsDrawer}
        className={cn(
          "relative flex items-center gap-1.5 text-sm font-medium transition-all",
          variant === "topbar"
            ? "h-9 rounded-full border border-border bg-surface px-3 hover:border-foreground/25 hover:shadow-flat-sm"
            : compact
              ? "h-9 w-9 justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              : "flex-1 rounded-xl px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        aria-label="Generation jobs"
      >
        <Activity className="h-3.5 w-3.5 shrink-0" />
        {variant === "topbar" && <span className="hidden sm:inline">Jobs</span>}
        {variant === "sidebar" && !compact && <span>Jobs</span>}
        {activeCount > 0 && (
          <span className={cn("relative flex h-2 w-2 shrink-0", compact && "absolute right-1 top-1")}>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-signal shadow-[0_0_8px_var(--signal)]" />
          </span>
        )}
    </button>
  );
}
