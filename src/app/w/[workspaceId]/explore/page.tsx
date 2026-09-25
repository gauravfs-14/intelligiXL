"use client";

import * as React from "react";
import { Microscope, Search, Sparkles } from "lucide-react";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { useWorkbench } from "@/hooks/use-datasets";
import { PageHeader } from "@/components/workspace/page-header";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { ColumnProfileCard } from "@/components/eda/column-profile-card";
import { CorrelationHeatmap } from "@/components/eda/charts";
import { ALL_KINDS, KIND_META } from "@/components/eda/kind-meta";
import { correlationMatrix, defaultKind, profileColumn, type ColumnProfile, type EdaKind } from "@/lib/eda/compute";
import { cn } from "@/lib/utils";
import type { WorkbenchResponse } from "@/types/workbench";

interface EdaColumn {
  id: string;
  name: string;
  source: "dataset" | "smart";
  sourceLabel: string;
  values: unknown[];
  detected: EdaKind;
}

const DEFAULT_SELECTION = 3;

// Profiles keyed by column object + kind, so switching "Analyze as" back and
// forth or re-ticking a column is instant. Columns are rebuilt on every
// workbench refetch, so an edited cell never shows a stale profile.
const profileCache = new WeakMap<EdaColumn, Map<EdaKind, ColumnProfile>>();
function profileFor(c: EdaColumn, kind: EdaKind): ColumnProfile {
  let byKind = profileCache.get(c);
  if (!byKind) {
    byKind = new Map();
    profileCache.set(c, byKind);
  }
  let p = byKind.get(kind);
  if (!p) {
    p = profileColumn(c.values, kind);
    byKind.set(kind, p);
  }
  return p;
}

function buildColumns(wb: WorkbenchResponse): EdaColumn[] {
  const cols: EdaColumn[] = wb.dataset.columns.map((c) => {
    const values = wb.rows.map((r) => r.data[c.name]);
    return { id: `col:${c.id}`, name: c.name, source: "dataset", sourceLabel: c.dataType.toLowerCase(), values, detected: defaultKind(c.dataType, values) };
  });

  // Smart Columns are profiled on their predicted output: the label for
  // Binary/Categorical, the probability-weighted score for Ratings.
  const rowIndex = new Map(wb.rows.map((r, i) => [r.id, i]));
  for (const sc of wb.smartColumns) {
    if (!sc.activeVersion) continue;
    const isRating = sc.type === "RATING";
    const values: unknown[] = new Array(wb.rows.length).fill(null);
    for (const p of wb.predictions) {
      if (p.smartColumnVersionId !== sc.activeVersion.id || p.status !== "SUCCESS") continue;
      const i = rowIndex.get(p.datasetRowId);
      if (i !== undefined) values[i] = isRating ? p.score : p.predictedLabel;
    }
    cols.push({ id: `sc:${sc.id}`, name: sc.name, source: "smart", sourceLabel: "smart column", values, detected: isRating ? "NUMBER" : "CATEGORY" });
  }
  return cols;
}

export default function ExplorePage() {
  const { datasetId } = useDatasetContext();
  const { data: workbench, isLoading, isError, refetch } = useWorkbench(datasetId ?? undefined);

  const columns = React.useMemo(() => (workbench ? buildColumns(workbench) : []), [workbench]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [overrides, setOverrides] = React.useState<Record<string, EdaKind>>({});
  const [query, setQuery] = React.useState("");

  // Seed a small default selection whenever the dataset changes, so the page
  // shows something useful immediately instead of an empty canvas.
  const seededFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!workbench || seededFor.current === workbench.dataset.id) return;
    seededFor.current = workbench.dataset.id;
    setSelected(columns.filter((c) => c.source === "dataset").slice(0, DEFAULT_SELECTION).map((c) => c.id));
    setOverrides({});
  }, [workbench, columns]);

  const kindOf = React.useCallback((c: EdaColumn) => overrides[c.id] ?? c.detected, [overrides]);

  const selectedColumns = React.useMemo(
    () => selected.map((id) => columns.find((c) => c.id === id)).filter((c): c is EdaColumn => Boolean(c)),
    [selected, columns],
  );

  const numericSelected = React.useMemo(() => selectedColumns.filter((c) => kindOf(c) === "NUMBER"), [selectedColumns, kindOf]);
  const correlation = React.useMemo(
    () => (numericSelected.length >= 2 ? correlationMatrix(numericSelected.map((c) => ({ name: c.name, values: c.values }))) : null),
    [numericSelected],
  );

  const filtered = columns.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const groups = ALL_KINDS.map((k) => ({ kind: k, items: filtered.filter((c) => c.source === "dataset" && c.detected === k) })).filter((g) => g.items.length);
  const smartItems = filtered.filter((c) => c.source === "smart");

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function setGroup(ids: string[], on: boolean) {
    setSelected((s) => (on ? [...s, ...ids.filter((id) => !s.includes(id))] : s.filter((id) => !ids.includes(id))));
  }

  const header = (
    <PageHeader
      eyebrow="Exploratory analysis"
      title="Explore"
      description={
        workbench
          ? `Profile any column in ${workbench.dataset.filename}: ${workbench.rows.length.toLocaleString()} rows, ${columns.length} columns. Metrics and charts adapt to each column's type.`
          : "Pick columns and get type-aware statistics and charts for each one."
      }
    />
  );

  const renderItem = (c: EdaColumn) => {
    const Icon = c.source === "smart" ? Sparkles : KIND_META[c.detected].icon;
    const checked = selected.includes(c.id);
    return (
      <label
        key={c.id}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
          checked && "bg-muted/60",
        )}
      >
        <Checkbox checked={checked} onCheckedChange={() => toggle(c.id)} />
        <Icon className={cn("h-3.5 w-3.5 shrink-0", c.source === "smart" ? "text-primary" : "text-muted-foreground")} />
        <span className="min-w-0 flex-1 truncate" title={c.name}>
          {c.name}
        </span>
      </label>
    );
  };

  const groupHeader = (label: string, ids: string[]) => {
    const on = ids.filter((id) => selected.includes(id)).length;
    return (
      <div className="flex items-center justify-between px-2 pb-1 pt-3 first:pt-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label} <span className="font-mono">{ids.length}</span>
        </span>
        <button type="button" onClick={() => setGroup(ids, on < ids.length)} className="text-[11px] text-muted-foreground hover:text-foreground">
          {on < ids.length ? "All" : "None"}
        </button>
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-8 overflow-y-auto px-6 py-10 md:px-8">
      {header}

      {isLoading && <TableSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && (!datasetId || !workbench) && (
        <EmptyState icon={Microscope} title="No dataset selected" description="Pick or upload a dataset from the Data tab first." />
      )}

      {!isLoading && !isError && workbench && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <Panel className="lg:sticky lg:top-0">
            <PanelHeader>
              <PanelTitle>Columns</PanelTitle>
              <span className="font-mono text-xs text-muted-foreground">
                {selected.length}/{columns.length}
              </span>
            </PanelHeader>
            <PanelBody className="flex flex-col gap-3 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search columns" className="h-8 pl-8 text-xs" />
              </div>
              <div className="flex gap-3 px-2 text-[11px]">
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setSelected(columns.map((c) => c.id))}>
                  Select all
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setSelected([])}>
                  Clear
                </button>
              </div>
              <div className="flex max-h-[60vh] flex-col overflow-y-auto">
                {groups.map((g) => (
                  <div key={g.kind}>
                    {groupHeader(KIND_META[g.kind].label, g.items.map((c) => c.id))}
                    {g.items.map(renderItem)}
                  </div>
                ))}
                {smartItems.length > 0 && (
                  <div>
                    {groupHeader("Smart Columns", smartItems.map((c) => c.id))}
                    {smartItems.map(renderItem)}
                  </div>
                )}
                {filtered.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">No columns match.</p>}
              </div>
            </PanelBody>
          </Panel>

          <div className="flex min-w-0 flex-col gap-6">
            {selectedColumns.length === 0 && (
              <EmptyState icon={Microscope} title="No columns selected" description="Tick one or more columns on the left to profile them." />
            )}

            {correlation && (
              <Panel>
                <PanelHeader>
                  <PanelTitle>Correlation between numeric columns</PanelTitle>
                  <span className="text-xs text-muted-foreground">Pearson r, pairwise complete rows</span>
                </PanelHeader>
                <PanelBody>
                  <CorrelationHeatmap names={correlation.names} matrix={correlation.matrix} />
                </PanelBody>
              </Panel>
            )}

            {selectedColumns.map((c) => (
              <ColumnProfileCard
                key={c.id}
                name={c.name}
                sourceLabel={c.sourceLabel}
                kind={kindOf(c)}
                availableKinds={ALL_KINDS}
                onKindChange={(k) => setOverrides((o) => ({ ...o, [c.id]: k }))}
                onRemove={() => toggle(c.id)}
                profile={profileFor(c, kindOf(c))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
