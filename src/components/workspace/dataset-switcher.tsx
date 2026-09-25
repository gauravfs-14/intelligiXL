"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Database, Pencil, Trash2, Upload } from "lucide-react";
import { useDatasets } from "@/hooks/use-datasets";
import { useDatasetContext } from "./dataset-context";
import { useDeleteDatasetWithConfirm } from "./use-delete-dataset";
import { useRenameDatasetDialog } from "./rename-dataset-modal";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DatasetSwitcher({ workspaceId, className, compact }: { workspaceId: string; className?: string; compact?: boolean }) {
  const router = useRouter();
  const { data } = useDatasets(workspaceId);
  const { datasetId, setDatasetId } = useDatasetContext();
  const datasets = React.useMemo(() => data?.datasets ?? [], [data]);

  const deleteDataset = useDeleteDatasetWithConfirm(workspaceId);
  const [openRename, renameDialog] = useRenameDatasetDialog(workspaceId);

  // Auto-select the most recent dataset when nothing valid is selected —
  // on first load, or after the selected dataset was deleted (here or in
  // another tab) — so nothing dead-ends on a stale id.
  React.useEffect(() => {
    if (!data) return;
    const valid = datasetId && datasets.some((d) => d.id === datasetId);
    if (!valid) {
      const next = datasets[0]?.id ?? null;
      if (next !== datasetId) setDatasetId(next);
    }
  }, [data, datasetId, datasets, setDatasetId]);

  const current = datasets.find((d) => d.id === datasetId);

  const trigger = compact ? (
    <button className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", className)} aria-label="Switch dataset">
      <Database className="h-4 w-4" />
    </button>
  ) : (
    <button
      className={cn(
        "flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 max-w-[16rem] flex-1 truncate text-left">{current ? current.filename : "Select a dataset"}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );

  const triggerNode = compact ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent side="right">{current ? current.filename : "Switch dataset"}</TooltipContent>
    </Tooltip>
  ) : (
    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
  );

  return (
    <>
    <DropdownMenu>
      {triggerNode}
      <DropdownMenuContent align="start" className="min-w-[16rem]">
        <DropdownMenuLabel>Datasets</DropdownMenuLabel>
        {datasets.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No datasets yet.</p>}
        {datasets.map((d) => (
          <DropdownMenuItem key={d.id} onSelect={() => setDatasetId(d.id)}>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{d.filename}</span>
              <span className="text-[11px] text-muted-foreground">
                {d.rowCount.toLocaleString()} rows · {d.columnCount} cols
              </span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(`/w/${workspaceId}/data?upload=1`)}>
          <Upload className="h-3.5 w-3.5" /> Upload new dataset
        </DropdownMenuItem>
        {current && (
          <DropdownMenuItem onSelect={() => openRename({ id: current.id, filename: current.filename })}>
            <Pencil className="h-3.5 w-3.5" /> Rename “{current.filename}”
          </DropdownMenuItem>
        )}
        {current && (
          <DropdownMenuItem
            onSelect={() =>
              deleteDataset({ id: current.id, filename: current.filename, rowCount: current.rowCount, smartColumnCount: current._count.smartColumns })
            }
            className="text-danger focus:bg-danger-muted focus:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete “{current.filename}”
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    {renameDialog}
    </>
  );
}
