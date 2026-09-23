"use client";

import * as React from "react";
import { use } from "react";
import { BarChart3, GitCompare } from "lucide-react";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { useWorkbench } from "@/hooks/use-datasets";
import { useTelemetry } from "@/hooks/use-telemetry";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InsightBarChart } from "@/components/insights/bar-chart";
import { CrosstabTable } from "@/components/insights/crosstab-table";
import { computeConfidenceHistogram, computeCrosstab, computeLabelDistribution, computeRatingStats } from "@/lib/insights/compute";
import { formatPercent } from "@/lib/utils";
import type { PredictionDto } from "@/types/workbench";

export default function InsightsPage({ params }: PageProps<"/w/[workspaceId]/insights">) {
  const { workspaceId } = use(params);
  const { datasetId } = useDatasetContext();
  const { data: workbench, isLoading, isError, refetch } = useWorkbench(datasetId ?? undefined);
  const track = useTelemetry(workspaceId);

  const smartColumns = workbench?.smartColumns.filter((sc) => sc.activeVersion) ?? [];
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [minConfidence, setMinConfidence] = React.useState(0);
  const [compareA, setCompareA] = React.useState<string | null>(null);
  const [compareB, setCompareB] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!focusId && smartColumns.length > 0) setFocusId(smartColumns[0].id);
    if (!compareA && smartColumns.length > 0) setCompareA(smartColumns[0].id);
    if (!compareB && smartColumns.length > 1) setCompareB(smartColumns[1].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartColumns.length]);

  React.useEffect(() => {
    if (focusId) track("insight_viewed", { smartColumnId: focusId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const versionToPredictions = React.useMemo(() => {
    const map = new Map<string, PredictionDto[]>();
    if (!workbench) return map;
    for (const p of workbench.predictions) {
      if (!map.has(p.smartColumnVersionId)) map.set(p.smartColumnVersionId, []);
      map.get(p.smartColumnVersionId)!.push(p);
    }
    return map;
  }, [workbench]);

  const focus = smartColumns.find((sc) => sc.id === focusId);
  const focusPredictions = React.useMemo(() => {
    const all = focus?.activeVersion ? (versionToPredictions.get(focus.activeVersion.id) ?? []) : [];
    // Insights are about what was predicted, not job health — failed/
    // not-processed rows have no label or confidence to plot.
    return all.filter((p) => p.status === "SUCCESS" && (p.confidence ?? 1) >= minConfidence / 100);
  }, [focus, versionToPredictions, minConfidence]);

  const distribution = React.useMemo(() => computeLabelDistribution(focusPredictions), [focusPredictions]);
  const ratingStats = React.useMemo(() => computeRatingStats(focusPredictions), [focusPredictions]);
  const confidenceHistogram = React.useMemo(() => computeConfidenceHistogram(focusPredictions), [focusPredictions]);
  const avgConfidence = focusPredictions.length > 0 ? focusPredictions.reduce((s, p) => s + (p.confidence ?? 0), 0) / focusPredictions.length : null;
  const lowConfidenceCount = focusPredictions.filter((p) => (p.confidence ?? 1) < 0.6).length;

  const scA = smartColumns.find((sc) => sc.id === compareA);
  const scB = smartColumns.find((sc) => sc.id === compareB);
  const crosstab = React.useMemo(() => {
    if (!scA?.activeVersion || !scB?.activeVersion) return null;
    const predsA = new Map((versionToPredictions.get(scA.activeVersion.id) ?? []).map((p) => [p.datasetRowId, p]));
    const predsB = new Map((versionToPredictions.get(scB.activeVersion.id) ?? []).map((p) => [p.datasetRowId, p]));
    return computeCrosstab(predsA, predsB);
  }, [scA, scB, versionToPredictions]);

  if (isLoading) return <div className="p-6"><TableSkeleton /></div>;
  if (isError) return <div className="p-6"><ErrorState onRetry={() => refetch()} /></div>;
  if (!datasetId || !workbench) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center p-6">
        <EmptyState icon={BarChart3} title="No dataset selected" description="Pick or upload a dataset from the Data tab first." />
      </div>
    );
  }
  if (smartColumns.length === 0) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center p-6">
        <EmptyState icon={BarChart3} title="Nothing to show yet" description="Create and generate a Smart Column to see insights here." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <Tabs defaultValue="distribution">
        <TabsList>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="compare">Compare Columns</TabsTrigger>
        </TabsList>

        <TabsContent value="distribution" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Smart Column</span>
              <Select value={focusId ?? ""} onValueChange={setFocusId}>
                <SelectTrigger className="w-56">
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
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Confidence ≥ {minConfidence}%</span>
              <Slider min={0} max={100} step={5} value={[minConfidence]} onValueChange={([v]) => setMinConfidence(v)} />
            </div>
          </div>

          {focusPredictions.length === 0 ? (
            <EmptyState title="No predictions match this filter" description="Lower the confidence threshold or generate this column." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Panel>
                  <PanelHeader>
                    <PanelTitle>{focus?.type === "RATING" ? "Score distribution" : "Label distribution"}</PanelTitle>
                  </PanelHeader>
                  <PanelBody>
                    {focus?.type === "RATING" ? (
                      <InsightBarChart data={ratingStats.histogram} xKey="label" yKey="count" />
                    ) : (
                      <InsightBarChart data={distribution} xKey="label" yKey="count" />
                    )}
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHeader>
                    <PanelTitle>Confidence histogram</PanelTitle>
                  </PanelHeader>
                  <PanelBody>
                    <InsightBarChart data={confidenceHistogram} xKey="bucket" yKey="count" color="var(--color-muted-foreground)" />
                  </PanelBody>
                </Panel>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Total predicted" value={focusPredictions.length.toLocaleString()} />
                <Stat label="Avg confidence" value={avgConfidence !== null ? formatPercent(avgConfidence) : "—"} />
                {ratingStats.mean !== null && <Stat label="Expected score" value={ratingStats.mean.toFixed(2)} />}
                <Stat label="Below 60% confidence" value={lowConfidenceCount.toLocaleString()} tone={lowConfidenceCount > 0 ? "warning" : undefined} />
              </div>

              {focus?.type !== "RATING" && (
                <Panel>
                  <PanelHeader>
                    <PanelTitle>By label</PanelTitle>
                  </PanelHeader>
                  <PanelBody className="flex flex-col gap-2">
                    {distribution.map((d) => (
                      <div key={d.label} className="flex items-center gap-3 text-sm">
                        <span className="w-32 shrink-0 truncate">{d.label}</span>
                        <div className="h-2 flex-1 border border-border bg-background">
                          <div className="h-full bg-accent" style={{ width: `${d.percent * 100}%` }} />
                        </div>
                        <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">{formatPercent(d.percent)}</span>
                        <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">avg {formatPercent(d.avgConfidence)}</span>
                      </div>
                    ))}
                  </PanelBody>
                </Panel>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="compare" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Column A</span>
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
            <GitCompare className="mb-2 h-4 w-4 text-muted" />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Column B</span>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="border border-border-strong bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-mono text-lg ${tone === "warning" ? "text-warning" : ""}`}>{value}</p>
    </div>
  );
}
