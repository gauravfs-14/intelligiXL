import type { DatasetRowDto, PredictionDto, WorkbenchSmartColumnDto } from "@/types/workbench";

export interface ExportOptions {
  includeConfidence: boolean;
  includeReviewedValue: boolean;
  includeProbabilities: boolean;
}

// FR-038 — predicted label always included; confidence, human-reviewed
// value, and the full probability distribution are opt-in extra fields.
export function buildExportRows(
  rows: DatasetRowDto[],
  smartColumns: WorkbenchSmartColumnDto[],
  predictionsByRow: Map<string, Map<string, PredictionDto>>,
  options: ExportOptions,
): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row.data };
    const preds = predictionsByRow.get(row.id);
    for (const sc of smartColumns) {
      const pred = preds?.get(sc.id);
      out[sc.name] = pred?.predictedLabel ?? "";
      if (options.includeConfidence) out[`${sc.name} (confidence)`] = pred?.confidence ?? "";
      if (options.includeReviewedValue) out[`${sc.name} (reviewed)`] = pred?.review?.reviewedValue ?? "";
      if (options.includeProbabilities) out[`${sc.name} (probabilities)`] = pred?.probabilities ? JSON.stringify(pred.probabilities) : "";
    }
    return out;
  });
}
