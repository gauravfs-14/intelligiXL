// Shared by the server (what to record) and the client (the Settings toggles
// and Activity page filters) — so no server-only imports here.

export const ACTIVITY_CATEGORIES = [
  { id: "workspace", label: "Workspace", description: "Creating the workspace, renaming it, or editing its description." },
  { id: "datasets", label: "Datasets", description: "Importing, renaming and deleting datasets." },
  { id: "columns", label: "Source columns", description: "Adding, renaming, duplicating and deleting source columns." },
  { id: "rows", label: "Rows", description: "Adding and deleting rows." },
  { id: "cells", label: "Cell edits", description: "Every value changed in the grid, with its old and new value." },
  { id: "history", label: "Undo & redo", description: "Undo, redo and “revert to here” in a dataset's edit history." },
  { id: "smartColumns", label: "Smart Columns", description: "Creating, editing (new versions) and deleting Smart Columns." },
  { id: "generation", label: "Generation runs", description: "Starting, retrying, cancelling and finishing generation jobs." },
  { id: "reviews", label: "Human review", description: "Confirming, correcting and skipping predictions." },
  { id: "templates", label: "Templates", description: "Saving, applying and deleting templates." },
  { id: "exports", label: "Exports", description: "Exporting a dataset to CSV, Excel or JSON." },
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["id"];

export type ActivitySettings = Record<ActivityCategory, boolean>;

export const ACTIVITY_CATEGORY_IDS = ACTIVITY_CATEGORIES.map((c) => c.id) as ActivityCategory[];

export function isActivityCategory(value: string): value is ActivityCategory {
  return (ACTIVITY_CATEGORY_IDS as string[]).includes(value);
}

/** Fills in every category from the stored (possibly partial or null) JSON —
 * anything not explicitly turned off is recorded. */
export function resolveActivitySettings(stored: unknown): ActivitySettings {
  const raw = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  return Object.fromEntries(ACTIVITY_CATEGORY_IDS.map((id) => [id, raw[id] !== false])) as ActivitySettings;
}
