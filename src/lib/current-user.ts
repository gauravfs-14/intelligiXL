import { prisma } from "@/lib/prisma";

const DEFAULT_USER_EMAIL = "local@intelligixl.dev";

let cachedId: string | null = null;

/** Auth is out of scope for this build (see project decision) — there is a
 * single local user, lazily created, so ownership / reviewer FKs stay
 * meaningful for provenance (NFR-014) without gating access on anything. */
export async function getDefaultUserId(): Promise<string> {
  if (cachedId) return cachedId;
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: { email: DEFAULT_USER_EMAIL, name: "Local Researcher" },
  });
  cachedId = user.id;
  return user.id;
}
