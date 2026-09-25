import { getDecisionModel, buildSourceState } from "@/lib/decision-models";
import { DEFAULT_MODEL_IDENTIFIER, DEFAULT_MODEL_PROVIDER, resolveSettings } from "@/lib/decision-models/catalog";
import type { ModelProviderId, SmartColumnSettings } from "@/lib/decision-models/catalog";
import type { BinaryLabels, CategoricalLabels, DecisionOptions, DecisionResult, RatingLabels } from "@/lib/decision-models/types";
import { Prisma, PredictionErrorReason, PredictionStatus, SmartColumnType } from "@/generated/prisma/client";

export interface RunOneParams {
  type: SmartColumnType;
  question: string;
  instructions?: string | null;
  labels: unknown;
  sourceColumns: string[];
  row: Record<string, unknown>;
  /** Defaults to DEFAULT_MODEL_PROVIDER / DEFAULT_MODEL_IDENTIFIER. */
  modelProvider?: ModelProviderId | string | null;
  modelIdentifier?: string | null;
  /** Partial is fine — merged over defaults via resolveSettings. */
  settings?: Partial<SmartColumnSettings> | null;
}

/** The single place a Smart Column question is actually evaluated against a
 * row — used by both the synchronous Preview endpoint and the background
 * generation worker, so the two can never drift apart. */
export async function runSmartColumnOnRow(params: RunOneParams): Promise<DecisionResult> {
  const { fields, isEmpty } = buildSourceState(params.row, params.sourceColumns);
  if (isEmpty) {
    return {
      status: "not_processed",
      reason: PredictionErrorReason.EMPTY_SOURCE,
      message: "All selected source columns are empty for this row.",
    };
  }

  const instructions = params.instructions ?? undefined;
  const provider = params.modelProvider ?? DEFAULT_MODEL_PROVIDER;
  const model = getDecisionModel(provider);
  const settings = resolveSettings(params.settings);
  const options: DecisionOptions = {
    model: params.modelIdentifier ?? (provider === DEFAULT_MODEL_PROVIDER ? DEFAULT_MODEL_IDENTIFIER : undefined),
    timeoutMs: settings.timeoutMs,
    maxRetries: settings.maxRetries,
  };
  switch (params.type) {
    case SmartColumnType.BINARY:
      return model.binaryDecision(fields, params.question, params.labels as BinaryLabels, instructions, options);
    case SmartColumnType.CATEGORICAL:
      return model.categoricalDecision(fields, params.question, params.labels as CategoricalLabels, instructions, options);
    case SmartColumnType.RATING:
      return model.ordinalDecision(fields, params.question, params.labels as RatingLabels, instructions, options);
    default:
      throw new Error(`Unhandled Smart Column type: ${params.type as string}`);
  }
}

export interface PredictionWriteData {
  status: PredictionStatus;
  errorReason: PredictionErrorReason | null;
  predictedLabel: string | null;
  confidence: number | null;
  probabilities: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  score: number | null;
  legend: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  modelVersion: string | null;
}

export function decisionResultToPredictionData(result: DecisionResult): PredictionWriteData {
  if (result.status === "success") {
    return {
      status: PredictionStatus.SUCCESS,
      errorReason: null,
      predictedLabel: result.predictedLabel,
      confidence: result.confidence,
      probabilities: result.probabilities,
      score: result.kind === "rating" ? result.score : null,
      legend: result.kind === "rating" ? result.legend : Prisma.JsonNull,
      modelVersion: result.modelVersion,
    };
  }
  return {
    status: result.status === "not_processed" ? PredictionStatus.NOT_PROCESSED : PredictionStatus.FAILED,
    errorReason: result.reason,
    predictedLabel: null,
    confidence: null,
    probabilities: Prisma.JsonNull,
    score: null,
    legend: Prisma.JsonNull,
    modelVersion: null,
  };
}
