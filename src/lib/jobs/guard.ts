import { prisma } from "@/lib/prisma";
import { JobStatus, type Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api/respond";

/** Deleting data out from under a queued/running generation job makes the
 * worker write predictions for rows that no longer exist. Callers delete
 * only after this passes; the user cancels the job first. */
export async function assertNoActiveJobs(where: Prisma.JobWhereInput, what: string): Promise<void> {
  const active = await prisma.job.findFirst({
    where: { ...where, status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } },
    select: { id: true },
  });
  if (active) {
    throw new ApiError(409, `A generation job is still running on this ${what}. Cancel it in the Jobs panel, then delete.`, [active.id]);
  }
}
