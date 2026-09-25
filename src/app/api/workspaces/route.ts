import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity/log";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getDefaultUserId } from "@/lib/current-user";
import { withErrorHandling } from "@/lib/api/respond";

export const GET = withErrorHandling(async () => {
  const ownerId = await getDefaultUserId();
  let workspaces = await prisma.workspace.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { datasets: true, smartColumns: true } } },
  });

  if (workspaces.length === 0) {
    await prisma.workspace.create({ data: { ownerId, name: "My Workspace" } });
    workspaces = await prisma.workspace.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { datasets: true, smartColumns: true } } },
    });
  }

  return NextResponse.json({ workspaces });
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const ownerId = await getDefaultUserId();
  const body = createSchema.parse(await req.json());
  const workspace = await prisma.workspace.create({
    data: { ownerId, name: body.name, description: body.description },
  });
  await logActivity({ workspaceId: workspace.id, category: "workspace", action: "workspace.created", summary: `Created workspace “${workspace.name}”` });
  return NextResponse.json({ workspace }, { status: 201 });
});
