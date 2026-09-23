import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/generated/prisma/browser";

const TONE: Record<JobStatus, "muted" | "primary" | "success" | "danger" | "warning"> = {
  QUEUED: "muted",
  RUNNING: "primary",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "warning",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={TONE[status]}>{status}</Badge>;
}
