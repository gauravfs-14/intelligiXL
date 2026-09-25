"use client";

import * as React from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Copy,
  Eye,
  EyeOff,
  Filter,
  Info,
  ListChecks,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  RotateCcw,
  Trash2,
  WrapText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";

export interface SmartColumnMenuActions {
  name: string;
  showConfidence: boolean;
  hasFailedPredictions: boolean;
  pinned: boolean;
  wrapped: boolean;
  onFilter: () => void;
  onSortLabel: (dir: "asc" | "desc") => void;
  onSortConfidence: (dir: "asc" | "desc") => void;
  onToggleConfidence: () => void;
  onTogglePin: () => void;
  onToggleWrap: () => void;
  onCopyColumn: () => void;
  onViewConfig: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onRetryFailed: () => void;
  onGoToReview: () => void;
  onDelete: () => void;
}

type ItemComp = React.ComponentType<{ onSelect?: (e: Event) => void; variant?: "default" | "destructive"; children: React.ReactNode }>;
type SepComp = React.ComponentType<Record<string, never>>;

function items(a: SmartColumnMenuActions, Item: ItemComp, Sep: SepComp) {
  return (
    <>
      <Item onSelect={a.onFilter}>
        <Filter className="h-3.5 w-3.5" /> Filter
      </Item>
      <Item onSelect={() => a.onSortLabel("asc")}>
        <ArrowDownAZ className="h-3.5 w-3.5" /> Sort by label (A→Z)
      </Item>
      <Item onSelect={() => a.onSortConfidence("desc")}>
        <ArrowUpAZ className="h-3.5 w-3.5" /> Sort by confidence
      </Item>
      <Item onSelect={a.onToggleConfidence}>
        {a.showConfidence ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {a.showConfidence ? "Hide confidence" : "Show confidence"}
      </Item>
      <Sep />
      <Item onSelect={a.onTogglePin}>
        {a.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        {a.pinned ? "Unfreeze column" : "Freeze column"}
      </Item>
      <Item onSelect={a.onToggleWrap}>
        <WrapText className="h-3.5 w-3.5" /> {a.wrapped ? "Disable wrap text" : "Wrap text"}
      </Item>
      <Item onSelect={a.onCopyColumn}>
        <Copy className="h-3.5 w-3.5" /> Copy column
      </Item>
      <Sep />
      <Item onSelect={a.onViewConfig}>
        <Info className="h-3.5 w-3.5" /> View configuration
      </Item>
      <Item onSelect={a.onEdit}>
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Item>
      <Item onSelect={a.onRegenerate}>
        <RefreshCw className="h-3.5 w-3.5" /> Regenerate
      </Item>
      {a.hasFailedPredictions && (
        <Item onSelect={a.onRetryFailed}>
          <RotateCcw className="h-3.5 w-3.5" /> Retry failed rows
        </Item>
      )}
      <Item onSelect={a.onGoToReview}>
        <ListChecks className="h-3.5 w-3.5" /> Open in Review Queue
      </Item>
      <Sep />
      <Item onSelect={a.onDelete} variant="destructive">
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Item>
    </>
  );
}

export function SmartColumnHeaderMenu(props: SmartColumnMenuActions) {
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className={cnTrigger(open)} aria-label={`${props.name} column menu`}>
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        {items(props, DropdownMenuItem, DropdownMenuSeparator)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SmartColumnContextMenu({ actions, children }: { actions: SmartColumnMenuActions; children: React.ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-[14rem]">{items(actions, ContextMenuItem, ContextMenuSeparator)}</ContextMenuContent>
    </ContextMenu>
  );
}

function cnTrigger(open: boolean) {
  return [
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
    open ? "opacity-100" : "opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100",
  ].join(" ");
}
