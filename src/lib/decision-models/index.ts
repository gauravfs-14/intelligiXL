import { jevDecisionModel } from "./jev";
import { layaDecisionModel } from "./laya";
import type { ModelProviderId } from "./catalog";
import type { DecisionModel } from "./types";

const REGISTRY: Record<ModelProviderId, DecisionModel> = {
  typesafe: jevDecisionModel,
  laya: layaDecisionModel,
};

/** Provider registry — call sites pick a provider per Smart Column version
 * and pass the model id via `options.model`. Unknown ids (e.g. a stale value
 * in the DB) fall back to the default provider rather than crashing a run. */
export function getDecisionModel(provider: ModelProviderId | string | null | undefined): DecisionModel {
  return REGISTRY[(provider ?? "typesafe") as ModelProviderId] ?? jevDecisionModel;
}

/** Default provider (Jev) — kept for call sites with no per-column model
 * choice, e.g. /api/ask. */
export const decisionModel: DecisionModel = jevDecisionModel;

export * from "./types";
export { buildSourceState, normalizeSourceText } from "./normalize";
