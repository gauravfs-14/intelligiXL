"use client";

import * as React from "react";
import { format } from "date-fns";
import { AlertTriangle, Clock, HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfidencePill, ProbabilityBreakdown } from "@/components/ui/confidence";
import { Badge } from "@/components/ui/badge";
import type { PredictionDto } from "@/types/workbench";

const ERROR_LABEL: Record<string, string> = {
  EMPTY_SOURCE: "No source text",
  TIMEOUT: "Timed out",
  RATE_LIMITED: "Rate limited",
  PROVIDER_UNAVAILABLE: "Provider unavailable",
  INVALID_RESPONSE: "Invalid response",
  AUTH_FAILURE: "API key invalid",
  UNKNOWN: "Failed",
};

/** A single Smart Column cell (FR-020) — click to reveal the full
 * probability distribution and model provenance (FR-021). */
export function PredictionCell({ prediction, showConfidence }: { prediction: PredictionDto | undefined; showConfidence: boolean }) {
  if (!prediction || prediction.status === "PENDING") {
    return <span className="text-xs text-muted-foreground">—</span>;
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full text-left hover:opacity-80">
          {showConfidence ? (
            <ConfidencePill label={prediction.predictedLabel} confidence={prediction.confidence} />
          ) : (
            <span className="truncate text-sm">{prediction.predictedLabel}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Probability distribution</p>
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
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {format(new Date(prediction.createdAt), "MMM d, yyyy HH:mm")}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
