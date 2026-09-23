"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Database, Upload } from "lucide-react";
import { useDatasets } from "@/hooks/use-datasets";
import { useDatasetContext } from "./dataset-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DatasetSwitcher({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { data } = useDatasets(workspaceId);
  const { datasetId, setDatasetId } = useDatasetContext();
  const datasets = data?.datasets ?? [];

  // Auto-select the most recent dataset the first time the list loads if
  // nothing is selected yet — avoids a dead-end "pick something" screen.
  React.useEffect(() => {
    if (!datasetId && datasets.length > 0) setDatasetId(datasets[0].id);
  }, [datasetId, datasets, setDatasetId]);

  const current = datasets.find((d) => d.id === datasetId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 items-center gap-2 border border-border-strong bg-surface px-3 text-sm font-medium transition-shadow hover:shadow-flat-sm">
          <Database className="h-3.5 w-3.5 text-muted" />
          <span className="max-w-[16rem] truncate">{current ? current.filename : "Select a dataset"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </button>
      </DropdownMenuTrigger>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
