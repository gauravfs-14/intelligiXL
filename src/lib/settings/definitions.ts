/** Client-safe list of settings editable on the Settings page. Each key is
 * also the environment variable that overrides it. */

export type SettingKey = "TYPESAFE_API_KEY" | "LAYA_BASE_URL" | "LAYA_API_KEY";

export interface SettingDefinition {
  key: SettingKey;
  label: string;
  description: string;
  secret: boolean;
  placeholder: string;
  group: "typesafe" | "laya";
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: "TYPESAFE_API_KEY",
    label: "API key",
    description: "Used for every Jev request. Create one at console.typesafe.ai.",
    secret: true,
    placeholder: "Paste your TypeSafe API key",
    group: "typesafe",
  },
  {
    key: "LAYA_BASE_URL",
    label: "Server URL",
    description: "Base URL of a running laya-serve, without /v1/systemone.",
    secret: false,
    placeholder: "http://localhost:8000",
    group: "laya",
  },
  {
    key: "LAYA_API_KEY",
    label: "API key (optional)",
    description: "Only if laya-serve was started with LAYA_API_KEY.",
    secret: true,
    placeholder: "Leave empty for an unauthenticated server",
    group: "laya",
  },
];

export const SETTING_KEYS = SETTING_DEFINITIONS.map((d) => d.key);

/** What the API returns per setting. Secret values are never included —
 * only a masked hint. */
export interface SettingState {
  key: SettingKey;
  source: "env" | "db" | "unset";
  /** Non-secret values only. */
  value: string | null;
  /** Secret values: e.g. "••••3f9a". */
  hint: string | null;
  /** Stored but can't be decrypted (APP_SECRET / .data/app-secret changed). */
  unreadable?: boolean;
}

export interface ConnectionStatus {
  provider: "typesafe" | "laya";
  ok: boolean;
  message: string;
}
