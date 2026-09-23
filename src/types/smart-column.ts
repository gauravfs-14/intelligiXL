import type { SmartColumnType } from "@/generated/prisma/browser";
import type { BinaryLabels, CategoricalLabels, RatingLabels } from "@/lib/decision-models/types";

export type SmartColumnLabels = BinaryLabels | CategoricalLabels | RatingLabels;

/** The reproducible definition of a Smart Column — this shape is what gets
 * versioned (FR-040), saved as a Template (FR-042), and exported as
 * configuration JSON for reproducibility (FR-039). */
export interface SmartColumnConfig {
  name: string;
  type: SmartColumnType;
  question: string;
  instructions?: string;
  labels: SmartColumnLabels;
  sourceColumns: string[];
  unclearEnabled?: boolean;
}
