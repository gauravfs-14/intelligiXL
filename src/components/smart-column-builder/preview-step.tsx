"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Shuffle, ListOrdered, Play, RefreshCw, AlertTriangle, Flag, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProbabilityBreakdown, ConfidencePill } from "@/components/ui/confidence";
import { Badge } from "@/components/ui/badge";
import { isLowConfidence, type SmartColumnSettings } from "@/lib/decision-models/catalog";
import { cn } from "@/lib/utils";
import type { PreviewRowResult } from "@/lib/smart-columns/preview";

const THINKING = [
  "Reading your rows…",
  "Weighing the options…",
  "Calibrating probabilities…",
  "Double-checking the edge cases…",
  "Almost there…",
];

function useCycle(active: boolean, items: string[], ms = 1400) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setI((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return items[i % items.length];
}

export function PreviewStep({
  results,
  loading,
  sampleMode,
  onSampleModeChange,
  onRun,
  modelName,
  settings,
}: {
  results: PreviewRowResult[] | null;
  loading: boolean;
  sampleMode: "random" | "first";
  onSampleModeChange: (mode: "random" | "first") => void;
  onRun: () => void;
  modelName: string;
  settings: SmartColumnSettings;
}) {
  const message = useCycle(loading, THINKING);
  const ok = results?.filter((r) => r.result.status === "success") ?? [];
  const flagged = ok.filter((r) => r.result.status === "success" && isLowConfidence(r.result.confidence, settings)).length;
  const avg = ok.length ? ok.reduce((s, r) => s + (r.result.status === "success" ? r.result.confidence : 0), 0) / ok.length : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
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
        <Button type="button" variant={results ? "outline" : "primary"} size="sm" onClick={onRun} loading={loading}>
          {!loading && (results ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />)} {results ? "Run again" : "Run preview"}
        </Button>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">via {modelName}</span>
      </div>

      {results && !loading && ok.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="scored" value={`${ok.length}/${results.length}`} />
          <MiniStat label="avg confidence" value={avg !== null ? `${Math.round(avg * 100)}%` : "—"} />
          <MiniStat label="would flag" value={String(flagged)} tone={flagged > 0 ? "warning" : undefined} />
        </div>
      )}

      {loading && (
        <div className="relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-border py-14 text-sm text-muted-foreground">
          <div className="grid-dots absolute inset-0 opacity-60" aria-hidden />
          <span className="animate-float relative flex h-12 w-12 items-center justify-center rounded-2xl bg-aurora animate-aurora text-[#0b0b0c] shadow-hover">
            <FlaskConical className="h-5 w-5" />
          </span>
          <AnimatePresence mode="wait">
            <motion.span key={message} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="relative">
              {message}
            </motion.span>
          </AnimatePresence>
        </div>
      )}

      {!loading && results && (
        <div className="flex flex-col gap-2">
          {results.map((r, i) => {
            const low = r.result.status === "success" && isLowConfidence(r.result.confidence, settings);
            return (
              <motion.div
                key={r.rowId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035 }}
                className={cn("rounded-2xl border p-3.5 transition-colors hover:bg-muted/30", low ? "border-warning/40" : "border-border")}
              >
                <div className="mb-2 flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">#{r.rowIndex + 1}</span>
                  <p className="line-clamp-3 flex-1 whitespace-pre-line text-xs text-muted-foreground">{r.sourceText}</p>
                  {low && (
                    <Badge tone="warning" className="shrink-0">
                      <Flag className="h-3 w-3" /> review
                    </Badge>
                  )}
                </div>
                {r.result.status === "success" ? (
                  <div className="flex flex-col gap-2">
                    <ConfidencePill label={r.result.predictedLabel} confidence={r.result.confidence} threshold={settings.confidenceThreshold} />
                    <ProbabilityBreakdown probabilities={r.result.probabilities} predicted={r.result.predictedLabel} />
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" /> {r.result.message}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && !results && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          <FlaskConical className="h-5 w-5" />
          <p>Take it for a spin on 10 rows before committing to the whole dataset.</p>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-display text-xl font-semibold tabular-nums", tone === "warning" && "text-warning")}>{value}</p>
    </div>
  );
}
