import type { SmartColumnType } from "@/generated/prisma/client";
import type { ModelProviderId, SmartColumnSettings } from "@/lib/decision-models/catalog";
import type { DecisionResult } from "@/lib/decision-models/types";
import { buildSourceState } from "@/lib/decision-models/normalize";
import { runSmartColumnOnRow } from "./run";

export interface PreviewRowResult {
  rowId: string;
  rowIndex: number;
  sourceText: string;
  result: DecisionResult;
}

export interface PreviewParams {
  type: SmartColumnType;
  question: string;
  instructions?: string | null;
  labels: unknown;
  sourceColumns: string[];
  rows: { id: string; rowIndex: number; data: Record<string, unknown> }[];
  modelProvider?: ModelProviderId;
  modelIdentifier?: string;
  settings?: Partial<SmartColumnSettings>;
}

/** FR-012/013 — runs a Smart Column on a small sample and returns enough to
 * render source text + prediction + confidence + full distribution per row. */
export async function previewSmartColumn(params: PreviewParams): Promise<PreviewRowResult[]> {
  return Promise.all(
    params.rows.map(async (row) => {
      const result = await runSmartColumnOnRow({
        type: params.type,
        question: params.question,
        instructions: params.instructions,
        labels: params.labels,
        sourceColumns: params.sourceColumns,
        row: row.data,
        modelProvider: params.modelProvider,
        modelIdentifier: params.modelIdentifier,
        settings: params.settings,
      });
      const { text } = buildSourceState(row.data, params.sourceColumns);
      return { rowId: row.id, rowIndex: row.rowIndex, sourceText: text, result };
    }),
  );
}
