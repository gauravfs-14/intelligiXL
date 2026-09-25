import { z } from "zod";
import { SmartColumnType } from "@/generated/prisma/client";
import { SETTINGS_LIMITS } from "@/lib/decision-models/catalog";

export const binaryLabelsSchema = z.object({
  yes: z.string().nullable(),
  no: z.string().nullable(),
});

export const categoricalLabelsSchema = z
  .record(z.string().min(1), z.string().nullable())
  .refine((obj) => Object.keys(obj).length >= 2, "At least two options are required.")
  .refine((obj) => Object.keys(obj).length <= 255, "At most 255 options are supported.");

export const ratingLabelsSchema = z
  .array(z.string().min(1))
  .min(2, "At least two levels are required.")
  .max(10, "At most 10 levels are supported.");

export const modelProviderSchema = z.enum(["typesafe", "laya"]);

/** Mirrors `SmartColumnSettings` (catalog.ts). Every field is optional —
 * missing ones fall back to DEFAULT_SMART_COLUMN_SETTINGS via resolveSettings. */
export const smartColumnSettingsSchema = z
  .object({
    confidenceThreshold: z
      .number()
      .min(SETTINGS_LIMITS.confidenceThreshold.min)
      .max(SETTINGS_LIMITS.confidenceThreshold.max),
    lowConfidenceAction: z.enum(["flag", "none"]),
    concurrency: z.number().int().min(SETTINGS_LIMITS.concurrency.min).max(SETTINGS_LIMITS.concurrency.max),
    timeoutMs: z.number().int().min(SETTINGS_LIMITS.timeoutMs.min).max(SETTINGS_LIMITS.timeoutMs.max),
    maxRetries: z.number().int().min(SETTINGS_LIMITS.maxRetries.min).max(SETTINGS_LIMITS.maxRetries.max),
  })
  .partial();

export const smartColumnConfigSchema = z
  .object({
    name: z.string().min(1).max(120),
    type: z.nativeEnum(SmartColumnType),
    question: z.string().min(1, "A question is required."),
    instructions: z.string().optional(),
    sourceColumns: z.array(z.string().min(1)).min(1, "Select at least one source column."),
    unclearEnabled: z.boolean().optional(),
    labels: z.union([binaryLabelsSchema, categoricalLabelsSchema, ratingLabelsSchema]),
    modelProvider: modelProviderSchema.optional(),
    modelIdentifier: z.string().min(1).optional(),
    settings: smartColumnSettingsSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === SmartColumnType.BINARY && !binaryLabelsSchema.safeParse(val.labels).success) {
      ctx.addIssue({ code: "custom", message: "Binary Smart Columns need yes/no labels.", path: ["labels"] });
    }
    if (val.type === SmartColumnType.CATEGORICAL && !categoricalLabelsSchema.safeParse(val.labels).success) {
      ctx.addIssue({ code: "custom", message: "Categorical Smart Columns need 2-255 labeled options.", path: ["labels"] });
    }
    if (val.type === SmartColumnType.RATING && !ratingLabelsSchema.safeParse(val.labels).success) {
      ctx.addIssue({ code: "custom", message: "Rating Smart Columns need an ordered list of 2-10 levels.", path: ["labels"] });
    }
  });

export type SmartColumnConfigInput = z.infer<typeof smartColumnConfigSchema>;
