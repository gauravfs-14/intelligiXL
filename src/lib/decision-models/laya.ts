import { TypeSafeClient } from "@typesafe-ai/sdk";
import { getSetting } from "@/lib/settings";
import { LAYA_MODELS } from "./catalog";
import { createSystemOneModel, MissingCredentialsError } from "./system-one";

/** Laya (github.com/NandhaKishorM/laya) — an open-weights, non-autoregressive
 * System One engine. `laya-serve` speaks Jev's own `POST /v1/systemone`
 * protocol, so it's the same SDK client pointed at a different base URL.
 *
 *   LAYA_BASE_URL   e.g. http://localhost:8000 (enables the provider)
 *   LAYA_API_KEY    only if the server was started with LAYA_API_KEY
 *
 * Both can also be set on the Settings page; env vars take precedence. */
export async function getLayaConfig(): Promise<{ baseURL: string; apiKey: string } | null> {
  const baseURL = await getSetting("LAYA_BASE_URL");
  if (!baseURL) return null;
  // The SDK insists on a key; an unauthenticated laya-serve ignores it.
  return { baseURL: baseURL.replace(/\/+$/, ""), apiKey: (await getSetting("LAYA_API_KEY")) || "laya-local" };
}

let cached: { signature: string; client: TypeSafeClient } | null = null;

async function getClient(): Promise<TypeSafeClient> {
  const config = await getLayaConfig();
  if (!config) throw new MissingCredentialsError("Laya isn't configured. Add a server URL on the Settings page or set LAYA_BASE_URL.");
  const signature = `${config.baseURL}|${config.apiKey}`;
  if (!cached || cached.signature !== signature) {
    cached = { signature, client: new TypeSafeClient({ baseURL: config.baseURL, apiKey: config.apiKey }) };
  }
  return cached.client;
}

const SERVER_MODEL: Record<string, string> = Object.fromEntries(LAYA_MODELS.map((m) => [m.id, m.serverModel]));

export const layaDecisionModel = createSystemOneModel({
  provider: "laya",
  label: "Laya",
  defaultModel: "laya-auto",
  getClient,
  resolveModel: (model) => SERVER_MODEL[model] ?? model,
  // Laya reports 1 − normalised entropy, not Jev's concentration measure;
  // recompute so a column's review threshold transfers between engines.
  normalizeConfidence: true,
});
