import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { resolveActivitySettings, type ActivityCategory } from "./categories";

export * from "./categories";

type Db = Prisma.TransactionClient | typeof prisma;

export interface ActivityEntry {
  workspaceId: string;
  category: ActivityCategory;
  /** Machine-readable verb, e.g. "dataset.renamed". */
  action: string;
  /** What the Activity page shows — a complete sentence fragment. */
  summary: string;
  dataset?: { id: string; name: string } | null;
  /** Small structured detail (ids, counts, before/after). */
  metadata?: Record<string, unknown>;
  /** Record even if the category is turned off — only for changes to the
   * logging settings themselves, so turning logging off leaves a trace. */
  always?: boolean;
}

/** Records one user action in the workspace's activity log, unless the
 * workspace has turned that category off.
 *
 * Pass `db` = the surrounding transaction when the action itself runs in one,
 * so the entry commits (or rolls back) with it. Outside a transaction a
 * logging failure is swallowed: the action already succeeded and the user
 * shouldn't see an error for it. */
export async function logActivity(entry: ActivityEntry, db?: Db): Promise<void> {
  const write = async (client: Db) => {
    const workspace = await client.workspace.findUnique({ where: { id: entry.workspaceId }, select: { activitySettings: true } });
    if (!workspace) return;
    if (!entry.always && !resolveActivitySettings(workspace.activitySettings)[entry.category]) return;
    await client.activityLog.create({
      data: {
        workspaceId: entry.workspaceId,
        category: entry.category,
        action: entry.action,
        summary: entry.summary,
        datasetId: entry.dataset?.id ?? null,
        datasetName: entry.dataset?.name ?? null,
        metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  };

  if (db) return write(db);
  try {
    await write(prisma);
  } catch (err) {
    console.error("[activity] failed to record", entry.action, err);
  }
}

/** The workspace + display name for a dataset, for routes that only have its id. */
export async function datasetRef(datasetId: string, db: Db = prisma) {
  const d = await db.dataset.findUnique({ where: { id: datasetId }, select: { id: true, filename: true, workspaceId: true } });
  return d ? { workspaceId: d.workspaceId, dataset: { id: d.id, name: d.filename } } : null;
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n.toLocaleString()} ${n === 1 ? word : pluralWord}`;
}
