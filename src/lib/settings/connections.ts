import { AuthenticationError, APIConnectionError, PermissionDeniedError } from "@typesafe-ai/sdk";
import { getJevClient } from "@/lib/decision-models/jev";
import { getLayaConfig } from "@/lib/decision-models/laya";
import { getSetting } from "./index";
import type { ConnectionStatus } from "./definitions";

const TIMEOUT_MS = 5_000;

/** Verifies the TypeSafe key by listing models (cheap, no inference). */
export async function checkTypeSafe(): Promise<ConnectionStatus> {
  const apiKey = await getSetting("TYPESAFE_API_KEY");
  if (!apiKey) return { provider: "typesafe", ok: false, message: "No API key set." };
  try {
    const client = await getJevClient();
    const models = await client.models.list({ timeout: TIMEOUT_MS, retry: { maxRetries: 0 } });
    return { provider: "typesafe", ok: true, message: `Connected. ${models.length} model${models.length === 1 ? "" : "s"} available.` };
  } catch (err) {
    if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
      return { provider: "typesafe", ok: false, message: "TypeSafe rejected this API key." };
    }
    if (err instanceof APIConnectionError) {
      return { provider: "typesafe", ok: false, message: "Couldn't reach api.typesafe.ai." };
    }
    return { provider: "typesafe", ok: false, message: err instanceof Error ? err.message : "Unknown error." };
  }
}

/** Checks laya-serve's /health endpoint. */
export async function checkLaya(): Promise<ConnectionStatus> {
  const config = await getLayaConfig();
  if (!config) return { provider: "laya", ok: false, message: "No server URL set." };
  try {
    const res = await fetch(`${config.baseURL}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return { provider: "laya", ok: false, message: `laya-serve returned HTTP ${res.status}.` };
    const body = (await res.json().catch(() => ({}))) as { loaded?: string[]; device?: string };
    const loaded = body.loaded?.length ? `Loaded: ${body.loaded.join(", ")}.` : "No checkpoints loaded yet (they download on first use).";
    return { provider: "laya", ok: true, message: `Connected. ${loaded}` };
  } catch {
    // Don't echo the URL back; the page already shows it.
    return { provider: "laya", ok: false, message: "Couldn't reach laya-serve. Is it running?" };
  }
}
