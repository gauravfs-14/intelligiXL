import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type JobLogLevel = "info" | "success" | "warning" | "error";

export interface JobLogEntry {
  ts: string;
  level: JobLogLevel;
  message: string;
}

const MAX_ENTRIES = 300;

/** Ring-buffered, timestamped log for a single job run — kept in memory
 * while the job executes and periodically flushed to `Job.logs`, so the
 * Jobs panel's Logs tab can show a live, colored, chronological feed
 * instead of just a completed/failed count. */
export class JobLogger {
  private entries: JobLogEntry[] = [];

  add(level: JobLogLevel, message: string) {
    this.entries.push({ ts: new Date().toISOString(), level, message });
    if (this.entries.length > MAX_ENTRIES) this.entries = this.entries.slice(-MAX_ENTRIES);
  }

  toJson(): Prisma.InputJsonValue {
    return this.entries as unknown as Prisma.InputJsonValue;
  }

  async flush(jobId: string) {
    await prisma.job.update({ where: { id: jobId }, data: { logs: this.toJson() } });
  }
}
