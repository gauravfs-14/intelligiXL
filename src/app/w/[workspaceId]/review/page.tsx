"use client";

import * as React from "react";
import { use } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Pencil, SkipForward, ListChecks } from "lucide-react";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { useWorkbench } from "@/hooks/use-datasets";
import { useUpsertReview } from "@/hooks/use-reviews";
import { useTelemetry } from "@/hooks/use-telemetry";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProbabilityBreakdown } from "@/components/ui/confidence";
import { Panel, PanelBody } from "@/components/ui/panel";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { ReviewValuePicker } from "@/components/review/review-value-picker";
import { formatPercent } from "@/lib/utils";

type StatusFilter = "ALL" | "NOT_REVIEWED" | "CONFIRMED" | "CORRECTED" | "SKIPPED";

export default function ReviewPage({ params }: PageProps<"/w/[workspaceId]/review">) {
  const { workspaceId } = use(params);
  const searchParams = useSearchParams();
  const { datasetId } = useDatasetContext();
  const { data: workbench, isLoading, isError, refetch } = useWorkbench(datasetId ?? undefined);
  const upsertReview = useUpsertReview(datasetId ?? "");
  const track = useTelemetry(workspaceId);

  const [smartColumnId, setSmartColumnId] = React.useState<string | null>(searchParams.get("sc"));
  const [confidenceMax, setConfidenceMax] = React.useState(70);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("NOT_REVIEWED");
  const [index, setIndex] = React.useState(0);
  const [correctingValue, setCorrectingValue] = React.useState<string | null>(null);

  const smartColumns = workbench?.smartColumns.filter((sc) => sc.activeVersion) ?? [];
  React.useEffect(() => {
    if (!smartColumnId && smartColumns.length > 0) setSmartColumnId(smartColumns[0].id);
  }, [smartColumnId, smartColumns]);

  const current = smartColumns.find((sc) => sc.id === smartColumnId) ?? null;

  const queue = React.useMemo(() => {
    if (!workbench || !current?.activeVersion) return [];
    const rowsById = new Map(workbench.rows.map((r) => [r.id, r]));
    return workbench.predictions
      .filter((p) => p.smartColumnVersionId === current.activeVersion!.id && p.status === "SUCCESS")
      .filter((p) => (p.confidence ?? 1) <= confidenceMax / 100)
      .filter((p) => {
        const status = p.review?.status ?? "NOT_REVIEWED";
        return statusFilter === "ALL" || status === statusFilter;
      })
      .map((p) => ({ prediction: p, row: rowsById.get(p.datasetRowId)! }))
      .filter((item) => item.row)
      .sort((a, b) => (a.prediction.confidence ?? 0) - (b.prediction.confidence ?? 0));
  }, [workbench, current, confidenceMax, statusFilter]);

  React.useEffect(() => {
    setIndex(0);
    setCorrectingValue(null);
  }, [smartColumnId, confidenceMax, statusFilter]);

  const item = queue[index];

  async function act(status: "CONFIRMED" | "CORRECTED" | "SKIPPED", reviewedValue?: string) {
    if (!item) return;
    try {
      await upsertReview.mutateAsync({ predictionId: item.prediction.id, status, reviewedValue: reviewedValue ?? item.prediction.predictedLabel });
      track("review_completed", { status });
      setCorrectingValue(null);
      setIndex((i) => Math.min(i, queue.length - 2 < 0 ? 0 : queue.length - 2));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save review.");
    }
  }

  if (isLoading) return <div className="p-6"><TableSkeleton /></div>;
  if (isError) return <div className="p-6"><ErrorState onRetry={() => refetch()} /></div>;
  if (!datasetId || !workbench) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center p-6">
        <EmptyState icon={ListChecks} title="No dataset selected" description="Pick or upload a dataset from the Data tab first." />
      </div>
    );
  }
  if (smartColumns.length === 0) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center p-6">
        <EmptyState icon={ListChecks} title="No Smart Columns yet" description="Create a Smart Column on the Data tab to start reviewing predictions." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Smart Column</span>
          <Select value={smartColumnId ?? ""} onValueChange={setSmartColumnId}>
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
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOT_REVIEWED">Not reviewed</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="CORRECTED">Corrected</SelectItem>
              <SelectItem value="SKIPPED">Skipped</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confidence &lt; {confidenceMax}%</span>
          <Slider min={0} max={100} step={5} value={[confidenceMax]} onValueChange={([v]) => setConfidenceMax(v)} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {queue.length.toLocaleString()} record(s) in this queue.
      </p>

      {queue.length === 0 ? (
        <EmptyState icon={Check} title="Queue is empty" description="Nothing matches these filters — widen the confidence range or change status." />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={item?.prediction.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
            <Panel>
              <PanelBody className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Record {index + 1} of {queue.length}
                  </span>
                  {item?.prediction.review && item.prediction.review.status !== "NOT_REVIEWED" && (
                    <Badge tone={item.prediction.review.status === "CORRECTED" ? "warning" : "success"}>{item.prediction.review.status}</Badge>
                  )}
                </div>

                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                  {current?.activeVersion?.sourceColumns.map((col) => (
                    <p key={col} className="mb-1 last:mb-0">
                      <span className="font-semibold">{col}: </span>
                      {String(item?.row.data[col] ?? "—")}
                    </p>
                  ))}
                </div>

                {item && item.prediction.probabilities && (
                  <ProbabilityBreakdown probabilities={item.prediction.probabilities} predicted={item.prediction.predictedLabel ?? undefined} />
                )}

                {item && (
                  <p className="text-sm">
                    Predicted: <span className="font-semibold">{item.prediction.predictedLabel}</span>{" "}
                    <span className="text-muted-foreground">({formatPercent(item.prediction.confidence ?? 0)} confidence)</span>
                  </p>
                )}

                {correctingValue !== null ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correct to:</span>
                    {current?.activeVersion && (
                      <ReviewValuePicker version={current.activeVersion} value={correctingValue || null} onChange={setCorrectingValue} />
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" disabled={!correctingValue} onClick={() => act("CORRECTED", correctingValue)}>
                        Save correction
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCorrectingValue(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => act("CONFIRMED")} loading={upsertReview.isPending}>
                      <Check className="h-3.5 w-3.5" /> Confirm
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCorrectingValue(item?.prediction.predictedLabel ?? "")}>
                      <Pencil className="h-3.5 w-3.5" /> Correct
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => act("SKIPPED")}>
                      <SkipForward className="h-3.5 w-3.5" /> Skip
                    </Button>
                  </div>
                )}
              </PanelBody>
            </Panel>
          </motion.div>
        </AnimatePresence>
      )}

      {queue.length > 0 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIndex((i) => Math.min(queue.length - 1, i + 1))} disabled={index >= queue.length - 1}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
