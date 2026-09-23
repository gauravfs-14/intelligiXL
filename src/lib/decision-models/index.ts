import { jevDecisionModel } from "./jev";
import type { DecisionModel } from "./types";

/** Single seam the rest of the app depends on. Swapping providers means
 * changing this one export, not any call site (AIR-001). */
export const decisionModel: DecisionModel = jevDecisionModel;

export * from "./types";
export { buildSourceState, normalizeSourceText } from "./normalize";
