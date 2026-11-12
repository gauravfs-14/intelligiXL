/** Client-safe model catalog + per-run settings contract. No SDK/server
 * imports here — the Smart Column Builder, the grid and the server-side
 * decision models all read the same definitions, so a model or a default
 * can't drift between what the UI offers and what the worker runs. */

export type ModelProviderId = "typesafe" | "laya";

export interface ModelOption {
  /** Sent as `SmartColumnVersion.modelIdentifier`. */
  id: string;
  provider: ModelProviderId;
  /** Short display name, e.g. "Jev". */
  name: string;
  /** Version/variant chip, e.g. "latest", "1.13.0". */
  variant: string;
  description: string;
  tags: string[];
  recommended?: boolean;
  /** Filled in server-side by GET /api/models. */
  available: boolean;
  unavailableReason?: string;
}

export interface ModelProviderInfo {
  id: ModelProviderId;
  name: string;
  tagline: string;
  models: ModelOption[];
  available: boolean;
  unavailableReason?: string;
}

export const DEFAULT_MODEL_PROVIDER: ModelProviderId = "typesafe";
export const DEFAULT_MODEL_IDENTIFIER = "jev-latest";

/** Static Jev catalog (docs.typesafe.ai/models). Aliases move when a new
 * release ships; the pinned ID is for users who have tuned thresholds. */
export const JEV_MODELS: Omit<ModelOption, "available" | "unavailableReason">[] = [
  {
    id: "jev-latest",
    provider: "typesafe",
    name: "Jev",
    variant: "latest",
    description: "TypeSafe's flagship System One model. Returns a label and probabilities for each row.",
    tags: ["Hosted", "Fast"],
    recommended: true,
  },
  {
    id: "jev-preview",
    provider: "typesafe",
    name: "Jev",
    variant: "preview",
    description: "The newest build, official or not. Moves ahead of latest when a preview ships.",
    tags: ["Bleeding edge"],
  },
  {
    id: "jev-1.13.0",
    provider: "typesafe",
    name: "Jev",
    variant: "1.13.0",
    description: "Pinned version. Answers won't shift under you when a new release lands, so it's good for reproducible studies.",
    tags: ["Pinned", "Reproducible"],
  },
];

/** Laya checkpoints (huggingface.co/convaiinnovations). `serverModel` is
 * what laya-serve's `model` field expects; "auto" lets its router pick by
 * language/script. */
export const LAYA_MODELS: (Omit<ModelOption, "available" | "unavailableReason"> & { serverModel: string })[] = [
  {
    id: "laya-auto",
    provider: "laya",
    name: "Laya",
    variant: "auto",
    serverModel: "convaiinnovations/laya",
    description: "Laya's router picks the English or multilingual checkpoint per row, based on the text's language.",
    tags: ["Open weights", "100+ languages"],
    recommended: true,
  },
  {
    id: "laya-english",
    provider: "laya",
    name: "Laya",
    variant: "english",
    serverModel: "english",
    description: "ModernBERT-large, 421M params, 512-token context. The most accurate choice for English-only data.",
    tags: ["Open weights", "English"],
  },
  {
    id: "laya-multilingual",
    provider: "laya",
    name: "Laya",
    variant: "multilingual",
    serverModel: "multilingual",
    description: "mmBERT-base, 322M params. Twice as fast and handles long documents, in 100+ languages.",
    tags: ["Open weights", "Fast"],
  },
  {
    id: "laya-typed-decisions",
    provider: "laya",
    name: "Laya",
    variant: "typed-decisions",
    serverModel: "typed-decisions",
    description: "Fine-tuned on typed-decision workflows such as triage, routing and moderation.",
    tags: ["Open weights", "Fine-tuned"],
  },
];

export type LowConfidenceAction = "flag" | "none";

/** Per-version run settings, persisted on `SmartColumnVersion.settings`.
 * Every field has a default so older versions (settings = null) behave
 * exactly as they did before these knobs existed. */
export interface SmartColumnSettings {
  /** Predictions below this confidence are flagged for review. */
  confidenceThreshold: number;
  lowConfidenceAction: LowConfidenceAction;
  /** Parallel provider requests during a full generation run. */
  concurrency: number;
  /** Per-attempt request timeout. */
  timeoutMs: number;
  /** Retries after the initial attempt on retryable failures. */
  maxRetries: number;
}

export const DEFAULT_SMART_COLUMN_SETTINGS: SmartColumnSettings = {
  confidenceThreshold: 0.8,
  lowConfidenceAction: "flag",
  concurrency: 6,
  timeoutMs: 10_000,
  maxRetries: 2,
};

export const SETTINGS_LIMITS = {
  confidenceThreshold: { min: 0.5, max: 0.99, step: 0.01 },
  concurrency: { min: 1, max: 16, step: 1 },
  timeoutMs: { min: 2_000, max: 60_000, step: 1_000 },
  maxRetries: { min: 0, max: 5, step: 1 },
} as const;

/** Merges a stored (possibly partial / null) settings blob over defaults. */
export function resolveSettings(raw: unknown): SmartColumnSettings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<SmartColumnSettings>;
  return { ...DEFAULT_SMART_COLUMN_SETTINGS, ...s };
}

/** True when a prediction should be surfaced as low-confidence under the
 * column's settings. Used by the grid, export and the worker's run log. */
export function isLowConfidence(confidence: number | null | undefined, settings: SmartColumnSettings): boolean {
  if (settings.lowConfidenceAction === "none") return false;
  return confidence !== null && confidence !== undefined && confidence < settings.confidenceThreshold;
}

export function modelDisplayName(_provider: string, identifier: string): string {
  const known = [...JEV_MODELS, ...LAYA_MODELS].find((m) => m.id === identifier);
  return known ? `${known.name} ${known.variant}` : identifier;
}
