import { SmartColumnType } from "@/generated/prisma/browser";
import type { SmartColumnConfig } from "@/types/smart-column";

export type RecipeIcon = "zap" | "smile" | "route" | "tags" | "gauge" | "frown";

interface BuiltInRecipe {
  name: string;
  description: string;
  category: string;
  tags: string[];
  icon: RecipeIcon;
  config: SmartColumnConfig;
}

/** FR-043 — predefined Column Recipes shown in the Templates gallery so a
 * new user has a working starting point instead of a blank builder. */
export const BUILT_IN_RECIPES: BuiltInRecipe[] = [
  {
    name: "Is this urgent?",
    icon: "zap",
    description: "Flags records that convey time-sensitive urgency.",
    category: "Classification",
    tags: ["Binary", "Support", "Triage"],
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
    icon: "smile",
    description: "Classifies the overall sentiment expressed in free text.",
    category: "Classification",
    tags: ["NLP", "Sentiment", "CX"],
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
    icon: "route",
    description: "Routes a support ticket to the team best suited to handle it.",
    category: "Classification",
    tags: ["Routing", "Support", "Ops"],
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
    name: "Content type",
    icon: "tags",
    description: "Sorts free-text entries into what kind of message they are.",
    category: "Classification",
    tags: ["Text", "Triage", "General"],
    config: {
      name: "Content Type",
      type: SmartColumnType.CATEGORICAL,
      question: "What kind of message is this?",
      instructions: "",
      labels: {
        question: "Asks for information or help",
        complaint: "Reports a problem or expresses dissatisfaction",
        request: "Asks for something to be done or changed",
        feedback: "Shares an opinion, idea or praise",
        other: null,
      },
      sourceColumns: ["text", "message", "description", "body"],
    },
  },
  {
    name: "Priority level",
    icon: "gauge",
    description: "Rates how much attention an item needs, on an ordered scale.",
    category: "Scoring",
    tags: ["Rating", "Ops", "Triage"],
    config: {
      name: "Priority",
      type: SmartColumnType.RATING,
      question: "How much priority should this item get?",
      instructions: "",
      labels: ["Can wait", "Low", "Medium", "High", "Drop everything"],
      sourceColumns: ["description", "text", "notes"],
    },
  },
  {
    name: "Customer frustration level",
    icon: "frown",
    description: "Rates how frustrated the customer sounds, on an ordered scale.",
    category: "Scoring",
    tags: ["Rating", "CX", "Support"],
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

// Icons aren't persisted on Template rows — this maps a built-in recipe's
// name back to its icon for display, since the DB copy doesn't carry it.
export const RECIPE_ICON_BY_NAME: Record<string, RecipeIcon> = Object.fromEntries(
  BUILT_IN_RECIPES.map((r) => [r.name, r.icon]),
);
