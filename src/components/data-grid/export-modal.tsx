"use client";

import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiPost } from "@/lib/api-client";
import { buildExportRows, type ExportOptions } from "@/lib/export/build-rows";
import { downloadCsv, downloadXlsx } from "@/lib/export/download";
import type { DatasetDto, DatasetRowDto, PredictionDto, WorkbenchSmartColumnDto } from "@/types/workbench";

// FR-037/038/039 — export the augmented dataset with chosen extra fields.
export function ExportModal({
  open,
  onOpenChange,
  workspaceId,
  dataset,
  rows,
  smartColumns,
  predictionsByRow,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  dataset: DatasetDto;
  rows: DatasetRowDto[];
  smartColumns: WorkbenchSmartColumnDto[];
  predictionsByRow: Map<string, Map<string, PredictionDto>>;
}) {
  const [format, setFormat] = React.useState<"CSV" | "XLSX">("CSV");
  const [options, setOptions] = React.useState<ExportOptions>({
    includeConfidence: true,
    includeReviewedValue: true,
    includeProbabilities: false,
  });

  async function handleExport() {
    const exportRows = buildExportRows(rows, smartColumns, predictionsByRow, options);
    const base = dataset.filename.replace(/\.[^.]+$/, "");
    try {
      if (format === "CSV") downloadCsv(exportRows, `${base}_augmented.csv`);
      else await downloadXlsx(exportRows, `${base}_augmented.xlsx`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
      return;
    }

    const fields = ["predictedLabel", ...(options.includeConfidence ? ["confidence"] : []), ...(options.includeReviewedValue ? ["reviewedValue"] : []), ...(options.includeProbabilities ? ["probabilities"] : [])];
    apiPost("/api/exports", { workspaceId, datasetId: dataset.id, format, fields }).catch(() => {});
    toast.success(`Exported ${exportRows.length.toLocaleString()} rows.`);
    onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Export dataset" description="Download the augmented dataset with your Smart Columns." size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format</span>
          <Select value={format} onValueChange={(v) => setFormat(v as "CSV" | "XLSX")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CSV">CSV</SelectItem>
              <SelectItem value="XLSX">XLSX</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Include</span>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={options.includeConfidence} onCheckedChange={(v) => setOptions((o) => ({ ...o, includeConfidence: Boolean(v) }))} />
            Confidence
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={options.includeReviewedValue}
              onCheckedChange={(v) => setOptions((o) => ({ ...o, includeReviewedValue: Boolean(v) }))}
            />
            Human-reviewed value
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={options.includeProbabilities}
              onCheckedChange={(v) => setOptions((o) => ({ ...o, includeProbabilities: Boolean(v) }))}
            />
            Full probability distribution
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport}>Export {rows.length.toLocaleString()} rows</Button>
        </div>
      </div>
    </Modal>
  );
}
