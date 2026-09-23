"use client";

import * as React from "react";
import { Shuffle, ListOrdered, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProbabilityBreakdown, ConfidencePill } from "@/components/ui/confidence";
import { InlineSpinner } from "@/components/ui/states";
import type { PreviewRowResult } from "@/lib/smart-columns/preview";

export function PreviewStep({
  results,
  loading,
  sampleMode,
  onSampleModeChange,
  onRun,
}: {
  results: PreviewRowResult[] | null;
  loading: boolean;
  sampleMode: "random" | "first";
  onSampleModeChange: (mode: "random" | "first") => void;
  onRun: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Select value={sampleMode} onValueChange={(v) => onSampleModeChange(v as "random" | "first")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="random">
              <Shuffle className="mr-1 inline h-3.5 w-3.5" /> Random sample
            </SelectItem>
            <SelectItem value="first">
              <ListOrdered className="mr-1 inline h-3.5 w-3.5" /> First 10 rows
            </SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={onRun} loading={loading}>
          <RefreshCw className="h-3.5 w-3.5" /> {results ? "Run again" : "Run preview"}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border py-10 text-sm text-muted-foreground">
          <InlineSpinner /> Evaluating sample against Jev…
        </div>
      )}

      {!loading && results && (
        <div className="flex flex-col gap-2">
          {results.map((r) => (
            <div key={r.rowId} className="rounded-md border border-border p-3 transition-colors hover:bg-muted/30">
              <p className="mb-2 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{r.sourceText}</p>
              {r.result.status === "success" ? (
                <div className="flex flex-col gap-2">
                  <ConfidencePill label={r.result.predictedLabel} confidence={r.result.confidence} />
                  <ProbabilityBreakdown probabilities={r.result.probabilities} predicted={r.result.predictedLabel} />
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> {r.result.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !results && (
        <div className="flex items-center justify-center rounded-md border border-dashed border-border py-10 text-sm text-muted-foreground">
          Run a preview before generating the full column.
        </div>
      )}
    </div>
  );
}
