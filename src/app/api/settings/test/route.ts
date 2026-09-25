import { NextResponse } from "next/server";
import { z } from "zod";
import { checkLaya, checkTypeSafe } from "@/lib/settings/connections";
import { withErrorHandling } from "@/lib/api/respond";

const schema = z.object({ provider: z.enum(["typesafe", "laya"]) });

// Checks the currently effective credentials for one provider.
export const POST = withErrorHandling(async (req: Request) => {
  const { provider } = schema.parse(await req.json());
  const status = provider === "typesafe" ? await checkTypeSafe() : await checkLaya();
  return NextResponse.json({ status });
});
