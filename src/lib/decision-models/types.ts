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

export interface DecisionModel {
  /** A 2-option Choice: `yes` vs `no`, preserving the full distribution. */
  binaryDecision(input: string, question: string, labels: BinaryLabels, instructions?: string): Promise<DecisionResult>;
  categoricalDecision(input: string, question: string, labels: CategoricalLabels, instructions?: string): Promise<DecisionResult>;
  ordinalDecision(input: string, question: string, scale: RatingLabels, instructions?: string): Promise<DecisionResult>;
}
