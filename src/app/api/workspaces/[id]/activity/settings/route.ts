import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, notFound } from "@/lib/api/respond";
import { ACTIVITY_CATEGORIES, ACTIVITY_CATEGORY_IDS, logActivity, resolveActivitySettings } from "@/lib/activity/log";

type Params = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { activitySettings: true } });
  if (!workspace) notFound("Workspace");
  return NextResponse.json({ settings: resolveActivitySettings(workspace.activitySettings) });
});

const putSchema = z.object({
  settings: z.partialRecord(z.enum(ACTIVITY_CATEGORY_IDS as [string, ...string[]]), z.boolean()),
});

// Merges the given categories into the workspace's logging settings. The
// change itself is always recorded, even when it turns categories off.
export const PUT = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const body = putSchema.parse(await req.json());
  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { activitySettings: true } });
  if (!workspace) notFound("Workspace");

  const before = resolveActivitySettings(workspace.activitySettings);
  const after = { ...before, ...body.settings };
  await prisma.workspace.update({ where: { id }, data: { activitySettings: after } });

  const label = (cat: string) => ACTIVITY_CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
  const changed = ACTIVITY_CATEGORY_IDS.filter((c) => before[c] !== after[c]);
  if (changed.length > 0) {
    const on = changed.filter((c) => after[c]).map(label);
    const off = changed.filter((c) => !after[c]).map(label);
    const parts = [on.length && `turned on ${on.join(", ")}`, off.length && `turned off ${off.join(", ")}`].filter(Boolean);
    await logActivity({
      workspaceId: id,
      category: "workspace",
      action: "activity.settingsChanged",
      summary: `Activity logging: ${parts.join("; ")}`,
      metadata: { on: changed.filter((c) => after[c]), off: changed.filter((c) => !after[c]) },
      always: true,
    });
  }

  return NextResponse.json({ settings: after });
});
