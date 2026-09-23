import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { withErrorHandling, ApiError } from "@/lib/api/respond";

// §11 — research/study telemetry. Deliberately small and structured: the
// payload must never carry raw dataset text, only counts/ids/labels, so we
// cap its size rather than trying to sniff for "sensitive" content.
const MAX_PAYLOAD_CHARS = 2000;

const eventSchema = z.object({
  workspaceId: z.string().min(1),
  eventType: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = eventSchema.parse(await req.json());
  if (JSON.stringify(body.payload).length > MAX_PAYLOAD_CHARS) {
    throw new ApiError(422, "Event payload is too large — telemetry should carry structured metadata, not raw text.");
  }
  await prisma.studyEvent.create({
    data: { workspaceId: body.workspaceId, eventType: body.eventType, payload: body.payload as Prisma.InputJsonValue },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});
