import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
  var __prismaCtor: typeof PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// In dev the client is cached on globalThis to survive hot reloads — but a
// `prisma generate` (new migration) reloads the generated module, and the
// cached client would silently lack the new models. Rebuild when the class
// itself changed.
const cached = globalThis.__prismaCtor === PrismaClient ? globalThis.__prisma : undefined;
if (!cached && globalThis.__prisma) void globalThis.__prisma.$disconnect().catch(() => undefined);

export const prisma = cached ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
  globalThis.__prismaCtor = PrismaClient;
}
