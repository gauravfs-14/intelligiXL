import type { DatasetRowDto, PredictionDto, WorkbenchSmartColumnDto } from "@/types/workbench";

export interface ExportOptions {
  includeConfidence: boolean;
  includeReviewedValue: boolean;
  includeProbabilities: boolean;
  /** Restrict output to these source-column names; omit/undefined = all. */
  sourceColumns?: string[];
  /** Restrict output to these Smart Columns; omit/undefined = all. */
  smartColumnIds?: string[];
}

// FR-038 — predicted label always included; confidence, human-reviewed
// value, and the full probability distribution are opt-in extra fields.
// Column selection (FR "Export Format" advanced options) lets a workspace
// export a subset instead of every source + Smart Column.
export function buildExportRows(
  rows: DatasetRowDto[],
  smartColumns: WorkbenchSmartColumnDto[],
  predictionsByRow: Map<string, Map<string, PredictionDto>>,
  options: ExportOptions,
): Record<string, unknown>[] {
  const sourceAllow = options.sourceColumns ? new Set(options.sourceColumns) : null;
  const smartAllow = options.smartColumnIds ? new Set(options.smartColumnIds) : null;
  const includedSmartColumns = smartAllow ? smartColumns.filter((sc) => smartAllow.has(sc.id)) : smartColumns;

  return rows.map((row) => {
    const out: Record<string, unknown> = sourceAllow
      ? Object.fromEntries(Object.entries(row.data).filter(([k]) => sourceAllow.has(k)))
      : { ...row.data };
    const preds = predictionsByRow.get(row.id);
    for (const sc of includedSmartColumns) {
      const pred = preds?.get(sc.id);
      out[sc.name] = pred?.predictedLabel ?? "";
      if (options.includeConfidence) out[`${sc.name} (confidence)`] = pred?.confidence ?? "";
      if (options.includeReviewedValue) out[`${sc.name} (reviewed)`] = pred?.review?.reviewedValue ?? "";
      if (options.includeProbabilities) out[`${sc.name} (probabilities)`] = pred?.probabilities ? JSON.stringify(pred.probabilities) : "";
    }
    return out;
  });
}
