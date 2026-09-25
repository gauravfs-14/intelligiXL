"use client";

import * as React from "react";
import { use } from "react";
import { BarChart3, GitCompare } from "lucide-react";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { useWorkbench } from "@/hooks/use-datasets";
import { useTelemetry } from "@/hooks/use-telemetry";
import { PageHeader } from "@/components/workspace/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { SmartColumnInsightCard } from "@/components/insights/smart-column-insight-card";
import { SmartColumnInsightExpanded } from "@/components/insights/smart-column-insight-expanded";
import { CrosstabTable } from "@/components/insights/crosstab-table";
import { computeCrosstab } from "@/lib/insights/compute";
import type { PredictionDto } from "@/types/workbench";

// Every Smart Column's insights render as a card in one grid, so there's
// no need to pick a single column from a dropdown to see anything — the
// whole workbench's distributions are visible at once.
export default function InsightsPage({ params }: PageProps<"/w/[workspaceId]/insights">) {
  const { workspaceId } = use(params);
  const { datasetId } = useDatasetContext();
  const { data: workbench, isLoading, isError, refetch } = useWorkbench(datasetId ?? undefined);
  const track = useTelemetry(workspaceId);

  const smartColumns = workbench?.smartColumns.filter((sc) => sc.activeVersion) ?? [];
  const [minConfidence, setMinConfidence] = React.useState(0);
  const [compareA, setCompareA] = React.useState<string | null>(null);
  const [compareB, setCompareB] = React.useState<string | null>(null);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!compareA && smartColumns.length > 0) setCompareA(smartColumns[0].id);
    if (!compareB && smartColumns.length > 1) setCompareB(smartColumns[1].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartColumns.length]);

  React.useEffect(() => {
    if (smartColumns.length > 0) track("insight_viewed", { smartColumnId: smartColumns[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  const versionToPredictions = React.useMemo(() => {
    const map = new Map<string, PredictionDto[]>();
    if (!workbench) return map;
    for (const p of workbench.predictions) {
      if (!map.has(p.smartColumnVersionId)) map.set(p.smartColumnVersionId, []);
      map.get(p.smartColumnVersionId)!.push(p);
    }
    return map;
  }, [workbench]);

  function predictionsFor(smartColumnId: string) {
    const sc = smartColumns.find((s) => s.id === smartColumnId);
    const all = sc?.activeVersion ? (versionToPredictions.get(sc.activeVersion.id) ?? []) : [];
    return all.filter((p) => p.status === "SUCCESS" && (p.confidence ?? 1) >= minConfidence / 100);
  }

  const scA = smartColumns.find((sc) => sc.id === compareA);
  const scB = smartColumns.find((sc) => sc.id === compareB);
  const crosstab = React.useMemo(() => {
    if (!scA?.activeVersion || !scB?.activeVersion) return null;
    const predsA = new Map((versionToPredictions.get(scA.activeVersion.id) ?? []).map((p) => [p.datasetRowId, p]));
    const predsB = new Map((versionToPredictions.get(scB.activeVersion.id) ?? []).map((p) => [p.datasetRowId, p]));
    return computeCrosstab(predsA, predsB);
  }, [scA, scB, versionToPredictions]);

  const header = (
    <PageHeader
      eyebrow="Insights"
      title="Insights"
      description={workbench ? `${smartColumns.length} Smart Column${smartColumns.length === 1 ? "" : "s"} across this dataset.` : "See how your Smart Columns are performing."}
      actions={
        workbench && smartColumns.length > 0 ? (
          <div className="flex w-56 flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confidence ≥ {minConfidence}%</span>
            <Slider min={0} max={100} step={5} value={[minConfidence]} onValueChange={([v]) => setMinConfidence(v)} />
          </div>
        ) : undefined
      }
    />
  );

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-8 overflow-y-auto px-6 py-10 md:px-8">
      {header}

      {isLoading && <TableSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && (!datasetId || !workbench) && (
        <EmptyState icon={BarChart3} title="No dataset selected" description="Pick or upload a dataset from the Data tab first." />
      )}
      {!isLoading && !isError && workbench && smartColumns.length === 0 && (
        <EmptyState icon={BarChart3} title="Nothing to show yet" description="Create and generate a Smart Column to see insights here." />
      )}

      {!isLoading && !isError && workbench && smartColumns.length > 0 && (
        <>
          {smartColumns.length === 1 ? (
            <SmartColumnInsightExpanded smartColumn={smartColumns[0]} predictions={predictionsFor(smartColumns[0].id)} />
          ) : focusedId ? (
            (() => {
              const focused = smartColumns.find((sc) => sc.id === focusedId);
              return focused ? (
                <SmartColumnInsightExpanded smartColumn={focused} predictions={predictionsFor(focused.id)} onBack={() => setFocusedId(null)} />
              ) : null;
            })()
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {smartColumns.map((sc) => (
                <SmartColumnInsightCard key={sc.id} smartColumn={sc} predictions={predictionsFor(sc.id)} onExpand={() => setFocusedId(sc.id)} />
              ))}
            </div>
          )}

          {smartColumns.length > 1 && (
            <Panel>
              <PanelHeader>
                <PanelTitle>Compare columns</PanelTitle>
              </PanelHeader>
              <PanelBody className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Column A</span>
                    <Select value={compareA ?? ""} onValueChange={setCompareA}>
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {smartColumns.map((sc) => (
                          <SelectItem key={sc.id} value={sc.id}>
                            {sc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <GitCompare className="mb-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Column B</span>
                    <Select value={compareB ?? ""} onValueChange={setCompareB}>
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {smartColumns.map((sc) => (
                          <SelectItem key={sc.id} value={sc.id}>
                            {sc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!crosstab || crosstab.total === 0 ? (
                  <EmptyState title="No overlapping predictions" description="Both columns need generated predictions on the same rows to compare." />
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">{crosstab.total.toLocaleString()} rows compared.</p>
                    <CrosstabTable result={crosstab} labelA={scA?.name ?? "A"} labelB={scB?.name ?? "B"} />
                  </>
                )}
              </PanelBody>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
