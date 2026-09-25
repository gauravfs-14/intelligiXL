"use client";

import * as React from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowLeftToLine,
  ArrowRightToLine,
  Copy,
  CopyPlus,
  EyeOff,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
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

export interface SourceColumnMenuActions {
  name: string;
  pinned: boolean;
  wrapped: boolean;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onTogglePin: () => void;
  onToggleWrap: () => void;
  onHide: () => void;
  onCopyColumn: () => void;
  onRename: () => void;
  onDuplicateColumn: () => void;
  onDeleteColumn: () => void;
  onInsertLeft: () => void;
  onInsertRight: () => void;
}

type ItemComp = React.ComponentType<{ onSelect?: (e: Event) => void; variant?: "default" | "destructive"; children: React.ReactNode }>;
type SepComp = React.ComponentType<Record<string, never>>;

function items(a: SourceColumnMenuActions, Item: ItemComp, Sep: SepComp) {
  return (
    <>
      <Item onSelect={a.onRename}>
        <Pencil className="h-3.5 w-3.5" /> Rename column
      </Item>
      <Item onSelect={a.onInsertLeft}>
        <ArrowLeftToLine className="h-3.5 w-3.5" /> Insert column left
      </Item>
      <Item onSelect={a.onInsertRight}>
        <ArrowRightToLine className="h-3.5 w-3.5" /> Insert column right
      </Item>
      <Sep />
      <Item onSelect={a.onSortAsc}>
        <ArrowDownAZ className="h-3.5 w-3.5" /> Sort ascending
      </Item>
      <Item onSelect={a.onSortDesc}>
        <ArrowUpAZ className="h-3.5 w-3.5" /> Sort descending
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
      <Item onSelect={a.onDuplicateColumn}>
        <CopyPlus className="h-3.5 w-3.5" /> Duplicate column
      </Item>
      <Item onSelect={a.onHide}>
        <EyeOff className="h-3.5 w-3.5" /> Hide column
      </Item>
      <Sep />
      <Item onSelect={a.onDeleteColumn} variant="destructive">
        <Trash2 className="h-3.5 w-3.5" /> Delete column
      </Item>
    </>
  );
}

// The "..." button — click to open, for discoverability.
export function SourceColumnMenu(props: SourceColumnMenuActions) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover/head:opacity-100 focus-visible:opacity-100"
          aria-label={`${props.name} column menu`}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[13rem]">
        {items(props, DropdownMenuItem, DropdownMenuSeparator)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Right-click anywhere on the header — the same full action set, spreadsheet-style.
export function SourceColumnContextMenu({ actions, children }: { actions: SourceColumnMenuActions; children: React.ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-[13rem]">{items(actions, ContextMenuItem, ContextMenuSeparator)}</ContextMenuContent>
    </ContextMenu>
  );
}
