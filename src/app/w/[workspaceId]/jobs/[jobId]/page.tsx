"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowLeft, Copy, Pause, RotateCcw, Table2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ErrorState, InlineSpinner, Skeleton } from "@/components/ui/states";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { LOG_LEVEL_CLASS } from "@/components/jobs/job-row";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { useJob, isJobActive } from "@/hooks/use-job";
import { useRetrySmartColumn } from "@/hooks/use-smart-columns";
import { apiPatch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { JobLogEntry, JobLogLevel } from "@/types/api";

const JOB_TYPE_LABEL: Record<string, string> = {
  SMART_COLUMN_GENERATION: "Generation run",
  SMART_COLUMN_RETRY: "Retry of failed rows",
  EXPORT: "Export",
};

const LEVEL_FILTERS: { id: "all" | JobLogLevel; label: string }[] = [
  { id: "all", label: "All" },
  { id: "warning", label: "Flagged" },
  { id: "error", label: "Errors" },
];

// The worker keeps only the most recent entries (see JobLogger).
const LOG_CAP = 300;

export default function JobLivePage({ params }: PageProps<"/w/[workspaceId]/jobs/[jobId]">) {
  const { workspaceId, jobId } = use(params);
  const router = useRouter();
  const { setDatasetId } = useDatasetContext();
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useJob(jobId);
  const job = data?.job;
  const active = job ? isJobActive(job.status) : false;
  const retry = useRetrySmartColumn(job?.datasetId ?? "");
  const now = useNow(active);

  const [levelFilter, setLevelFilter] = React.useState<"all" | JobLogLevel>("all");
  const logs = React.useMemo(() => job?.logs ?? [], [job?.logs]);
  const visible = React.useMemo(
    () => (levelFilter === "all" ? logs : logs.filter((l) => l.level === levelFilter)),
    [logs, levelFilter],
  );

  if (isLoading) {
    return (
      <Shell workspaceId={workspaceId}>
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </Shell>
    );
  }
  if (isError || !job) {
    return (
      <Shell workspaceId={workspaceId}>
        <ErrorState description="This job couldn't be loaded. It may have been deleted along with its dataset." onRetry={() => refetch()} />
      </Shell>
    );
  }

  const processed = job.completedItems + job.failedItems;
  const pct = job.totalItems > 0 ? Math.min(100, Math.round((processed / job.totalItems) * 100)) : 0;
  // Processing start (first row written, per the API) — not logs[0], which
  // on a long run is only seconds old because the log is a ring buffer.
  const startedAt = new Date(job.startedAt ?? job.createdAt).getTime();
  const queued = job.status === "QUEUED";
  const endedAt = job.finishedAt ? new Date(job.finishedAt).getTime() : now;
  const elapsedMs = queued ? 0 : Math.max(0, endedAt - startedAt);
  const rate = elapsedMs > 1000 ? processed / (elapsedMs / 1000) : 0;
  const remaining = Math.max(0, job.totalItems - processed);
  const remainingMs = active && rate > 0 ? (remaining / rate) * 1000 : null;
  // The whole job's duration: what's run so far + the rest at the current pace.
  const totalMs = active ? (remainingMs !== null ? elapsedMs + remainingMs : null) : elapsedMs;
  const title = job.smartColumn?.name ?? "Deleted Smart Column";

  async function cancel() {
    try {
      await apiPatch(`/api/jobs/${jobId}`, { status: "CANCELLED" });
      toast.info("Cancelling… rows already generated are kept.");
      refetch();
    } catch {
      toast.error("Couldn't cancel — it may have already finished.");
    }
  }

  async function retryFailed() {
    if (!job?.smartColumnId) return;
    try {
      const { job: next } = await retry.mutateAsync(job.smartColumnId);
      router.push(`/w/${workspaceId}/jobs/${next.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't retry.");
    }
  }

  function openInData() {
    if (!job?.datasetId) return;
    setDatasetId(job.datasetId);
    router.push(`/w/${workspaceId}/data`);
  }

  return (
    <Shell workspaceId={workspaceId}>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            {JOB_TYPE_LABEL[job.jobType] ?? job.jobType}
            {active && <span className="text-signal">· live</span>}
          </span>
        }
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <JobStatusBadge status={job.status} />
            {job.dataset && <span>on {job.dataset.filename}</span>}
            {job.smartColumnVersion && (
              <span className="font-mono text-xs">
                v{job.smartColumnVersion.versionNumber} · {job.smartColumnVersion.modelIdentifier}
              </span>
            )}
            <span className="text-xs">started {format(new Date(job.createdAt), "PPp")}</span>
          </span>
        }
        actions={
          <>
            {job.datasetId && (
              <Button variant="outline" size="sm" onClick={openInData}>
                <Table2 className="h-3.5 w-3.5" /> Open in Data
              </Button>
            )}
            {active ? (
              <Button variant="outline" size="sm" onClick={cancel} className="hover:bg-danger-muted hover:text-danger">
                <XCircle className="h-3.5 w-3.5" /> Cancel run
              </Button>
            ) : (
              job.failedItems > 0 &&
              job.smartColumnId && (
                <Button size="sm" onClick={retryFailed} loading={retry.isPending}>
                  <RotateCcw className="h-3.5 w-3.5" /> Retry {job.failedItems.toLocaleString()} failed
                </Button>
              )
            )}
          </>
        }
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-flat-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-3xl font-semibold tabular-nums">{pct}%</span>
          <span className="font-mono text-xs text-muted-foreground">
            {processed.toLocaleString()} / {job.totalItems.toLocaleString()} rows
          </span>
        </div>
        <ProgressBar value={processed} max={job.totalItems} tone={job.status === "FAILED" ? "danger" : job.status === "COMPLETED" ? "success" : "primary"} />
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Generated" value={job.completedItems.toLocaleString()} />
          <Stat label="Failed" value={job.failedItems.toLocaleString()} tone={job.failedItems > 0 ? "danger" : undefined} />
          <Stat label="Elapsed" value={queued ? "queued" : formatDuration(elapsedMs)} hint={queued ? undefined : `since ${format(startedAt, "HH:mm:ss")}`} />
          <Stat label="Speed" value={rate > 0 ? `${rate.toFixed(1)} rows/s` : "—"} />
          {active ? (
            <Stat
              label="Est. total"
              value={totalMs !== null ? `~${formatDuration(totalMs)}` : "estimating…"}
              hint={remainingMs !== null ? `~${formatDuration(remainingMs)} left · done ~${format(now + remainingMs, "HH:mm")}` : undefined}
            />
          ) : (
            <Stat
              label="Total time"
              value={formatDuration(elapsedMs)}
              hint={job.finishedAt ? `finished ${format(new Date(job.finishedAt), "HH:mm:ss")}` : undefined}
            />
          )}
        </dl>
      </section>

      <LogConsole
        logs={visible}
        totalLogs={logs.length}
        active={active}
        updatedAt={dataUpdatedAt}
        levelFilter={levelFilter}
        onLevelFilter={setLevelFilter}
        filename={`${title.replace(/[^\w.-]+/g, "_")}_${job.id}.log`}
      />
    </Shell>
  );
}

function Shell({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 md:px-8">
        <Link href={`/w/${workspaceId}/data`} className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Data
        </Link>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 font-mono text-sm tabular-nums", tone === "danger" && "text-danger")}>{value}</dd>
      {hint && <dd className="mt-0.5 text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}

/** Chronological (oldest → newest), terminal-style log that sticks to the
 * bottom while you're at the bottom, and stops following if you scroll up
 * to read — the usual `tail -f` behaviour. */
function LogConsole({
  logs,
  totalLogs,
  active,
  updatedAt,
  levelFilter,
  onLevelFilter,
  filename,
}: {
  logs: JobLogEntry[];
  totalLogs: number;
  active: boolean;
  updatedAt: number;
  levelFilter: "all" | JobLogLevel;
  onLevelFilter: (f: "all" | JobLogLevel) => void;
  filename: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [follow, setFollow] = React.useState(true);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && follow) el.scrollTop = el.scrollHeight;
  }, [logs, follow]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom !== follow) setFollow(atBottom);
  }

  const text = logs.map((l) => `${l.ts}  ${l.level.toUpperCase().padEnd(7)}  ${l.message}`).join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Log copied.");
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-flat-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {active && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
            </span>
          )}
          Run log
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {active ? `updated ${format(updatedAt, "HH:mm:ss")}` : `${totalLogs.toLocaleString()} entries`}
          {totalLogs >= LOG_CAP && ` · latest ${LOG_CAP} kept`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onLevelFilter(f.id)}
              aria-pressed={levelFilter === f.id}
              className={cn(
                "h-7 rounded-full px-2.5 text-xs transition-colors",
                levelFilter === f.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy log" title="Copy log" disabled={logs.length === 0}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={download} aria-label="Download log" title="Download log" disabled={logs.length === 0}>
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-[28rem] overflow-y-auto bg-muted/20 px-4 py-3 font-mono text-xs leading-relaxed"
          role="log"
          aria-live={active ? "polite" : "off"}
        >
          {logs.length === 0 ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              {active ? (
                <>
                  <InlineSpinner /> Waiting for the first log line…
                </>
              ) : (
                "No log entries."
              )}
            </p>
          ) : (
            logs.map((entry, i) => (
              <div key={`${entry.ts}-${i}`} className="flex gap-3 whitespace-pre-wrap">
                <time dateTime={entry.ts} className="shrink-0 text-muted-foreground" title={format(new Date(entry.ts), "PPpp")}>
                  {format(new Date(entry.ts), "HH:mm:ss.SSS")}
                </time>
                <span className={cn("min-w-0 break-words", LOG_LEVEL_CLASS[entry.level])}>{entry.message}</span>
              </div>
            ))
          )}
        </div>
        {!follow && logs.length > 0 && (
          <button
            type="button"
            onClick={() => setFollow(true)}
            className="absolute bottom-3 right-4 flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs shadow-hover"
          >
            {active ? <Pause className="h-3 w-3" /> : null}
            {active ? "Paused — jump to latest" : "Jump to end"}
          </button>
        )}
      </div>
    </section>
  );
}

/** A clock that ticks every second while `running`, for the elapsed/ETA readouts. */
function useNow(running: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return now;
}

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
