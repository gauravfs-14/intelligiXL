import {
  Columns3,
  Database,
  Download,
  FolderKanban,
  LayoutTemplate,
  PencilLine,
  Play,
  Rows3,
  Sparkles,
  Undo2,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@/lib/activity/categories";

export const ACTIVITY_ICON: Record<ActivityCategory, LucideIcon> = {
  workspace: FolderKanban,
  datasets: Database,
  columns: Columns3,
  rows: Rows3,
  cells: PencilLine,
  history: Undo2,
  smartColumns: Sparkles,
  generation: Play,
  reviews: UserCheck,
  templates: LayoutTemplate,
  exports: Download,
};

export function activityLabel(category: string): string {
  return ACTIVITY_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}
