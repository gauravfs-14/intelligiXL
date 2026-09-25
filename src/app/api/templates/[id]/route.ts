import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity/log";
import { prisma } from "@/lib/prisma";
import { ApiError, withErrorHandling, notFound } from "@/lib/api/respond";

type Params = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) notFound("Template");
  if (template.isBuiltIn) throw new ApiError(403, "Built-in recipes can't be deleted.");
  await prisma.template.delete({ where: { id } });
  if (template.workspaceId) {
    await logActivity({
      workspaceId: template.workspaceId,
      category: "templates",
      action: "template.deleted",
      summary: `Deleted template “${template.name}”`,
      metadata: { templateId: id },
    });
  }
  return NextResponse.json({ ok: true });
});
