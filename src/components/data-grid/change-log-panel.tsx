"use client";

import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { History, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { useDatasetChanges, useRedoChange, useRevertChange, useUndoChange } from "@/hooks/use-datasets";

// FR "keep the logs of what we actually changed in the data, and keep the
// states so that we can undo, redo, and revert" — every row/column mutation
// writes a change-log entry (see src/lib/change-log.ts); this panel exposes
// step undo/redo plus jumping back to an arbitrary earlier point.
export function ChangeLogPanel({ datasetId, open }: { datasetId: string; open: boolean }) {
  const { data, isLoading, isError, refetch } = useDatasetChanges(datasetId, open);
  const undo = useUndoChange(datasetId);
  const redo = useRedoChange(datasetId);
  const revert = useRevertChange(datasetId);
  const confirm = useConfirm();

  const changes = data?.changes ?? [];
  const topActiveIndex = changes.findIndex((c) => !c.undone);

  async function handleUndo() {
    try {
      await undo.mutateAsync();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nothing to undo.");
    }
  }

  async function handleRedo() {
    try {
      await redo.mutateAsync();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nothing to redo.");
    }
  }

  async function handleRevert(changeId: string) {
    const ok = await confirm({
      title: "Revert to this point?",
      description: "Every change made after it will be undone.",
      note: "Reverted changes stay in the log and can be redone.",
      confirmLabel: "Revert",
    });
    if (!ok) return;
    try {
      const res = await revert.mutateAsync(changeId);
      toast.success(`Reverted ${res.undone.length} change${res.undone.length > 1 ? "s" : ""}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't revert.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleUndo} disabled={!data?.canUndo} loading={undo.isPending}>
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </Button>
        <Button variant="outline" size="sm" onClick={handleRedo} disabled={!data?.canRedo} loading={redo.isPending}>
          <Redo2 className="h-3.5 w-3.5" /> Redo
        </Button>
      </div>

      {isLoading && <TableSkeleton rows={3} cols={1} />}
      {isError && <ErrorState description="Couldn't load the change history." onRetry={() => refetch()} />}

      {!isLoading && !isError && changes.length === 0 && (
        <EmptyState icon={History} title="No changes yet" description="Cell edits and row/column changes will show up here." />
      )}

      {!isLoading && !isError && changes.length > 0 && (
        <div className="flex flex-col gap-1">
          {changes.map((c, i) => {
            const canRevertHere = !c.undone && i !== topActiveIndex;
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  c.undone && "opacity-50",
                )}
              >
                <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate", c.undone && "line-through")}>{c.summary}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</p>
                </div>
                {canRevertHere && (
                  <Button variant="ghost" size="sm" onClick={() => handleRevert(c.id)} loading={revert.isPending}>
                    <RotateCcw className="h-3.5 w-3.5" /> Revert to here
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
