import { NextResponse } from "next/server";
import { JEV_MODELS, LAYA_MODELS, type ModelProviderInfo } from "@/lib/decision-models/catalog";
import { getSetting } from "@/lib/settings";
import { checkLaya } from "@/lib/settings/connections";
import { withErrorHandling } from "@/lib/api/respond";

async function typesafeProvider(): Promise<ModelProviderInfo> {
  const available = Boolean(await getSetting("TYPESAFE_API_KEY"));
  const unavailableReason = available ? undefined : "Add your TypeSafe API key on the Settings page to enable Jev.";
  return {
    id: "typesafe",
    name: "TypeSafe",
    tagline: "Calibrated System One decision models (Jev).",
    available,
    unavailableReason,
    models: JEV_MODELS.map((m) => ({ ...m, available, unavailableReason })),
  };
}

async function layaProvider(): Promise<ModelProviderInfo> {
  const base = { id: "laya" as const, name: "Laya", tagline: "Open-weights System One engine, self-hosted via laya-serve." };
  const toOptions = (available: boolean, unavailableReason?: string) =>
    LAYA_MODELS.map((m) => ({
      id: m.id,
      provider: m.provider,
      name: m.name,
      variant: m.variant,
      description: m.description,
      tags: m.tags,
      recommended: m.recommended,
      available,
      unavailableReason,
    }));

  const status = await checkLaya();
  if (!status.ok) {
    const reason =
      status.message === "No server URL set."
        ? "Add a laya-serve URL on the Settings page to enable."
        : status.message;
    return { ...base, available: false, unavailableReason: reason, models: toOptions(false, reason) };
  }
  return { ...base, available: true, models: toOptions(true) };
}

// Model picker source for the Smart Column Builder. Never includes secrets
// (API keys, base URLs) — only what the UI needs to render the selector.
export const GET = withErrorHandling(async () => {
  const providers: ModelProviderInfo[] = await Promise.all([typesafeProvider(), layaProvider()]);
  return NextResponse.json({ providers });
});
