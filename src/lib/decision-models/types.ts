import type { PredictionErrorReason } from "@/generated/prisma/client";

/** BINARY Smart Column labels. Modeled as a 2-option Choice so the provider
 * returns a full probability distribution + confidence (AIR-002), not just a
 * bare 0/1 the way a yes/no primitive alone would. */
export type BinaryLabels = { yes: string | null; no: string | null };

/** CATEGORICAL Smart Column labels: option name -> rubric description. */
export type CategoricalLabels = Record<string, string | null>;

/** RATING Smart Column labels: ordered levels, low -> high. */
export type RatingLabels = string[];

interface NormalizedBase {
  provider: string;
  model: string;
  modelVersion: string;
}

export interface ChoiceDecisionResult extends NormalizedBase {
  status: "success";
  kind: "choice";
  predictedLabel: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface RatingDecisionResult extends NormalizedBase {
  status: "success";
  kind: "rating";
  predictedLabel: string;
  confidence: number;
  probabilities: Record<string, number>;
  score: number;
  legend: Record<string, string>;
}

export type SuccessDecisionResult = ChoiceDecisionResult | RatingDecisionResult;

export interface FailedDecisionResult {
  status: "failed" | "not_processed";
  reason: PredictionErrorReason;
  message: string;
}

export type DecisionResult = SuccessDecisionResult | FailedDecisionResult;

/** Named source-column fields, sent to the provider as structured state
 * rather than a flattened block of text — per TypeSafe's own guidance,
 * named JSON fields let the model tell columns apart instead of having to
 * re-infer structure from prose (e.g. "Title" vs. "Article Text"). */
export type DecisionInput = Record<string, string>;

/** Per-call overrides. Omitted fields use the provider's defaults. */
export interface DecisionOptions {
  /** Provider-specific model id, e.g. "jev-1.13.0" or "llama3.1:8b". */
  model?: string;
  /** Per-attempt request timeout. */
  timeoutMs?: number;
  /** Retries after the initial attempt on retryable failures. */
  maxRetries?: number;
}

export interface DecisionModel {
  /** A 2-option Choice: `yes` vs `no`, preserving the full distribution. */
  binaryDecision(
    input: DecisionInput,
    question: string,
    labels: BinaryLabels,
    instructions?: string,
    options?: DecisionOptions,
  ): Promise<DecisionResult>;
  categoricalDecision(
    input: DecisionInput,
    question: string,
    labels: CategoricalLabels,
    instructions?: string,
    options?: DecisionOptions,
  ): Promise<DecisionResult>;
  ordinalDecision(
    input: DecisionInput,
    question: string,
    scale: RatingLabels,
    instructions?: string,
    options?: DecisionOptions,
  ): Promise<DecisionResult>;
}
