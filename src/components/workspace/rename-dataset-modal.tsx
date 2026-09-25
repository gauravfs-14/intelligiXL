"use client";

import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useRenameDataset } from "@/hooks/use-datasets";

export interface RenamableDataset {
  id: string;
  filename: string;
}

/** Rename dialog for one dataset. Render it once and pass the dataset to
 * rename (or null to close) — see `useRenameDatasetDialog`. */
export function RenameDatasetModal({
  workspaceId,
  dataset,
  onClose,
}: {
  workspaceId: string;
  dataset: RenamableDataset | null;
  onClose: () => void;
}) {
  const rename = useRenameDataset(workspaceId);

  return (
    <Modal
      open={Boolean(dataset)}
      onOpenChange={(o) => !o && onClose()}
      title="Rename dataset"
      description="Changes the display name only. The data and uploaded file are untouched."
      size="sm"
      preventClose={rename.isPending}
    >
      {/* Keyed so the draft restarts from each dataset's current name. */}
      {dataset && <RenameForm key={dataset.id} dataset={dataset} rename={rename} onClose={onClose} />}
    </Modal>
  );
}

function RenameForm({
  dataset,
  rename,
  onClose,
}: {
  dataset: RenamableDataset;
  rename: ReturnType<typeof useRenameDataset>;
  onClose: () => void;
}) {
  const [name, setName] = React.useState(dataset.filename);
  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== dataset.filename;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    try {
      await rename.mutateAsync({ id: dataset.id, filename: trimmed });
      toast.success(`Renamed to “${trimmed}”.`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename the dataset.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rename-dataset">Name</Label>
        <Input
          id="rename-dataset"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={rename.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!dirty} loading={rename.isPending}>
          Rename
        </Button>
      </div>
    </form>
  );
}

/** `[openRename, dialog]` — call `openRename(dataset)` and render `dialog`. */
export function useRenameDatasetDialog(workspaceId: string) {
  const [target, setTarget] = React.useState<RenamableDataset | null>(null);
  const dialog = <RenameDatasetModal workspaceId={workspaceId} dataset={target} onClose={() => setTarget(null)} />;
  return [setTarget as (d: RenamableDataset) => void, dialog] as const;
}
