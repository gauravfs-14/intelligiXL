import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity/log";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { BUILT_IN_RECIPES } from "@/lib/templates/recipes";
import { withErrorHandling, ApiError } from "@/lib/api/respond";

// FR-042/043 — built-in recipes + workspace-saved templates. Built-ins are
// seeded lazily here so the gallery works even if `pnpm db:seed` was never run.
export const GET = withErrorHandling(async (req: Request) => {
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) throw new ApiError(422, "workspaceId is required.");

  const existingBuiltIns = await prisma.template.findMany({ where: { isBuiltIn: true } });
  const byName = new Map(existingBuiltIns.map((t) => [t.name, t]));
  // Built-ins retired from the recipe source (e.g. renamed) shouldn't linger
  // in the gallery. Workspace-saved templates are never touched.
  const recipeNames = new Set(BUILT_IN_RECIPES.map((r) => r.name));
  const retired = existingBuiltIns.filter((t) => !recipeNames.has(t.name)).map((t) => t.id);
  if (retired.length) await prisma.template.deleteMany({ where: { id: { in: retired }, isBuiltIn: true } });
  for (const r of BUILT_IN_RECIPES) {
    const found = byName.get(r.name);
    const data = {
      description: r.description,
      category: r.category,
      tags: r.tags,
      config: r.config as unknown as Prisma.InputJsonValue,
    };
    if (!found) {
      await prisma.template.create({ data: { ...data, name: r.name, isBuiltIn: true } });
    } else if (found.category !== r.category || found.description !== r.description) {
      // Keep seeded built-ins in sync with recipe source (category/tags added later, etc.).
      await prisma.template.update({ where: { id: found.id }, data });
    }
  }

  const templates = await prisma.template.findMany({
    where: { OR: [{ isBuiltIn: true }, { workspaceId }] },
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ templates });
});

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  config: z.record(z.string(), z.unknown()),
});

// FR-042 — save a Smart Column's current configuration as a reusable template.
export const POST = withErrorHandling(async (req: Request) => {
  const body = createSchema.parse(await req.json());
  const template = await prisma.template.create({
    data: {
      workspaceId: body.workspaceId,
      name: body.name,
      description: body.description,
      config: body.config as Prisma.InputJsonValue,
      isBuiltIn: false,
      category: "Custom",
    },
  });
  await logActivity({
    workspaceId: body.workspaceId,
    category: "templates",
    action: "template.created",
    summary: `Saved template “${body.name}”`,
    metadata: { templateId: template.id },
  });
  return NextResponse.json({ template }, { status: 201 });
});
