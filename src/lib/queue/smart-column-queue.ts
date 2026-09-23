import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";

export const SMART_COLUMN_QUEUE = "smart-column-generation";

export interface SmartColumnJobData {
  jobId: string;
}

let queue: Queue<SmartColumnJobData> | null = null;

/** Lazily constructed so importing this module doesn't open a Redis
 * connection at build time / in environments without Redis configured. */
export function getSmartColumnQueue(): Queue<SmartColumnJobData> {
  if (!queue) {
    queue = new Queue<SmartColumnJobData>(SMART_COLUMN_QUEUE, { connection: createRedisConnection() });
  }
  return queue;
}
