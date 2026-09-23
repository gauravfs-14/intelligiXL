"use client";

import * as React from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Eye,
  EyeOff,
  Filter,
  Info,
  ListChecks,
  MoreVertical,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SmartColumnHeaderMenu({
  name,
  showConfidence,
  hasFailedPredictions,
  onFilter,
  onSortLabel,
  onSortConfidence,
  onToggleConfidence,
  onViewConfig,
  onEdit,
  onRegenerate,
  onRetryFailed,
  onGoToReview,
  onDelete,
}: {
  name: string;
  showConfidence: boolean;
  hasFailedPredictions: boolean;
  onFilter: () => void;
  onSortLabel: (dir: "asc" | "desc") => void;
  onSortConfidence: (dir: "asc" | "desc") => void;
  onToggleConfidence: () => void;
  onViewConfig: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onRetryFailed: () => void;
  onGoToReview: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cnTrigger(open)}
          aria-label={`${name} column menu`}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        <DropdownMenuItem onSelect={onFilter}>
          <Filter className="h-3.5 w-3.5" /> Filter
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSortLabel("asc")}>
          <ArrowDownAZ className="h-3.5 w-3.5" /> Sort by label (A→Z)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSortConfidence("desc")}>
          <ArrowUpAZ className="h-3.5 w-3.5" /> Sort by confidence
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleConfidence}>
          {showConfidence ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showConfidence ? "Hide confidence" : "Show confidence"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onViewConfig}>
          <Info className="h-3.5 w-3.5" /> View configuration
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRegenerate}>
          <RefreshCw className="h-3.5 w-3.5" /> Regenerate
        </DropdownMenuItem>
        {hasFailedPredictions && (
          <DropdownMenuItem onSelect={onRetryFailed}>
            <RotateCcw className="h-3.5 w-3.5" /> Retry failed rows
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onGoToReview}>
          <ListChecks className="h-3.5 w-3.5" /> Open in Review Queue
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} variant="destructive">
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function cnTrigger(open: boolean) {
  return [
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
    open ? "opacity-100" : "opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100",
  ].join(" ");
}
