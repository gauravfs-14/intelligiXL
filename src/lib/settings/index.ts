import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "./crypto";
import { SETTING_DEFINITIONS, type SettingKey, type SettingState } from "./definitions";

/** Resolves app settings: environment variable first, then the value saved
 * from the Settings page. Reads are cached briefly so a generation run
 * doesn't hit the DB per row; the TTL also lets the separate worker process
 * pick up changes made in the web app. */

const TTL_MS = 5_000;
let cache: { at: number; values: Map<SettingKey, { value: string | null; unreadable: boolean }> } | null = null;

function fromEnv(key: SettingKey): string | null {
  const v = process.env[key]?.trim();
  return v ? v : null;
}

function isSecret(key: SettingKey): boolean {
  return SETTING_DEFINITIONS.find((d) => d.key === key)?.secret ?? true;
}

async function loadStored(): Promise<Map<SettingKey, { value: string | null; unreadable: boolean }>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const rows = await prisma.appSetting.findMany();
  const values = new Map<SettingKey, { value: string | null; unreadable: boolean }>();
  for (const row of rows) {
    const value = row.encrypted ? decrypt(row.value) : row.value;
    values.set(row.key as SettingKey, { value, unreadable: value === null });
  }
  cache = { at: Date.now(), values };
  return values;
}

export function invalidateSettingsCache() {
  cache = null;
}

/** The effective value for a setting, or null when unset. */
export async function getSetting(key: SettingKey): Promise<string | null> {
  const env = fromEnv(key);
  if (env) return env;
  return (await loadStored()).get(key)?.value ?? null;
}

export async function setSetting(key: SettingKey, value: string | null): Promise<void> {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    await prisma.appSetting.deleteMany({ where: { key } });
  } else {
    const secret = isSecret(key);
    const stored = secret ? encrypt(trimmed) : trimmed;
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: stored, encrypted: secret },
      update: { value: stored, encrypted: secret },
    });
  }
  invalidateSettingsCache();
}

export function isEnvManaged(key: SettingKey): boolean {
  return fromEnv(key) !== null;
}

function mask(value: string): string {
  return `••••${value.slice(-4)}`;
}

/** Public view of every setting — never includes secret values. */
export async function listSettingStates(): Promise<SettingState[]> {
  const stored = await loadStored();
  return SETTING_DEFINITIONS.map((d) => {
    const env = fromEnv(d.key);
    const saved = stored.get(d.key);
    const value = env ?? saved?.value ?? null;
    return {
      key: d.key,
      source: env ? "env" : saved ? "db" : "unset",
      value: d.secret ? null : value,
      hint: d.secret && value ? mask(value) : null,
      unreadable: !env && saved?.unreadable ? true : undefined,
    };
  });
}
