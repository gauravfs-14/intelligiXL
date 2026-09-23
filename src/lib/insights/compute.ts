import type { PredictionDto } from "@/types/workbench";

export interface LabelCount {
  label: string;
  count: number;
  percent: number;
  avgConfidence: number;
}

// FR-031/032 — categorical & binary counts + percentages.
export function computeLabelDistribution(predictions: PredictionDto[]): LabelCount[] {
  const successful = predictions.filter((p) => p.status === "SUCCESS" && p.predictedLabel);
  const total = successful.length;
  const groups = new Map<string, { count: number; confidenceSum: number }>();
  for (const p of successful) {
    const g = groups.get(p.predictedLabel!) ?? { count: 0, confidenceSum: 0 };
    g.count += 1;
    g.confidenceSum += p.confidence ?? 0;
    groups.set(p.predictedLabel!, g);
  }
  return [...groups.entries()]
    .map(([label, g]) => ({ label, count: g.count, percent: total > 0 ? g.count / total : 0, avgConfidence: g.confidenceSum / g.count }))
    .sort((a, b) => b.count - a.count);
}

export interface RatingStats {
  histogram: { level: string; label: string; count: number }[];
  mean: number | null;
}

// FR-033 — ordered rating histogram + expected score.
export function computeRatingStats(predictions: PredictionDto[]): RatingStats {
  const successful = predictions.filter((p) => p.status === "SUCCESS" && p.score !== null && p.legend);
  if (successful.length === 0) return { histogram: [], mean: null };

  const legend = successful[0].legend as Record<string, string>;
  const counts = new Map<string, number>(Object.keys(legend).map((k) => [k, 0]));
  let scoreSum = 0;
  for (const p of successful) {
    const nearest = String(Math.min(Object.keys(legend).length - 1, Math.max(0, Math.round(p.score!))));
    counts.set(nearest, (counts.get(nearest) ?? 0) + 1);
    scoreSum += p.score!;
  }
  const histogram = [...counts.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([level, count]) => ({ level, label: legend[level] ?? level, count }));

  return { histogram, mean: scoreSum / successful.length };
}

export interface ConfidenceBucket {
  bucket: string;
  min: number;
  count: number;
}

// FR-036 — confidence histogram across a Smart Column's predictions.
export function computeConfidenceHistogram(predictions: PredictionDto[], bucketSize = 0.1): ConfidenceBucket[] {
  const successful = predictions.filter((p) => p.status === "SUCCESS" && p.confidence !== null);
  const buckets = new Map<number, number>();
  for (let b = 0; b < 1; b = Math.round((b + bucketSize) * 100) / 100) buckets.set(b, 0);
  for (const p of successful) {
    const b = Math.min(0.9, Math.floor((p.confidence ?? 0) / bucketSize) * bucketSize);
    buckets.set(Math.round(b * 100) / 100, (buckets.get(Math.round(b * 100) / 100) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([min, count]) => ({ bucket: `${Math.round(min * 100)}–${Math.round((min + bucketSize) * 100)}%`, min, count }));
}

export interface CrosstabResult {
  labelsA: string[];
  labelsB: string[];
  matrix: Record<string, Record<string, number>>;
  total: number;
}

// FR-034 — cross-tabulation between two Smart Columns over the same rows.
export function computeCrosstab(
  predictionsA: Map<string, PredictionDto>,
  predictionsB: Map<string, PredictionDto>,
): CrosstabResult {
  const labelsA = new Set<string>();
  const labelsB = new Set<string>();
  const matrix: Record<string, Record<string, number>> = {};
  let total = 0;

  for (const [rowId, a] of predictionsA) {
    const b = predictionsB.get(rowId);
    if (!a.predictedLabel || !b?.predictedLabel || a.status !== "SUCCESS" || b.status !== "SUCCESS") continue;
    labelsA.add(a.predictedLabel);
    labelsB.add(b.predictedLabel);
    matrix[a.predictedLabel] ??= {};
    matrix[a.predictedLabel][b.predictedLabel] = (matrix[a.predictedLabel][b.predictedLabel] ?? 0) + 1;
    total += 1;
  }

  return { labelsA: [...labelsA].sort(), labelsB: [...labelsB].sort(), matrix, total };
}
