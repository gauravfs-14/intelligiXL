"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { format, isToday, isYesterday } from "date-fns";
import { Activity, Search, Settings2, X } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useActivityLog, useActivitySettings } from "@/hooks/use-workspaces";
import { useDatasets } from "@/hooks/use-datasets";
import { ACTIVITY_CATEGORIES, isActivityCategory, type ActivityCategory } from "@/lib/activity/categories";
import { ACTIVITY_ICON, activityLabel } from "@/components/activity/category-meta";
import type { ActivityLogDto } from "@/types/api";
import { cn } from "@/lib/utils";

const ALL_DATASETS = "__all__";

export default function ActivityPage({ params }: PageProps<"/w/[workspaceId]/activity">) {
  const { workspaceId } = use(params);
  const [categories, setCategories] = React.useState<ActivityCategory[]>([]);
  const [datasetId, setDatasetId] = React.useState<string>(ALL_DATASETS);
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search.trim(), 300);

  const log = useActivityLog(workspaceId, {
    categories,
    datasetId: datasetId === ALL_DATASETS ? undefined : datasetId,
    q: q || undefined,
  });
  const { data: settingsData } = useActivitySettings(workspaceId);
  const { data: datasetsData } = useDatasets(workspaceId);

  const entries = React.useMemo(() => log.data?.pages.flatMap((p) => p.entries) ?? [], [log.data]);
  const groups = React.useMemo(() => groupByDay(entries), [entries]);
  const disabled = settingsData ? ACTIVITY_CATEGORIES.filter((c) => !settingsData.settings[c.id]) : [];
  const filtered = categories.length > 0 || datasetId !== ALL_DATASETS || q.length > 0;

  function toggleCategory(id: ActivityCategory) {
    setCategories((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10 md:px-8">
        <PageHeader
          eyebrow="Audit trail"
          title="Activity"
          description="Everything done in this workspace: imports, edits, reviews, runs and more. Navigation isn't recorded."
          actions={
            <Link href={`/w/${workspaceId}/settings#activity-logging`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Settings2 className="h-3.5 w-3.5" /> Logging settings
            </Link>
          }
        />

        {disabled.length > 0 && (
          <p className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
            Not being recorded: {disabled.map((c) => c.label).join(", ")}.{" "}
            <Link href={`/w/${workspaceId}/settings#activity-logging`} className="text-primary underline-offset-4 hover:underline">
              Change
            </Link>
          </p>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity…" className="h-9 pl-8" />
            </div>
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger className="w-56 max-w-full" aria-label="Filter by dataset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DATASETS}>All datasets</SelectItem>
                {datasetsData?.datasets.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.filename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            {ACTIVITY_CATEGORIES.map((c) => {
              const Icon = ACTIVITY_ICON[c.id];
              const active = categories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                    active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" /> {c.label}
                </button>
              );
            })}
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setCategories([]);
                  setDatasetId(ALL_DATASETS);
                  setSearch("");
                }}
                className="flex h-7 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        </div>

        {log.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : log.isError ? (
          <ErrorState onRetry={() => log.refetch()} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={filtered ? "Nothing matches these filters" : "No activity yet"}
            description={filtered ? "Try a different category, dataset or search." : "Actions in this workspace (imports, edits, reviews, runs) will show up here."}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((g) => (
              <section key={g.key} className="flex flex-col gap-2">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{g.label}</h2>
                <ol className="divide-y divide-border rounded-2xl border border-border bg-card shadow-flat-sm">
                  {g.entries.map((e) => (
                    <ActivityRow key={e.id} entry={e} onDatasetClick={setDatasetId} />
                  ))}
                </ol>
              </section>
            ))}
            {log.hasNextPage && (
              <Button variant="outline" size="sm" className="self-center" onClick={() => log.fetchNextPage()} loading={log.isFetchingNextPage}>
                Load older activity
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ entry, onDatasetClick }: { entry: ActivityLogDto; onDatasetClick: (id: string) => void }) {
  const Icon = isActivityCategory(entry.category) ? ACTIVITY_ICON[entry.category] : Activity;
  const at = new Date(entry.createdAt);
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        title={activityLabel(entry.category)}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm">{entry.summary}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span>{activityLabel(entry.category)}</span>
          {entry.datasetName && (
            <>
              <span aria-hidden>·</span>
              {entry.datasetId ? (
                <button type="button" onClick={() => onDatasetClick(entry.datasetId!)} className="max-w-[16rem] truncate hover:text-foreground hover:underline">
                  {entry.datasetName}
                </button>
              ) : (
                <span className="max-w-[16rem] truncate">{entry.datasetName}</span>
              )}
            </>
          )}
        </div>
      </div>
      <time dateTime={entry.createdAt} title={format(at, "PPpp")} className="shrink-0 font-mono text-[11px] text-muted-foreground">
        {format(at, "HH:mm")}
      </time>
    </li>
  );
}

function groupByDay(entries: ActivityLogDto[]) {
  const groups: { key: string; label: string; entries: ActivityLogDto[] }[] = [];
  for (const e of entries) {
    const d = new Date(e.createdAt);
    const key = format(d, "yyyy-MM-dd");
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEEE, MMM d, yyyy"), entries: [] };
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
