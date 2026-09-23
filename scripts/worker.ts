import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { createRedisConnection } from "../src/lib/queue/connection";
import { SMART_COLUMN_QUEUE, type SmartColumnJobData } from "../src/lib/queue/smart-column-queue";
import { runGenerationJob } from "../src/lib/smart-columns/generate";

const WORKER_CONCURRENCY = 3; // concurrent Smart Column *jobs*; each job itself fans out across rows.

const worker = new Worker<SmartColumnJobData>(
  SMART_COLUMN_QUEUE,
  async (job: Job<SmartColumnJobData>) => {
    console.log(`[worker] starting job ${job.data.jobId}`);
    await runGenerationJob(job.data.jobId);
    console.log(`[worker] finished job ${job.data.jobId}`);
  },
  { connection: createRedisConnection(), concurrency: WORKER_CONCURRENCY },
);

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.data.jobId} failed:`, err);
});

console.log("[worker] IntelligiXL Smart Column worker started, waiting for jobs…");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.log(`[worker] received ${signal}, shutting down…`);
    await worker.close();
    process.exit(0);
  });
}
