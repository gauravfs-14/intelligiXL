import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ReviewStatus } from "@/generated/prisma/client";
import { getDefaultUserId } from "@/lib/current-user";
import { withErrorHandling } from "@/lib/api/respond";

const upsertSchema = z.object({
  predictionId: z.string().min(1),
  status: z.nativeEnum(ReviewStatus),
  reviewedValue: z.string().nullable().optional(),
});

// FR-027/028 — records a human review decision. The AI prediction row is
// never modified; the human value lives here alongside it (§19).
export const POST = withErrorHandling(async (req: Request) => {
  const body = upsertSchema.parse(await req.json());
  const reviewerId = await getDefaultUserId();

  const review = await prisma.review.upsert({
    where: { predictionId: body.predictionId },
    create: {
      predictionId: body.predictionId,
      status: body.status,
      reviewedValue: body.reviewedValue ?? null,
      reviewerId,
    },
    update: {
      status: body.status,
      reviewedValue: body.reviewedValue ?? null,
      reviewerId,
    },
  });

  return NextResponse.json({ review });
});
