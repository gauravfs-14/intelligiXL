import { redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUserId } from "@/lib/current-user";

export default async function RootPage() {
  // Request-time only: without this, `next build` prerenders the page, which
  // needs a database at build time and bakes in a fixed redirect.
  await connection();
  const ownerId = await getDefaultUserId();
  const workspaces = await prisma.workspace.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" } });

  if (workspaces.length === 0) {
    const created = await prisma.workspace.create({ data: { ownerId, name: "My Workspace" } });
    redirect(`/w/${created.id}`);
  }

  if (workspaces.length === 1) {
    redirect(`/w/${workspaces[0].id}`);
  }

  redirect("/workspaces");
}
