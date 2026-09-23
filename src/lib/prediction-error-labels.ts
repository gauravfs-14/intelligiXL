/** Friendly copy for AIR-006 provider error states — shared between the grid
 * cell popover and the Jobs/Logs failure list so they never drift apart. */
export const PREDICTION_ERROR_LABEL: Record<string, string> = {
  EMPTY_SOURCE: "No source text",
  TIMEOUT: "Timed out",
  RATE_LIMITED: "Rate limited",
  PROVIDER_UNAVAILABLE: "Provider unavailable",
  INVALID_RESPONSE: "Invalid response",
  AUTH_FAILURE: "API key invalid",
  UNKNOWN: "Failed",
};
