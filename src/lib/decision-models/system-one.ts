import {
  AuthenticationError,
  APIConnectionError,
  APITimeoutError,
  RateLimitError,
  InternalServerError,
  UnprocessableEntityError,
  choice,
  score as scoreQuestion,
  type TypeSafeClient,
  type RequestOptions,
  type ScoreCriteria,
} from "@typesafe-ai/sdk";
import { PredictionErrorReason } from "@/generated/prisma/client";
import type { ModelProviderId } from "./catalog";
import type {
  BinaryLabels,
  CategoricalLabels,
  DecisionModel,
  DecisionOptions,
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

export interface SystemOneProviderConfig {
  provider: ModelProviderId;
  /** Human name used in error messages, e.g. "Jev", "Laya". */
  label: string;
  defaultModel: string;
  /** Async so credentials can come from the Settings store at call time. */
  getClient: () => Promise<TypeSafeClient>;
  /** Maps a catalog model id onto the `model` field the server expects. */
  resolveModel?: (model: string) => string;
  /** Recompute confidence from the probability distribution instead of
   * trusting the server's — for engines whose confidence is defined
   * differently, so one review threshold means the same thing everywhere. */
  normalizeConfidence?: boolean;
}

/** TypeSafe's Choice/Score confidence: how concentrated the distribution is,
 * (n·p_max − 1)/(n − 1), clamped to [0, 1] (docs.typesafe.ai/confidence). */
export function concentrationConfidence(probabilities: Record<string, number>): number {
  const values = Object.values(probabilities);
  const n = values.length;
  if (n < 2) return 1;
  const peak = Math.max(...values);
  return Math.min(1, Math.max(0, (n * peak - 1) / (n - 1)));
}

/** Per-call SDK overrides — only set what the caller asked for so the
 * client's own defaults (10s timeout, 2 retries) still apply otherwise. */
function requestOptions(options?: DecisionOptions): RequestOptions | undefined {
  if (!options) return undefined;
  const out: RequestOptions = {};
  if (options.timeoutMs !== undefined) out.timeout = options.timeoutMs;
  if (options.maxRetries !== undefined) out.retry = { maxRetries: options.maxRetries };
  return out;
}

function combineInstructions(question: string, instructions?: string): string {
  return instructions?.trim() ? `${question}\n\nAdditional instructions: ${instructions.trim()}` : question;
}

/** No credentials/URL configured for a provider (env or Settings page). */
export class MissingCredentialsError extends Error {}

/** Maps SDK/HTTP failures onto AIR-006's provider error states. */
function toFailure(err: unknown): DecisionResult {
  if (err instanceof MissingCredentialsError) {
    return { status: "failed", reason: PredictionErrorReason.AUTH_FAILURE, message: err.message };
  }
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
  if (err instanceof UnprocessableEntityError) {
    // The server rejected the question itself (e.g. too many options for
    // the model's window) — its detail says what to fix, so surface it.
    const detail = (err.body as { detail?: unknown } | undefined)?.detail;
    return { status: "failed", reason: PredictionErrorReason.INVALID_RESPONSE, message: typeof detail === "string" ? detail : err.message };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: "failed", reason: PredictionErrorReason.INVALID_RESPONSE, message };
}

/** A DecisionModel for any server speaking the System One wire protocol
 * (`POST /v1/systemone`): TypeSafe's hosted Jev, or a self-hosted Laya. */
export function createSystemOneModel(config: SystemOneProviderConfig): DecisionModel {
  const shapeError = (): DecisionResult => ({
    status: "failed",
    reason: PredictionErrorReason.INVALID_RESPONSE,
    message: `Unexpected response shape from ${config.label}.`,
  });

  function confidenceOf(reported: number, probabilities: Record<string, number>): number {
    return config.normalizeConfidence ? concentrationConfidence(probabilities) : reported;
  }

  async function ask(model: string, input: Record<string, string>, question: unknown, options?: DecisionOptions) {
    const client = await config.getClient();
    return client.systemOne(
      {
        state: input,
        model: config.resolveModel ? config.resolveModel(model) : model,
        questions: { answer: question as ReturnType<typeof choice> },
      },
      requestOptions(options),
    );
  }

  async function choiceDecision(
    input: Record<string, string>,
    prompt: string,
    criteria: Record<string, string | null>,
    options?: DecisionOptions,
  ): Promise<DecisionResult> {
    const model = options?.model ?? config.defaultModel;
    try {
      const response = await ask(model, input, choice(prompt, criteria), options);
      const answer = response.answers.answer;
      if (!answer || answer.type !== "choice") return shapeError();
      return {
        status: "success",
        kind: "choice",
        provider: config.provider,
        model,
        modelVersion: response.model,
        predictedLabel: answer.choice,
        confidence: confidenceOf(answer.confidence, answer.probabilities),
        probabilities: answer.probabilities,
      };
    } catch (err) {
      return toFailure(err);
    }
  }

  return {
    binaryDecision(input, question, labels: BinaryLabels, instructions, options) {
      return choiceDecision(input, combineInstructions(question, instructions), { yes: labels.yes, no: labels.no }, options);
    },

    categoricalDecision(input, question, labels: CategoricalLabels, instructions, options) {
      return choiceDecision(input, combineInstructions(question, instructions), labels, options);
    },

    async ordinalDecision(input, question, scale: RatingLabels, instructions, options) {
      const model = options?.model ?? config.defaultModel;
      try {
        const response = await ask(model, input, scoreQuestion(combineInstructions(question, instructions), scale as unknown as ScoreCriteria), options);
        const answer = response.answers.answer as unknown as LooseScoreResponse;
        if (!answer || answer.type !== "score") return shapeError();
        const nearestLevel = Math.min(scale.length - 1, Math.max(0, Math.round(answer.score)));
        return {
          status: "success",
          kind: "rating",
          provider: config.provider,
          model,
          modelVersion: response.model,
          predictedLabel: answer.legend[String(nearestLevel)] ?? scale[nearestLevel],
          confidence: confidenceOf(answer.confidence, answer.probabilities),
          probabilities: answer.probabilities,
          score: answer.score,
          legend: answer.legend,
        };
      } catch (err) {
        return toFailure(err);
      }
    },
  };
}
