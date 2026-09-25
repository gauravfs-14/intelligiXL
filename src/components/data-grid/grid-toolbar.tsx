"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, Copy, Columns3, X, AlignJustify, Rows3, Rows4, CopyPlus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GridFilterState } from "./filters";
import type { GridDensity } from "./data-grid";

interface ColumnToggle {
  id: string;
  label: string;
  visible: boolean;
}

// FR "Data Toolbar" — the excel-style wrangling bar: search, filters,
// column visibility, row density, and copy-to-clipboard, plus dataset-level
// actions (Undo/Redo, Export, Add Smart Column) pinned to the far right so
// they read as "acts on this dataset" rather than "acts on the selection".
// Row/column insertion happens via right-click, so it isn't duplicated here.
export function GridToolbar({
  filters,
  onFiltersChange,
  columns,
  onToggleColumn,
  density,
  onDensityChange,
  onCopy,
  selectedCount,
  totalCount,
  onDuplicateSelected,
  onDeleteSelected,
  leading,
  trailing,
}: {
  filters: GridFilterState;
  onFiltersChange: (next: GridFilterState) => void;
  columns: ColumnToggle[];
  onToggleColumn: (id: string) => void;
  density: GridDensity;
  onDensityChange: (density: GridDensity) => void;
  onCopy: () => void;
  selectedCount: number;
  totalCount: number;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  /** Extra control rendered before the search box — e.g. the dataset switcher. */
  leading?: React.ReactNode;
  /** Extra controls pinned to the far right — e.g. Undo/Redo/Export. */
  trailing?: React.ReactNode;
}) {
  const activeFilterCount =
    Object.values(filters.columnFilters).filter((v) => v.trim()).length +
    Object.values(filters.smartColumnFilters).filter((v) => v.labels?.length || v.minConfidence !== undefined || v.maxConfidence !== undefined).length;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
      {leading}
      <div className="relative w-64 max-w-full">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="Search rows…"
          className="h-8 pl-8 pr-7 text-sm"
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: "" })}
            className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {activeFilterCount > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}>
            <Badge tone="primary" className="gap-1">
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
              <button
                onClick={() => onFiltersChange({ search: filters.search, columnFilters: {}, smartColumnFilters: {} })}
                className="rounded-full transition-colors hover:bg-primary/20"
                aria-label="Clear filters"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Columns3 className="h-3.5 w-3.5" /> Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Show / hide columns</DropdownMenuLabel>
          {columns.map((c) => (
            <DropdownMenuCheckboxItem key={c.id} checked={c.visible} onCheckedChange={() => onToggleColumn(c.id)} onSelect={(e) => e.preventDefault()}>
              {c.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <DensityIcon density={density} className="h-3.5 w-3.5" /> Density
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[10rem]">
          <DropdownMenuLabel>Row height</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={density} onValueChange={(v) => onDensityChange(v as GridDensity)}>
            <DropdownMenuRadioItem value="compact">
              <AlignJustify className="h-3.5 w-3.5" /> Compact
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="comfortable">
              <Rows3 className="h-3.5 w-3.5" /> Comfortable
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="spacious">
              <Rows4 className="h-3.5 w-3.5" /> Spacious
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="sm" onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" /> {selectedCount > 0 ? `Copy (${selectedCount})` : "Copy"}
      </Button>

      {selectedCount > 0 && (
        <>
          <span className="text-xs text-muted-foreground">
            {selectedCount.toLocaleString()} of {totalCount.toLocaleString()} selected
          </span>
          <Button variant="ghost" size="sm" onClick={onDuplicateSelected}>
            <CopyPlus className="h-3.5 w-3.5" /> Duplicate
          </Button>
          <Button variant="ghost" size="sm" onClick={onDeleteSelected} className="text-danger hover:bg-danger-muted hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </>
      )}

      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}

function DensityIcon({ density, className }: { density: GridDensity; className?: string }) {
  if (density === "compact") return <AlignJustify className={className} />;
  if (density === "spacious") return <Rows4 className={className} />;
  return <Rows3 className={className} />;
}
