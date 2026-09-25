"use client";

import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useDeleteDataset } from "@/hooks/use-datasets";
import { useDatasetContext } from "./dataset-context";

export interface DeletableDataset {
  id: string;
  filename: string;
  rowCount: number;
  smartColumnCount: number;
}

/** Confirm-then-delete for one dataset. Clears the dataset selection if the
 * deleted dataset was the active one (the switcher then picks the next). */
export function useDeleteDatasetWithConfirm(workspaceId: string) {
  const remove = useDeleteDataset(workspaceId);
  const confirm = useConfirm();
  const { datasetId, setDatasetId } = useDatasetContext();

  return async function deleteDataset(dataset: DeletableDataset) {
    const rows = `${dataset.rowCount.toLocaleString()} row${dataset.rowCount === 1 ? "" : "s"} and the uploaded file`;
    const columns =
      dataset.smartColumnCount > 0
        ? `${dataset.smartColumnCount} Smart Column${dataset.smartColumnCount === 1 ? "" : "s"}, with every prediction and review`
        : null;
    const ok = await confirm({
      title: `Delete “${dataset.filename}”?`,
      description: "This dataset is permanently deleted, including:",
      details: [rows, ...(columns ? [columns] : []), "Generation jobs, export history and the edit history"],
      confirmLabel: "Delete dataset",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(dataset.id);
      if (datasetId === dataset.id) setDatasetId(null);
      toast.success(`Deleted “${dataset.filename}”.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete dataset.");
    }
  };
}
