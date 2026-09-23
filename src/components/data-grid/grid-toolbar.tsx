"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, Plus, Download, Columns3, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GridFilterState } from "./filters";

interface ColumnToggle {
  id: string;
  label: string;
  visible: boolean;
}

// FR "Data Toolbar" layout: Search · Filter · Columns · + Add Smart Column · Export
export function GridToolbar({
  filters,
  onFiltersChange,
  columns,
  onToggleColumn,
  onAddSmartColumn,
  onExport,
  selectedCount,
  totalCount,
}: {
  filters: GridFilterState;
  onFiltersChange: (next: GridFilterState) => void;
  columns: ColumnToggle[];
  onToggleColumn: (id: string) => void;
  onAddSmartColumn: () => void;
  onExport: () => void;
  selectedCount: number;
  totalCount: number;
}) {
  const activeFilterCount =
    Object.values(filters.columnFilters).filter((v) => v.trim()).length +
    Object.values(filters.smartColumnFilters).filter((v) => v.labels?.length || v.minConfidence !== undefined || v.maxConfidence !== undefined).length;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
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

      {selectedCount > 0 && (
        <span className="text-xs text-muted-foreground">
          {selectedCount.toLocaleString()} of {totalCount.toLocaleString()} selected
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
        <Button size="sm" onClick={onAddSmartColumn}>
          <Plus className="h-3.5 w-3.5" /> Add Smart Column
        </Button>
      </div>
    </div>
  );
}
