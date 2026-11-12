import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Worker } from "bullmq";
import * as XLSX from "xlsx";
import type { DecisionResult } from "@/lib/decision-models/types";
import type { WorkbenchResponse } from "@/types/workbench";

// Only inference is replaced. Routes, persistence, Redis, the worker,
// prediction/review provenance, and XLSX serialization are real.
const inference = vi.hoisted(() => ({ decide: vi.fn<() => Promise<DecisionResult>>() }));
vi.mock("@/lib/decision-models", async (original) => ({
  ...await original<typeof import("@/lib/decision-models")>(),
  getDecisionModel: () => ({ binaryDecision: inference.decide, categoricalDecision: inference.decide, ordinalDecision: inference.decide }),
}));

import { prisma } from "@/lib/prisma";
import { getDefaultUserId } from "@/lib/current-user";
import { POST as upload } from "@/app/api/uploads/route";
import { POST as confirmImport } from "@/app/api/datasets/route";
import { POST as createColumn } from "@/app/api/smart-columns/route";
import { POST as preview } from "@/app/api/smart-columns/preview/route";
import { POST as generate } from "@/app/api/smart-columns/[id]/generate/route";
import { POST as retry } from "@/app/api/smart-columns/[id]/retry/route";
import { PATCH as cancel } from "@/app/api/jobs/[id]/route";
import { POST as review } from "@/app/api/reviews/route";
import { GET as workbench } from "@/app/api/datasets/[id]/workbench/route";
import { POST as exportXlsx } from "@/app/api/exports/xlsx/route";
import { buildExportRows } from "@/lib/export/build-rows";
import { runGenerationJob } from "@/lib/smart-columns/generate";
import { SMART_COLUMN_QUEUE, getSmartColumnQueue, type SmartColumnJobData } from "@/lib/queue/smart-column-queue";
import { createRedisConnection } from "@/lib/queue/connection";

const req = (body: unknown, method = "POST") => new Request("http://127.0.0.1/api/test", {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const success: DecisionResult = {
  status: "success", kind: "choice", provider: "typesafe", model: "test", modelVersion: "test-v1",
  predictedLabel: "yes", confidence: 0.2, probabilities: { yes: 0.6, no: 0.4 },
};
const config = {
  name: "Needs review", type: "BINARY", question: "Does this record need attention?",
  sourceColumns: ["Title"], labels: { yes: "Needs attention", no: "No attention" },
  settings: { concurrency: 1, maxRetries: 0 },
};

let workspaceId: string;
let worker: Worker<SmartColumnJobData>;
let connection: ReturnType<typeof createRedisConnection>;
let safeToCleanUp = false;

beforeAll(async () => {
  // Refuse to run against a normal development database or queue.
  if (!new URL(process.env.DATABASE_URL ?? "").pathname.endsWith("_test")) throw new Error("Use a dedicated database ending in _test.");
  if (new URL(process.env.REDIS_URL ?? "").pathname !== "/15") throw new Error("Use Redis database /15 for integration tests.");
  if (!process.env.LOCAL_STORAGE_DIR?.includes("intelligixl-test")) throw new Error("Use an intelligixl-test storage directory.");
  safeToCleanUp = true;
  const ownerId = await getDefaultUserId();
  const workspace = await prisma.workspace.create({ data: { name: `Integration ${randomUUID()}`, ownerId } });
  workspaceId = workspace.id;
  await getSmartColumnQueue().obliterate({ force: true });
  connection = createRedisConnection();
  worker = new Worker<SmartColumnJobData>(SMART_COLUMN_QUEUE, (job) => runGenerationJob(job.data.jobId), {
    connection, autorun: false, concurrency: 1,
  });
  await worker.waitUntilReady();
});

afterAll(async () => {
  if (!safeToCleanUp) return;
  if (worker) await worker.close();
  if (connection) await connection.quit();
  const queue = getSmartColumnQueue();
  await queue.obliterate({ force: true });
  await queue.close();
  const queueConnection = queue.opts.connection as ReturnType<typeof createRedisConnection>;
  await queueConnection.quit();
  if (workspaceId) {
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await rm(path.join(process.env.LOCAL_STORAGE_DIR!, "datasets", workspaceId), { recursive: true, force: true });
  }
  await prisma.$disconnect();
});

async function fixture() {
  const form = new FormData();
  form.set("workspaceId", workspaceId);
  form.set("file", new File(['Title,Count\nFirst example,1\nSecond example,2'], "examples.csv", { type: "text/csv" }));
  const stagedResponse = await upload(new Request("http://127.0.0.1/api/uploads", { method: "POST", body: form }));
  expect(stagedResponse.status).toBe(200);
  const staged = await stagedResponse.json();
  expect(staged.rowCount).toBe(2);
  const imported = await confirmImport(req({ ...staged, workspaceId }));
  expect(imported.status).toBe(201);
  const { dataset } = await imported.json();
  const created = await createColumn(req({ workspaceId, datasetId: dataset.id, config }));
  expect(created.status).toBe(201);
  const { smartColumn } = await created.json();
  return { dataset, smartColumn };
}

async function waitForJob(id: string, status: string) {
  await vi.waitFor(async () => {
    const job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe(status);
  }, { timeout: 15_000, interval: 30 });
}

describe("local annotation workflow", () => {
  it("imports, previews, runs the real queue, retries only failures, and exports human corrections separately", async () => {
    const { dataset, smartColumn } = await fixture();
    inference.decide.mockResolvedValue(success);
    const sampled = await preview(req({ datasetId: dataset.id, config, sampleMode: "first" }));
    expect(sampled.status).toBe(200);
    expect((await sampled.json()).results).toHaveLength(2);
    expect(await prisma.prediction.count({ where: { smartColumnVersionId: smartColumn.activeVersionId } })).toBe(0);

    inference.decide.mockReset().mockResolvedValueOnce(success).mockResolvedValueOnce({ status: "failed", reason: "TIMEOUT", message: "Fixture timeout" });
    const submitted = await generate(req({}), params(smartColumn.id));
    expect(submitted.status).toBe(202);
    const { job } = await submitted.json();
    // A second submission must not duplicate paid inference work.
    expect((await generate(req({}), params(smartColumn.id))).status).toBe(409);
    void worker.run();
    await waitForJob(job.id, "COMPLETED");
    const first = await prisma.prediction.findMany({ where: { smartColumnVersionId: smartColumn.activeVersionId } });
    expect(first.filter((p) => p.status === "FAILED")).toHaveLength(1);
    const preserved = first.find((p) => p.status === "SUCCESS")!;

    inference.decide.mockReset().mockResolvedValue(success);
    const resubmitted = await retry(req({}), params(smartColumn.id));
    expect(resubmitted.status).toBe(202);
    const retryJob = (await resubmitted.json()).job;
    await waitForJob(retryJob.id, "COMPLETED");
    expect(inference.decide).toHaveBeenCalledTimes(1);
    expect((await prisma.prediction.findUniqueOrThrow({ where: { id: preserved.id } })).jobId).toBe(job.id);
    expect((await retry(req({}), params(smartColumn.id))).status).toBe(409);

    const reviewed = await review(req({ predictionId: preserved.id, status: "CORRECTED", reviewedValue: "no" }));
    expect(reviewed.status).toBe(200);
    const snapshotResponse = await workbench(new Request("http://127.0.0.1/api/workbench"), params(dataset.id));
    const snapshot = await snapshotResponse.json() as WorkbenchResponse;
    const original = snapshot.predictions.find((p) => p.id === preserved.id)!;
    expect(original.predictedLabel).toBe("yes");
    expect(original.review?.reviewedValue).toBe("no");
    const byRow = new Map(snapshot.rows.map((row) => [row.id, new Map(snapshot.predictions
      .filter((p) => p.datasetRowId === row.id).map((p) => [smartColumn.id, p]))]));
    const rows = buildExportRows(snapshot.rows, snapshot.smartColumns, byRow, {
      includeConfidence: true, includeReviewedValue: true, includeProbabilities: true,
    });
    const exported = await exportXlsx(req({ rows, filename: "reviewed.xlsx" }));
    expect(exported.status).toBe(200);
    const wb = XLSX.read(Buffer.from(await exported.arrayBuffer()), { type: "buffer" });
    const roundTrip = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Data);
    expect(roundTrip).toHaveLength(2);
    const corrected = roundTrip.find((row) => row["Needs review (reviewed)"] === "no")!;
    expect(corrected["Needs review"]).toBe("yes");
    expect(JSON.parse(String(corrected["Needs review (probabilities)"]))).toEqual({ yes: 0.6, no: 0.4 });
  });

  it("does not run inference for a cancelled queued job", async () => {
    await worker.pause();
    const { smartColumn } = await fixture();
    inference.decide.mockClear();
    const response = await generate(req({}), params(smartColumn.id));
    const { job } = await response.json();
    expect((await cancel(req({ status: "CANCELLED" }, "PATCH"), params(job.id))).status).toBe(200);
    await runGenerationJob(job.id);
    expect(inference.decide).not.toHaveBeenCalled();
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("CANCELLED");
    expect(await prisma.prediction.count({ where: { smartColumnVersionId: smartColumn.activeVersionId } })).toBe(0);
  });

  it("stops scheduling further rows when an in-flight job is cancelled", async () => {
    const { smartColumn } = await fixture();
    const response = await generate(req({}), params(smartColumn.id));
    const { job } = await response.json();
    inference.decide.mockReset().mockImplementation(async () => {
      expect((await cancel(req({ status: "CANCELLED" }, "PATCH"), params(job.id))).status).toBe(200);
      return success;
    });
    await runGenerationJob(job.id);
    expect(inference.decide).toHaveBeenCalledTimes(1);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("CANCELLED");
    expect(await prisma.prediction.count({ where: { smartColumnVersionId: smartColumn.activeVersionId } })).toBe(1);
  });

  it("rejects a staged file from another workspace", async () => {
    const response = await confirmImport(req({
      workspaceId, storageKey: "datasets/another-workspace/private.csv", filename: "private.csv", format: "CSV",
      columns: [{ name: "Title", dataType: "STRING" }],
    }));
    expect(response.status).toBe(422);
  });

  it("rejects oversized uploads before parsing or storing them", async () => {
    const form = new FormData();
    form.set("workspaceId", workspaceId);
    form.set("file", new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.csv"));
    const response = await upload(new Request("http://127.0.0.1/api/uploads", { method: "POST", body: form }));
    expect(response.status).toBe(413);
  });
});
