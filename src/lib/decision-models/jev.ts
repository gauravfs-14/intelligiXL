import {
  AuthenticationError,
  APIConnectionError,
  APITimeoutError,
  RateLimitError,
  InternalServerError,
  choice,
  score as scoreQuestion,
  TypeSafeClient,
  type ScoreCriteria,
} from "@typesafe-ai/sdk";
import { PredictionErrorReason } from "@/generated/prisma/client";
import type {
  BinaryLabels,
  CategoricalLabels,
  DecisionModel,
  DecisionResult,
  RatingLabels,
} from "./types";

/** The provider's Score criteria type is a `readonly [X, X, ...X[]]` tuple so
 * TS can infer legend/probability keys from a literal array. Our rating
 * scales are user-defined at runtime (dynamic length), so we widen to that
 * shape here and read the response loosely below rather than fighting the
 * generic inference for a length TS can't know statically. */
type LooseScoreResponse = {
  type: "score";
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
};

const MODEL = "jev-latest";

let client: TypeSafeClient | null = null;

/** Lazily constructed so a missing TYPESAFE_API_KEY only surfaces when a
 * generation actually runs, not at module import / build time. */
function getClient(): TypeSafeClient {
  if (!client) client = new TypeSafeClient();
  return client;
}

function combineInstructions(question: string, instructions?: string): string {
  return instructions?.trim() ? `${question}\n\nAdditional instructions: ${instructions.trim()}` : question;
}

/** Maps SDK/HTTP failures onto AIR-006's provider error states. */
function toFailure(err: unknown): DecisionResult {
  if (err instanceof AuthenticationError) {
    return { status: "failed", reason: PredictionErrorReason.AUTH_FAILURE, message: err.message };
  }
  if (err instanceof RateLimitError) {
    return { status: "failed", reason: PredictionErrorReason.RATE_LIMITED, message: err.message };
  }
  if (err instanceof InternalServerError) {
    return { status: "failed", reason: PredictionErrorReason.PROVIDER_UNAVAILABLE, message: err.message };
  }
  if (err instanceof APITimeoutError) {
    return { status: "failed", reason: PredictionErrorReason.TIMEOUT, message: err.message };
  }
  if (err instanceof APIConnectionError) {
    return { status: "failed", reason: PredictionErrorReason.PROVIDER_UNAVAILABLE, message: err.message };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: "failed", reason: PredictionErrorReason.INVALID_RESPONSE, message };
}

export const jevDecisionModel: DecisionModel = {
  async binaryDecision(input, question, labels: BinaryLabels, instructions) {
    try {
      const response = await getClient().systemOne({
        state: input,
        model: MODEL,
        questions: {
          answer: choice(combineInstructions(question, instructions), {
            yes: labels.yes,
            no: labels.no,
          }),
        },
      });
      const answer = response.answers.answer;
      if (!answer || answer.type !== "choice") {
        return { status: "failed", reason: PredictionErrorReason.INVALID_RESPONSE, message: "Unexpected response shape from Jev." };
      }
      return {
        status: "success",
        kind: "choice",
        provider: "typesafe",
        model: MODEL,
        modelVersion: response.model,
        predictedLabel: answer.choice,
        confidence: answer.confidence,
        probabilities: answer.probabilities,
      };
    } catch (err) {
      return toFailure(err);
    }
  },

  async categoricalDecision(input, question, labels: CategoricalLabels, instructions) {
    try {
      const response = await getClient().systemOne({
        state: input,
        model: MODEL,
        questions: {
          answer: choice(combineInstructions(question, instructions), labels),
        },
      });
      const answer = response.answers.answer;
      if (!answer || answer.type !== "choice") {
        return { status: "failed", reason: PredictionErrorReason.INVALID_RESPONSE, message: "Unexpected response shape from Jev." };
      }
      return {
        status: "success",
        kind: "choice",
        provider: "typesafe",
        model: MODEL,
        modelVersion: response.model,
        predictedLabel: answer.choice,
        confidence: answer.confidence,
        probabilities: answer.probabilities,
      };
    } catch (err) {
      return toFailure(err);
    }
  },

  async ordinalDecision(input, question, scale: RatingLabels, instructions) {
    try {
      const response = await getClient().systemOne({
        state: input,
        model: MODEL,
        questions: {
          answer: scoreQuestion(combineInstructions(question, instructions), scale as unknown as ScoreCriteria),
        },
      });
      const answer = response.answers.answer as unknown as LooseScoreResponse;
      if (!answer || answer.type !== "score") {
        return { status: "failed", reason: PredictionErrorReason.INVALID_RESPONSE, message: "Unexpected response shape from Jev." };
      }
      const nearestLevel = Math.min(scale.length - 1, Math.max(0, Math.round(answer.score)));
      return {
        status: "success",
        kind: "rating",
        provider: "typesafe",
        model: MODEL,
        modelVersion: response.model,
        predictedLabel: answer.legend[String(nearestLevel)] ?? scale[nearestLevel],
        confidence: answer.confidence,
        probabilities: answer.probabilities,
        score: answer.score,
        legend: answer.legend,
      };
    } catch (err) {
      return toFailure(err);
    }
  },
};
