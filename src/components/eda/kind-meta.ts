import { Braces, CalendarDays, Hash, Shapes, ToggleLeft, Type } from "lucide-react";
import type { EdaKind } from "@/lib/eda/compute";

export const KIND_META: Record<EdaKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  NUMBER: { label: "Numeric", icon: Hash },
  TEXT: { label: "Text", icon: Type },
  CATEGORY: { label: "Categorical", icon: Shapes },
  BOOLEAN: { label: "Boolean", icon: ToggleLeft },
  DATE: { label: "Date", icon: CalendarDays },
  JSON: { label: "JSON", icon: Braces },
};

export const ALL_KINDS: EdaKind[] = ["NUMBER", "TEXT", "CATEGORY", "BOOLEAN", "DATE", "JSON"];
