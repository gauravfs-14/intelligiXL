"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, Gauge, Sparkles, Star, Tags, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { StatTile } from "@/components/workspace/stat-tile";
import { InsightBarChart } from "./bar-chart";
import { TYPE_LABEL } from "./smart-column-insight-card";
import { computeConfidenceHistogram, computeLabelDistribution, computeRatingStats } from "@/lib/insights/compute";
import { formatPercent } from "@/lib/utils";
import type { PredictionDto, WorkbenchSmartColumnDto } from "@/types/workbench";

// The full-detail single-column view: used automatically when a dataset has
// exactly one Smart Column (nothing to compare, so show everything at once),
// and on demand when a card in the multi-column grid is expanded.
export function SmartColumnInsightExpanded({
  smartColumn,
  predictions,
  onBack,
}: {
  smartColumn: WorkbenchSmartColumnDto;
  predictions: PredictionDto[];
  onBack?: () => void;
}) {
  const distribution = React.useMemo(() => computeLabelDistribution(predictions), [predictions]);
  const ratingStats = React.useMemo(() => computeRatingStats(predictions), [predictions]);
  const confidenceHistogram = React.useMemo(() => computeConfidenceHistogram(predictions), [predictions]);
  const isRating = smartColumn.type === "RATING";
  const avgConfidence = predictions.length > 0 ? predictions.reduce((s, p) => s + (p.confidence ?? 0), 0) / predictions.length : null;
  const lowConfidenceCount = predictions.filter((p) => (p.confidence ?? 1) < 0.6).length;
  const distinctLabels = new Set(predictions.map((p) => p.predictedLabel).filter(Boolean)).size;

  return (
    <div className="flex flex-col gap-4">
      {onBack && (
        <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to all columns
        </Button>
      )}

      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <h2 className="truncate text-lg font-semibold tracking-tight">{smartColumn.name}</h2>
        <Badge tone="muted">{TYPE_LABEL[smartColumn.type] ?? smartColumn.type}</Badge>
      </div>

      {predictions.length === 0 ? (
        <EmptyState title="No predictions yet" description="Generate this Smart Column to see its distribution here." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Target} label="Predicted" value={predictions.length.toLocaleString()} />
            <StatTile icon={Gauge} label="Avg confidence" value={avgConfidence !== null ? formatPercent(avgConfidence) : "—"} />
            {isRating && ratingStats.mean !== null ? (
              <StatTile icon={Star} label="Expected score" value={ratingStats.mean.toFixed(2)} />
            ) : (
              <StatTile icon={Tags} label="Distinct labels" value={distinctLabels.toLocaleString()} />
            )}
            <StatTile
              icon={AlertTriangle}
              label="Below 60% confidence"
              value={lowConfidenceCount.toLocaleString()}
              tone={lowConfidenceCount > 0 ? "warning" : undefined}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>{isRating ? "Score distribution" : "Label distribution"}</PanelTitle>
              </PanelHeader>
              <PanelBody>
                {isRating ? (
                  <InsightBarChart data={ratingStats.histogram} xKey="label" yKey="count" height={260} />
                ) : (
                  <InsightBarChart data={distribution} xKey="label" yKey="count" height={260} />
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>Confidence histogram</PanelTitle>
              </PanelHeader>
              <PanelBody>
                <InsightBarChart data={confidenceHistogram} xKey="bucket" yKey="count" height={260} color="var(--color-muted-foreground)" />
              </PanelBody>
            </Panel>
          </div>

          {!isRating && (
            <Panel>
              <PanelHeader>
                <PanelTitle>By label</PanelTitle>
              </PanelHeader>
              <PanelBody className="flex flex-col gap-2">
                {distribution.map((d) => (
                  <div key={d.label} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 truncate">{d.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${d.percent * 100}%` }} />
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
    </div>
  );
}
