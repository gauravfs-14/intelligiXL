import { NextResponse } from "next/server";
import { z } from "zod";
import { isEnvManaged, listSettingStates, setSetting } from "@/lib/settings";
import { SETTING_KEYS, type SettingKey } from "@/lib/settings/definitions";
import { ApiError, withErrorHandling } from "@/lib/api/respond";

// App-wide settings (API keys, provider URLs). Secret values are write-only:
// GET returns a masked hint, never the value.
export const GET = withErrorHandling(async () => {
  return NextResponse.json({ settings: await listSettingStates() });
});

const updateSchema = z.object({
  key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]),
  // null or "" clears the saved value.
  value: z.string().max(2048).nullable(),
});

export const PUT = withErrorHandling(async (req: Request) => {
  const { key, value } = updateSchema.parse(await req.json());
  if (isEnvManaged(key)) {
    throw new ApiError(409, `${key} is set as an environment variable, which takes precedence. Change it there instead.`);
  }
  if (key === "LAYA_BASE_URL" && value?.trim()) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new ApiError(422, "Enter a full URL, e.g. http://localhost:8000.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new ApiError(422, "The URL must start with http:// or https://.");
  }
  await setSetting(key, value);
  return NextResponse.json({ settings: await listSettingStates() });
});
