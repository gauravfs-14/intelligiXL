import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withErrorHandling, notFound } from "@/lib/api/respond";
import { logActivity } from "@/lib/activity/log";

type Params = { params: Promise<{ id: string }> };

// Fired when a template is applied to a Smart Column builder — powers the
// "Used N×" count shown in the Templates gallery.
// Built-in recipes have no workspace, so the caller says which one used it.
const bodySchema = z.object({ workspaceId: z.string().min(1).optional() });

export const POST = withErrorHandling(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const body = bodySchema.parse(await req.json().catch(() => ({})));
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) notFound("Template");
  const updated = await prisma.template.update({ where: { id }, data: { usageCount: { increment: 1 } } });
  const workspaceId = body.workspaceId ?? template.workspaceId;
  if (workspaceId) {
    await logActivity({
      workspaceId,
      category: "templates",
      action: "template.applied",
      summary: `Applied ${template.isBuiltIn ? "recipe" : "template"} “${template.name}” to a new Smart Column`,
      metadata: { templateId: id },
    });
  }
  return NextResponse.json({ template: updated });
});
