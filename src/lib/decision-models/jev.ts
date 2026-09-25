import { TypeSafeClient } from "@typesafe-ai/sdk";
import { getSetting } from "@/lib/settings";
import { DEFAULT_MODEL_IDENTIFIER } from "./catalog";
import { createSystemOneModel, MissingCredentialsError } from "./system-one";

let cached: { apiKey: string; client: TypeSafeClient } | null = null;

/** Built per API key, so saving a new key on the Settings page takes effect
 * without a restart. A missing key surfaces as an AUTH_FAILURE per row. */
export async function getJevClient(apiKeyOverride?: string): Promise<TypeSafeClient> {
  const apiKey = apiKeyOverride ?? (await getSetting("TYPESAFE_API_KEY"));
  if (!apiKey) throw new MissingCredentialsError("No TypeSafe API key configured. Add one on the Settings page or set TYPESAFE_API_KEY.");
  if (apiKeyOverride) return new TypeSafeClient({ apiKey });
  if (!cached || cached.apiKey !== apiKey) cached = { apiKey, client: new TypeSafeClient({ apiKey }) };
  return cached.client;
}

/** TypeSafe's hosted Jev. */
export const jevDecisionModel = createSystemOneModel({
  provider: "typesafe",
  label: "Jev",
  defaultModel: DEFAULT_MODEL_IDENTIFIER,
  getClient: () => getJevClient(),
});
