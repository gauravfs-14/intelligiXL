"use client";

import * as React from "react";
import { isLowConfidence, resolveSettings } from "@/lib/decision-models/catalog";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCopy, Download, FileJson, FileSpreadsheet, FileText, Layers } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { apiPost } from "@/lib/api-client";
import { buildExportRows, type ExportOptions } from "@/lib/export/build-rows";
import { downloadCsv, downloadJson, downloadXlsx } from "@/lib/export/download";
import { cn } from "@/lib/utils";
import type { DatasetDto, DatasetRowDto, PredictionDto, WorkbenchSmartColumnDto } from "@/types/workbench";

type ExportFormat = "CSV" | "XLSX" | "JSON" | "PARQUET";

const FORMATS: { value: ExportFormat; label: string; hint: string; icon: React.ComponentType<{ className?: string }>; disabled?: boolean }[] = [
  { value: "CSV", label: "CSV", hint: "Comma-separated values", icon: FileText },
  { value: "XLSX", label: "Excel", hint: ".xlsx with formatting", icon: FileSpreadsheet },
  { value: "JSON", label: "JSON", hint: "Structured records", icon: FileJson },
  { value: "PARQUET", label: "Parquet", hint: "Columnar format", icon: Layers, disabled: true },
];

// FR-037/038/039 — export the augmented dataset: pick a format, choose
// which columns come along, and layer on reproducibility metadata. The
// summary panel mirrors the choices back with real, computed numbers
// (nothing here is placeholder data).
export function ExportModal({
  open,
  onOpenChange,
  workspaceId,
  dataset,
  rows,
  smartColumns,
  predictionsByRow,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  dataset: DatasetDto;
  rows: DatasetRowDto[];
  smartColumns: WorkbenchSmartColumnDto[];
  predictionsByRow: Map<string, Map<string, PredictionDto>>;
  loading?: boolean;
}) {
  const [format, setFormat] = React.useState<ExportFormat>("CSV");
  const [selectedSourceCols, setSelectedSourceCols] = React.useState<Set<string>>(new Set(dataset.columns.map((c) => c.name)));
  const [selectedSmartCols, setSelectedSmartCols] = React.useState<Set<string>>(new Set(smartColumns.map((c) => c.id)));
  const [includeSidecar, setIncludeSidecar] = React.useState(true);
  const [includeMetadata, setIncludeMetadata] = React.useState(true);
  const [reviewedOnly, setReviewedOnly] = React.useState(false);
  const [excludeFlagged, setExcludeFlagged] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelectedSourceCols(new Set(dataset.columns.map((c) => c.name)));
    setSelectedSmartCols(new Set(smartColumns.map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataset.id]);

  // Each Smart Column flags against its own review threshold (catalog.ts).
  const settingsById = React.useMemo(
    () => new Map(smartColumns.map((sc) => [sc.id, resolveSettings(sc.activeVersion?.settings)])),
    [smartColumns],
  );
  const isFlagged = (scId: string, confidence: number | null | undefined) => {
    const settings = settingsById.get(scId);
    return settings ? isLowConfidence(confidence, settings) : false;
  };

  function rowIsReviewed(rowId: string) {
    const preds = predictionsByRow.get(rowId);
    if (!preds) return false;
    return [...preds.values()].some((p) => p.review && p.review.status !== "NOT_REVIEWED");
  }
  function rowIsFlagged(rowId: string) {
    const preds = predictionsByRow.get(rowId);
    if (!preds) return false;
    return [...preds.entries()].some(([scId, p]) => isFlagged(scId, p.confidence));
  }

  const filteredRows = React.useMemo(
    () => rows.filter((r) => (!reviewedOnly || rowIsReviewed(r.id)) && (!excludeFlagged || !rowIsFlagged(r.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, reviewedOnly, excludeFlagged, predictionsByRow],
  );

  const exportOptions: ExportOptions = {
    includeConfidence: true,
    includeReviewedValue: true,
    includeProbabilities: false,
    sourceColumns: [...selectedSourceCols],
    smartColumnIds: [...selectedSmartCols],
  };

  const exportRows = React.useMemo(
    () => buildExportRows(filteredRows, smartColumns, predictionsByRow, exportOptions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredRows, smartColumns, predictionsByRow, selectedSourceCols, selectedSmartCols],
  );

  const includedSmartColumns = smartColumns.filter((sc) => selectedSmartCols.has(sc.id));
  const allConfidences: number[] = [];
  let flaggedCount = 0;
  for (const r of filteredRows) {
    const preds = predictionsByRow.get(r.id);
    let rowFlagged = false;
    for (const sc of includedSmartColumns) {
      const p = preds?.get(sc.id);
      if (p?.confidence !== null && p?.confidence !== undefined) {
        allConfidences.push(p.confidence);
        if (isFlagged(sc.id, p.confidence)) rowFlagged = true;
      }
    }
    if (rowFlagged) flaggedCount += 1;
  }
  const avgConfidence = allConfidences.length > 0 ? allConfidences.reduce((s, v) => s + v, 0) / allConfidences.length : null;

  const metadata = {
    dataset: dataset.filename,
    exported_at: new Date().toISOString(),
    model: "jev-latest (typesafe)",
    total_rows: filteredRows.length,
    smart_columns: includedSmartColumns.length,
    avg_confidence: avgConfidence !== null ? Number(avgConfidence.toFixed(3)) : null,
    flagged_rows: flaggedCount,
  };

  const previewPayload = format === "JSON" && includeMetadata ? { ixl_metadata: metadata, rows: exportRows } : exportRows;
  const estimatedBytes = new TextEncoder().encode(format === "CSV" ? exportRows.map((r) => Object.values(r).join(",")).join("\n") : JSON.stringify(previewPayload)).length;

  // Only strip a real file extension — a renamed dataset like "Survey v1.2"
  // must not lose its ".2".
  const base = dataset.filename.replace(/\.(csv|xlsx|json|jsonl|ndjson)$/i, "");

  function buildSidecar() {
    return {
      dataset: { filename: dataset.filename, rowCount: filteredRows.length, columnCount: selectedSourceCols.size },
      columns: dataset.columns.filter((c) => selectedSourceCols.has(c.name)).map((c) => ({ name: c.name, dataType: c.dataType })),
      smartColumns: includedSmartColumns.map((sc) => ({
        name: sc.name,
        type: sc.type,
        question: sc.activeVersion?.question ?? null,
        instructions: sc.activeVersion?.instructions ?? null,
        labels: sc.activeVersion?.labels ?? null,
      })),
      exported_at: metadata.exported_at,
    };
  }

  async function handleExport() {
    try {
      if (format === "CSV") {
        downloadCsv(exportRows, `${base}_augmented.csv`);
        if (includeMetadata) downloadJson(metadata, `${base}_augmented.metadata.json`);
      } else if (format === "XLSX") {
        await downloadXlsx(exportRows, `${base}_augmented.xlsx`);
        if (includeMetadata) downloadJson(metadata, `${base}_augmented.metadata.json`);
      } else if (format === "JSON") {
        downloadJson(previewPayload, `${base}_augmented.json`);
      }
      if (includeSidecar) downloadJson(buildSidecar(), `${base}_augmented.sidecar.json`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
      return;
    }

    apiPost("/api/exports", {
      workspaceId,
      datasetId: dataset.id,
      format,
      fields: Object.keys(exportRows[0] ?? {}),
      rowCount: exportRows.length,
    }).catch(() => {});
    toast.success(`Exported ${exportRows.length.toLocaleString()} row(s).`);
    onOpenChange(false);
  }

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(previewPayload, null, 2));
      toast.success("Copied export as JSON to clipboard.");
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  function toggleSource(name: string) {
    setSelectedSourceCols((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  function toggleSmart(id: string) {
    setSelectedSmartCols((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Export dataset" description="Download the augmented dataset with your Smart Columns." size="2xl">
      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading the full dataset…</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Export Format</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    disabled={f.disabled}
                    onClick={() => setFormat(f.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all",
                      f.disabled
                        ? "cursor-not-allowed border-border opacity-50"
                        : format === f.value
                          ? "border-primary bg-primary/[0.05] shadow-flat"
                          : "border-border bg-surface shadow-flat hover:-translate-y-0.5 hover:shadow-hover",
                    )}
                  >
                    <f.icon className={cn("h-5 w-5", format === f.value ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-semibold">{f.label}</span>
                    <span className="text-[11px] text-muted-foreground">{f.disabled ? "Coming soon" : f.hint}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Columns to Include</p>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                {dataset.columns.map((c) => (
                  <label key={c.name} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40">
                    <span className="flex items-center gap-2">
                      <Checkbox checked={selectedSourceCols.has(c.name)} onCheckedChange={() => toggleSource(c.name)} />
                      {c.name}
                    </span>
                    <Badge tone="muted">Original</Badge>
                  </label>
                ))}
                {smartColumns.map((sc) => (
                  <label key={sc.id} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40">
                    <span className="flex items-center gap-2">
                      <Checkbox checked={selectedSmartCols.has(sc.id)} onCheckedChange={() => toggleSmart(sc.id)} />
                      {sc.name}
                    </span>
                    <Badge tone="primary">AI</Badge>
                  </label>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Options</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <OptionToggle label="Include JSON sidecar" checked={includeSidecar} onCheckedChange={setIncludeSidecar} />
                <OptionToggle label="Include run metadata" checked={includeMetadata} onCheckedChange={setIncludeMetadata} />
                <OptionToggle label="Reviewed rows only" checked={reviewedOnly} onCheckedChange={setReviewedOnly} />
                <OptionToggle label="Exclude flagged rows" checked={excludeFlagged} onCheckedChange={setExcludeFlagged} />
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold">Export Summary</p>
              <p className="text-xs text-muted-foreground">{dataset.filename}</p>
            </div>
            <dl className="flex flex-col gap-2 text-xs">
              <SummaryRow label="Format" value={format} />
              <SummaryRow label="Rows" value={filteredRows.length.toLocaleString()} />
              <SummaryRow label="Columns" value={`${selectedSourceCols.size.toLocaleString()} selected`} />
              <SummaryRow label="AI Columns" value={<span className="text-primary">{includedSmartColumns.length} included</span>} />
              <SummaryRow label="File size (est.)" value={formatBytes(estimatedBytes)} />
              <SummaryRow label="Sidecar" value={includeSidecar ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> Included</span> : "—"} />
              <SummaryRow label="Run metadata" value={includeMetadata ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> Included</span> : "—"} />
            </dl>

            <pre className="max-h-48 overflow-auto rounded-md border border-border bg-background p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {JSON.stringify({ ixl_metadata: metadata }, null, 2)}
            </pre>

            <div className="mt-auto flex flex-col gap-2">
              <Button onClick={handleExport} disabled={format === "PARQUET"}>
                <Download className="h-3.5 w-3.5" /> Download {format}
              </Button>
              <Button variant="outline" onClick={handleCopyJson}>
                <ClipboardCopy className="h-3.5 w-3.5" /> Copy as JSON
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function OptionToggle({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `~${(bytes / 1024).toFixed(1)} KB`;
  return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
