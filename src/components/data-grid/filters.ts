import type { DatasetRowDto, PredictionDto, WorkbenchSmartColumnDto } from "@/types/workbench";

export interface SmartColumnFilter {
  labels?: string[];
  minConfidence?: number;
  maxConfidence?: number;
}

export interface GridFilterState {
  search: string;
  columnFilters: Record<string, string>;
  smartColumnFilters: Record<string, SmartColumnFilter>;
}

export const EMPTY_FILTERS: GridFilterState = { search: "", columnFilters: {}, smartColumnFilters: {} };

export function hasActiveFilters(f: GridFilterState): boolean {
  return (
    f.search.trim().length > 0 ||
    Object.values(f.columnFilters).some((v) => v.trim().length > 0) ||
    Object.values(f.smartColumnFilters).some((v) => (v.labels && v.labels.length > 0) || v.minConfidence !== undefined || v.maxConfidence !== undefined)
  );
}

/** Applies search + per-column + per-Smart-Column (label / confidence) AND
 * filters (FR-022/023/024) to the row set, keyed off a datasetRowId ->
 * predictions-by-smartColumn lookup built once per render. */
export function applyFilters(
  rows: DatasetRowDto[],
  sourceColumns: string[],
  smartColumns: WorkbenchSmartColumnDto[],
  predictionsByRow: Map<string, Map<string, PredictionDto>>,
  filters: GridFilterState,
): DatasetRowDto[] {
  const search = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (search) {
      const matches = sourceColumns.some((col) => String(row.data[col] ?? "").toLowerCase().includes(search));
      if (!matches) return false;
    }

    for (const [col, needle] of Object.entries(filters.columnFilters)) {
      if (!needle.trim()) continue;
      if (!String(row.data[col] ?? "").toLowerCase().includes(needle.trim().toLowerCase())) return false;
    }

    const rowPredictions = predictionsByRow.get(row.id);
    for (const sc of smartColumns) {
      const f = filters.smartColumnFilters[sc.id];
      if (!f) continue;
      const pred = rowPredictions?.get(sc.id);
      if (f.labels && f.labels.length > 0) {
        if (!pred || !pred.predictedLabel || !f.labels.includes(pred.predictedLabel)) return false;
      }
      if (f.minConfidence !== undefined) {
        if (!pred || pred.confidence === null || pred.confidence < f.minConfidence) return false;
      }
      if (f.maxConfidence !== undefined) {
        if (!pred || pred.confidence === null || pred.confidence > f.maxConfidence) return false;
      }
    }

    return true;
  });
}
