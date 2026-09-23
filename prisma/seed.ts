import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { BUILT_IN_RECIPES } from "../src/lib/templates/recipes";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "local@intelligixl.dev" },
    update: {},
    create: {
      email: "local@intelligixl.dev",
      name: "Local Researcher",
    },
  });

  const existing = await prisma.workspace.findFirst({ where: { ownerId: user.id } });
  if (!existing) {
    await prisma.workspace.create({
      data: {
        ownerId: user.id,
        name: "My Workspace",
        description: "Default workspace",
      },
    });
  }

  for (const recipe of BUILT_IN_RECIPES) {
    const found = await prisma.template.findFirst({
      where: { isBuiltIn: true, name: recipe.name },
    });
    if (!found) {
      await prisma.template.create({
        data: {
          name: recipe.name,
          description: recipe.description,
          config: recipe.config as unknown as Prisma.InputJsonValue,
          isBuiltIn: true,
          workspaceId: null,
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
