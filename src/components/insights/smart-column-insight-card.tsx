"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ChevronDown, Gauge, Maximize2, Sparkles, Star, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { InsightBarChart } from "./bar-chart";
import { computeConfidenceHistogram, computeLabelDistribution, computeRatingStats } from "@/lib/insights/compute";
import { formatPercent, cn } from "@/lib/utils";
import type { PredictionDto, WorkbenchSmartColumnDto } from "@/types/workbench";

export const TYPE_LABEL: Record<string, string> = {
  BINARY: "Binary",
  CATEGORICAL: "Categorical",
  RATING: "Rating",
};

// One self-contained "card" per Smart Column, so the whole workbench's
// insights are visible at a glance instead of hidden behind a one-at-a-
// time column picker. `onExpand`, when given, adds a focus button that
// drills into the full SmartColumnInsightExpanded view for just this column.
export function SmartColumnInsightCard({
  smartColumn,
  predictions,
  onExpand,
}: {
  smartColumn: WorkbenchSmartColumnDto;
  predictions: PredictionDto[];
  onExpand?: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const distribution = React.useMemo(() => computeLabelDistribution(predictions), [predictions]);
  const ratingStats = React.useMemo(() => computeRatingStats(predictions), [predictions]);
  const confidenceHistogram = React.useMemo(() => computeConfidenceHistogram(predictions), [predictions]);
  const isRating = smartColumn.type === "RATING";
  const avgConfidence = predictions.length > 0 ? predictions.reduce((s, p) => s + (p.confidence ?? 0), 0) / predictions.length : null;
  const lowConfidenceCount = predictions.filter((p) => (p.confidence ?? 1) < 0.6).length;

  return (
    <Panel className="flex flex-col">
      <PanelHeader className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <PanelTitle className="truncate">{smartColumn.name}</PanelTitle>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone="muted">{TYPE_LABEL[smartColumn.type] ?? smartColumn.type}</Badge>
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Expand ${smartColumn.name}`}
              title="Expand"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </PanelHeader>
      <PanelBody className="flex flex-1 flex-col gap-3">
        {predictions.length === 0 ? (
          <EmptyState title="No predictions yet" description="Generate this Smart Column to see its distribution here." />
        ) : (
          <>
            {isRating ? (
              <InsightBarChart data={ratingStats.histogram} xKey="label" yKey="count" height={140} />
            ) : (
              <InsightBarChart data={distribution.slice(0, 6)} xKey="label" yKey="count" height={140} />
            )}

            <div className="grid grid-cols-3 gap-2">
              <MiniStat icon={Target} label="Predicted" value={predictions.length.toLocaleString()} />
              <MiniStat icon={Gauge} label="Avg confidence" value={avgConfidence !== null ? formatPercent(avgConfidence) : "—"} />
              {isRating && ratingStats.mean !== null ? (
                <MiniStat icon={Star} label="Expected score" value={ratingStats.mean.toFixed(2)} />
              ) : (
                <MiniStat
                  icon={AlertTriangle}
                  label="Below 60%"
                  value={lowConfidenceCount.toLocaleString()}
                  tone={lowConfidenceCount > 0 ? "warning" : undefined}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
              {expanded ? "Hide breakdown" : "View breakdown"}
            </button>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    {!isRating &&
                      distribution.map((d) => (
                        <div key={d.label} className="flex items-center gap-2 text-xs">
                          <span className="w-24 shrink-0 truncate">{d.label}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${d.percent * 100}%` }} />
                          </div>
                          <span className="w-10 shrink-0 text-right font-mono text-muted-foreground">{formatPercent(d.percent)}</span>
                        </div>
                      ))}
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Confidence spread</p>
                    <InsightBarChart data={confidenceHistogram} xKey="bucket" yKey="count" height={100} color="var(--color-muted-foreground)" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
      <div className="flex items-center gap-1">
        <Icon className={cn("h-3 w-3 shrink-0", tone === "warning" ? "text-warning" : "text-muted-foreground")} />
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-0.5 font-mono text-sm tabular-nums", tone === "warning" && "text-warning")}>{value}</p>
    </div>
  );
}
