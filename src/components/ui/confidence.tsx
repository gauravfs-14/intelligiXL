import { cn, formatPercent } from "@/lib/utils";

export function confidenceTone(confidence: number): "success" | "warning" | "danger" {
  if (confidence >= 0.8) return "success";
  if (confidence >= 0.6) return "warning";
  return "danger";
}

const toneText = { success: "text-success", warning: "text-warning", danger: "text-danger" };
const toneBg = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" };

/** Compact "Motor Vehicle 92%" cell rendering (FR-020). */
export function ConfidencePill({ label, confidence }: { label: string; confidence: number }) {
  const tone = confidenceTone(confidence);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-sm">
      <span className={cn("h-1.5 w-1.5 shrink-0", toneBg[tone])} aria-hidden />
      <span className="truncate">{label}</span>
      <span className={cn("shrink-0 font-mono text-xs", toneText[tone])}>{formatPercent(confidence)}</span>
    </span>
  );
}

/** Full probability distribution, e.g. inside a cell detail popover (FR-021). */
export function ProbabilityBreakdown({
  probabilities,
  predicted,
}: {
  probabilities: Record<string, number>;
  predicted?: string;
}) {
  const entries = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col gap-2">
      {entries.map(([label, p]) => (
        <div key={label} className="flex items-center gap-2">
          <span className={cn("w-28 shrink-0 truncate text-xs", label === predicted && "font-semibold text-foreground")}>
            {label}
          </span>
          <div className="relative h-3 w-full grow border border-border bg-background">
            <div
              className={cn("h-full", label === predicted ? "bg-accent" : "bg-muted-foreground/50")}
              style={{ width: `${Math.max(0, Math.min(100, p * 100))}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground">{formatPercent(p, 1)}</span>
        </div>
      ))}
    </div>
  );
}
