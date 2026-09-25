import type { Prisma } from "@/generated/prisma/client";
import {
  DEFAULT_MODEL_IDENTIFIER,
  DEFAULT_MODEL_PROVIDER,
  resolveSettings,
  type ModelProviderId,
} from "@/lib/decision-models/catalog";
import type { SmartColumnSettings } from "@/lib/decision-models/catalog";
import { ApiError } from "@/lib/api/respond";

interface ConfigModelFields {
  modelProvider?: ModelProviderId;
  modelIdentifier?: string;
  settings?: Partial<SmartColumnSettings>;
}

interface PreviousVersionModelFields {
  modelProvider: string;
  modelIdentifier: string;
  settings: Prisma.JsonValue | null;
}

/** Model + run-settings columns for a new SmartColumnVersion. Fields the
 * config omits inherit from `previous` (the version being edited, so a PATCH
 * that doesn't touch the model section keeps it) and otherwise fall back to
 * the catalog defaults. Settings are always stored fully resolved. */
export function versionModelData(
  config: ConfigModelFields,
  previous?: PreviousVersionModelFields | null,
): { modelProvider: string; modelIdentifier: string; settings: Prisma.InputJsonValue } {
  const providerChanged = config.modelProvider !== undefined && config.modelProvider !== previous?.modelProvider;
  const modelProvider = config.modelProvider ?? previous?.modelProvider ?? DEFAULT_MODEL_PROVIDER;
  // Switching provider without naming a model must not carry over a model
  // id that only exists on the old provider.
  const modelIdentifier =
    config.modelIdentifier ??
    (providerChanged ? undefined : previous?.modelIdentifier) ??
    (modelProvider === DEFAULT_MODEL_PROVIDER ? DEFAULT_MODEL_IDENTIFIER : undefined);
  if (!modelIdentifier) {
    throw new ApiError(422, `modelIdentifier is required for provider "${modelProvider}".`);
  }
  const base = resolveSettings(previous?.settings ?? null);
  const overrides = Object.fromEntries(Object.entries(config.settings ?? {}).filter(([, v]) => v !== undefined));
  const settings: SmartColumnSettings = { ...base, ...overrides };
  return { modelProvider, modelIdentifier, settings: settings as unknown as Prisma.InputJsonValue };
}
