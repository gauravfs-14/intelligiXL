"use client";

import * as React from "react";
import { format } from "date-fns";
import { AlertTriangle, Clock, Flag, HelpCircle } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfidencePill, ProbabilityBreakdown } from "@/components/ui/confidence";
import { Badge } from "@/components/ui/badge";
import { ReviewValuePicker } from "@/components/review/review-value-picker";
import { PREDICTION_ERROR_LABEL as ERROR_LABEL } from "@/lib/prediction-error-labels";
import { cn } from "@/lib/utils";
import { isLowConfidence, resolveSettings } from "@/lib/decision-models/catalog";
import type { PredictionDto, SmartColumnVersionDto } from "@/types/workbench";

/** A single Smart Column cell (FR-020) — single click reveals the full
 * probability distribution and model provenance (FR-021); double-click
 * opens the same constrained-label editor Review uses, so correcting a
 * prediction works the same everywhere. */
export function PredictionCell({
  prediction,
  showConfidence,
  wrap,
  version,
  onCorrect,
}: {
  prediction: PredictionDto | undefined;
  showConfidence: boolean;
  wrap?: boolean;
  version?: SmartColumnVersionDto;
  onCorrect?: (value: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);

  function beginEdit() {
    if (version && onCorrect) setEditing(true);
  }

  const editorPopover = version && onCorrect && (
    <Popover open={editing} onOpenChange={setEditing}>
      <PopoverAnchor asChild>
        <span className="pointer-events-none absolute inset-0" />
      </PopoverAnchor>
      <PopoverContent className="w-72" align="start">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correct value</p>
          <ReviewValuePicker
            version={version}
            value={prediction?.review?.reviewedValue ?? prediction?.predictedLabel ?? null}
            onChange={(v) => {
              onCorrect(v);
              setEditing(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );

  if (!prediction || prediction.status === "PENDING") {
    return (
      <div className="relative w-full" onDoubleClick={beginEdit}>
        <span className="text-xs text-muted-foreground">—</span>
        {editorPopover}
      </div>
    );
  }

  if (prediction.status === "NOT_PROCESSED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <HelpCircle className="h-3 w-3" /> {ERROR_LABEL[prediction.errorReason ?? "UNKNOWN"]}
      </span>
    );
  }

  if (prediction.status === "FAILED") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1 text-xs text-danger hover:underline">
            <AlertTriangle className="h-3 w-3" /> {ERROR_LABEL[prediction.errorReason ?? "UNKNOWN"]}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <p className="text-xs text-muted-foreground">This row failed to generate. Use “Retry failed rows” from the column menu.</p>
        </PopoverContent>
      </Popover>
    );
  }

  if (!prediction.predictedLabel || prediction.confidence === null) return <span className="text-xs text-muted-foreground">—</span>;

  const settings = resolveSettings(version?.settings);
  const flagged = isLowConfidence(prediction.confidence, settings) && (!prediction.review || prediction.review.status === "NOT_REVIEWED");

  return (
    <div className="relative w-full" onDoubleClick={beginEdit} title={version && onCorrect ? "Double-click to correct" : undefined}>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex w-full items-center gap-1.5 text-left hover:opacity-80">
            <span className="min-w-0 flex-1">
              {showConfidence ? (
                <ConfidencePill label={prediction.predictedLabel} confidence={prediction.confidence} threshold={settings.confidenceThreshold} />
              ) : (
                <span className={cn("block text-sm", wrap ? "whitespace-normal break-words py-1.5" : "truncate")}>{prediction.predictedLabel}</span>
              )}
            </span>
            {flagged && <Flag className="h-3 w-3 shrink-0 text-warning" aria-label="Below review threshold" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Probability distribution</p>
              {prediction.review && prediction.review.status !== "NOT_REVIEWED" && (
                <Badge tone={prediction.review.status === "CORRECTED" ? "warning" : "success"}>{prediction.review.status}</Badge>
              )}
            </div>
            {prediction.probabilities && (
              <ProbabilityBreakdown probabilities={prediction.probabilities} predicted={prediction.predictedLabel} />
            )}
            {prediction.score !== null && (
              <p className="text-xs text-muted-foreground">
                Expected score: <span className="font-mono text-foreground">{prediction.score.toFixed(2)}</span>
              </p>
            )}
            <div className="flex flex-col gap-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
              <span>Model: {prediction.modelVersion ?? "—"}</span>
              {flagged && (
                <span className="flex items-center gap-1 text-warning">
                  <Flag className="h-3 w-3" /> Below the {Math.round(settings.confidenceThreshold * 100)}% review threshold
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {format(new Date(prediction.createdAt), "MMM d, yyyy HH:mm")}
              </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {editorPopover}
    </div>
  );
}
