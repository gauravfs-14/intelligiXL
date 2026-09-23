import { NextResponse } from "next/server";
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

  const builtInCount = await prisma.template.count({ where: { isBuiltIn: true } });
  if (builtInCount === 0) {
    await prisma.template.createMany({
      data: BUILT_IN_RECIPES.map((r) => ({
        name: r.name,
        description: r.description,
        config: r.config as unknown as Prisma.InputJsonValue,
        isBuiltIn: true,
      })),
    });
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
    },
  });
  return NextResponse.json({ template }, { status: 201 });
});
