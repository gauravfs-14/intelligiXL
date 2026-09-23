import { SmartColumnType } from "@/generated/prisma/client";
import type { SmartColumnConfig } from "@/types/smart-column";

interface BuiltInRecipe {
  name: string;
  description: string;
  config: SmartColumnConfig;
}

/** FR-043 — predefined Column Recipes shown in the Templates gallery so a
 * new user has a working starting point instead of a blank builder. */
export const BUILT_IN_RECIPES: BuiltInRecipe[] = [
  {
    name: "Is this urgent?",
    description: "Flags records that convey time-sensitive urgency.",
    config: {
      name: "Is Urgent",
      type: SmartColumnType.BINARY,
      question: "Does this convey urgency that requires a fast response?",
      instructions: "",
      labels: { yes: "Explicitly time-sensitive or escalated", no: "No urgency expressed" },
      sourceColumns: ["text", "description", "body", "message"],
    },
  },
  {
    name: "Customer sentiment",
    description: "Classifies the overall sentiment expressed in free text.",
    config: {
      name: "Sentiment",
      type: SmartColumnType.CATEGORICAL,
      question: "What is the overall sentiment expressed?",
      instructions: "",
      labels: { positive: null, neutral: null, negative: null },
      sourceColumns: ["review", "comment", "feedback", "text"],
    },
  },
  {
    name: "Support ticket department",
    description: "Routes a support ticket to the team best suited to handle it.",
    config: {
      name: "Department",
      type: SmartColumnType.CATEGORICAL,
      question: "Which team should handle this ticket?",
      instructions: "",
      labels: {
        billing: "Payments, invoicing, refunds",
        technical: "Bugs, outages, integrations",
        sales: "Pricing, upgrades, new accounts",
        other: null,
      },
      sourceColumns: ["subject", "ticket_text", "description"],
    },
  },
  {
    name: "Crash / incident type",
    description: "Classifies the primary cause described in an incident report.",
    config: {
      name: "Crash Type",
      type: SmartColumnType.CATEGORICAL,
      question: "What was the primary type of crash or incident described?",
      instructions: "",
      labels: {
        motor_vehicle: "Involves a car, truck, van, or motorcycle",
        single_scooter: "Involves only a scooter or bicycle, no other vehicle",
        pedestrian: "A pedestrian was struck",
        other: null,
      },
      sourceColumns: ["title", "narrative", "description"],
    },
  },
  {
    name: "Severity rating",
    description: "Rates the severity described in a report on an ordered scale.",
    config: {
      name: "Severity",
      type: SmartColumnType.RATING,
      question: "How severe is the outcome described?",
      instructions: "",
      labels: ["None", "Low", "Moderate", "High", "Very High"],
      sourceColumns: ["description", "narrative", "notes"],
    },
  },
  {
    name: "Customer frustration level",
    description: "Rates how frustrated the customer sounds, on an ordered scale.",
    config: {
      name: "Frustration",
      type: SmartColumnType.RATING,
      question: "How frustrated does the customer sound?",
      instructions: "",
      labels: ["Calm", "Mildly annoyed", "Frustrated", "Very angry"],
      sourceColumns: ["message", "transcript", "text"],
    },
  },
];
