import { SmartColumnType } from "@/generated/prisma/browser";
import {
  DEFAULT_MODEL_IDENTIFIER,
  DEFAULT_MODEL_PROVIDER,
  DEFAULT_SMART_COLUMN_SETTINGS,
  type ModelProviderId,
  type SmartColumnSettings,
} from "@/lib/decision-models/catalog";

export interface CategoricalOption {
  key: string;
  description: string;
}

export interface BuilderState {
  name: string;
  sourceColumns: string[];
  question: string;
  instructions: string;
  type: SmartColumnType;
  binaryYes: string;
  binaryNo: string;
  categorical: CategoricalOption[];
  rating: string[];
  unclearEnabled: boolean;
  modelProvider: ModelProviderId;
  modelIdentifier: string;
  settings: SmartColumnSettings;
}

export function emptyBuilderState(): BuilderState {
  return {
    name: "",
    sourceColumns: [],
    question: "",
    instructions: "",
    type: SmartColumnType.BINARY,
    binaryYes: "",
    binaryNo: "",
    categorical: [
      { key: "", description: "" },
      { key: "", description: "" },
    ],
    rating: ["", ""],
    unclearEnabled: false,
    modelProvider: DEFAULT_MODEL_PROVIDER,
    modelIdentifier: DEFAULT_MODEL_IDENTIFIER,
    settings: { ...DEFAULT_SMART_COLUMN_SETTINGS },
  };
}

export function builderLabels(state: BuilderState): unknown {
  switch (state.type) {
    case SmartColumnType.BINARY:
      return { yes: state.binaryYes || null, no: state.binaryNo || null };
    case SmartColumnType.CATEGORICAL:
      return Object.fromEntries(state.categorical.filter((o) => o.key.trim()).map((o) => [o.key.trim(), o.description.trim() || null]));
    case SmartColumnType.RATING:
      return state.rating.map((l) => l.trim()).filter(Boolean);
  }
}

export function builderIsValid(state: BuilderState): boolean {
  if (!state.name.trim() || !state.question.trim() || state.sourceColumns.length === 0) return false;
  if (state.type === SmartColumnType.CATEGORICAL) {
    const keys = state.categorical.map((o) => o.key.trim()).filter(Boolean);
    return keys.length >= 2 && new Set(keys).size === keys.length;
  }
  if (state.type === SmartColumnType.RATING) {
    const levels = state.rating.map((l) => l.trim()).filter(Boolean);
    return levels.length >= 2 && levels.length <= 10;
  }
  return true;
}
