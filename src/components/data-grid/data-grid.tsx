"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnPinningState,
  type Header,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Filter,
  GripVertical,
  LayoutGrid,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  paginationRange,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { EditableCell } from "./editable-cell";
import { PredictionCell } from "./prediction-cell";
import { GridToolbar } from "./grid-toolbar";
import { SmartColumnHeaderMenu, SmartColumnContextMenu, type SmartColumnMenuActions } from "./smart-column-header-menu";
import { SourceColumnMenu, SourceColumnContextMenu, type SourceColumnMenuActions } from "./source-column-menu";
import { SmartColumnFilterPopover } from "./smart-column-filter-popover";
import { applyFilters, EMPTY_FILTERS, type GridFilterState } from "./filters";
import { EmptyState } from "@/components/ui/states";
import type { DatasetColumnDto, DatasetRowDto, PredictionDto, WorkbenchSmartColumnDto } from "@/types/workbench";

const MIN_ROW_HEIGHT = 24;

interface RowShape {
  row: DatasetRowDto;
  predictions: Map<string, PredictionDto>;
}

export type GridDensity = "compact" | "comfortable" | "spacious";

const ROW_HEIGHT: Record<GridDensity, number> = {
  compact: 32,
  comfortable: 44,
  spacious: 60,
};

export interface GridPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function DataGrid({
  columns: datasetColumns,
  rows,
  smartColumns,
  predictions,
  onEditSmartColumn,
  onViewConfig,
  onRegenerate,
  onRetryFailed,
  onDeleteSmartColumn,
  onGoToReview,
  onUpdateCell,
  onCorrectPrediction,
  onInsertRow,
  onDuplicateRows,
  onDeleteRows,
  onInsertColumn,
  onRenameColumn,
  onDuplicateColumn,
  onDeleteColumn,
  pagination,
  toolbarLeading,
  toolbarTrailing,
}: {
  columns: DatasetColumnDto[];
  rows: DatasetRowDto[];
  smartColumns: WorkbenchSmartColumnDto[];
  predictions: PredictionDto[];
  onEditSmartColumn: (smartColumnId: string) => void;
  onViewConfig: (smartColumnId: string) => void;
  onRegenerate: (smartColumnId: string) => void;
  onRetryFailed: (smartColumnId: string) => void;
  onDeleteSmartColumn: (smartColumnId: string) => void;
  onGoToReview: (smartColumnId: string) => void;
  onUpdateCell: (rowId: string, columnName: string, value: string) => void;
  /** Double-click correction on an AI cell — same effect as a Review "Correct". */
  onCorrectPrediction: (predictionId: string, value: string) => void;
  onInsertRow: (anchorRowId: string, position: "above" | "below") => void;
  onDuplicateRows: (rowIds: string[]) => void;
  onDeleteRows: (rowIds: string[]) => void;
  onInsertColumn: (name: string, anchorColumnId: string, position: "left" | "right") => void;
  onRenameColumn: (columnId: string, name: string) => void;
  onDuplicateColumn: (columnId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  pagination?: GridPagination;
  /** Rendered as the first control in the toolbar row — e.g. the dataset switcher. */
  toolbarLeading?: React.ReactNode;
  /** Rendered pinned to the far right of the toolbar row — e.g. Undo/Redo/Export. */
  toolbarTrailing?: React.ReactNode;
}) {
  const [filters, setFilters] = React.useState<GridFilterState>(EMPTY_FILTERS);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>({ left: [], right: [] });
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [confidenceVisible, setConfidenceVisible] = React.useState<Record<string, boolean>>({});
  const [openFilterFor, setOpenFilterFor] = React.useState<string | null>(null);
  const [dragCol, setDragCol] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);
  const [sortModeBySmartColumn, setSortModeBySmartColumn] = React.useState<Record<string, "label" | "confidence">>({});
  const [density, setDensity] = React.useState<GridDensity>("comfortable");
  const [resizeGuide, setResizeGuide] = React.useState<{ x: number; top: number; bottom: number } | null>(null);
  const [renamingColumnId, setRenamingColumnId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [addColumnOpen, setAddColumnOpen] = React.useState(false);
  const [newColumnName, setNewColumnName] = React.useState("");
  const [insertColumnRequest, setInsertColumnRequest] = React.useState<{ anchorId: string; position: "left" | "right" } | null>(null);
  const [wrapColumns, setWrapColumns] = React.useState<Set<string>>(() => new Set());
  const [rowHeightOverrides, setRowHeightOverrides] = React.useState<Record<string, number>>({});
  const [rowResizeGuide, setRowResizeGuide] = React.useState<{ y: number; left: number; right: number } | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  const rowHeight = ROW_HEIGHT[density];

  function toggleWrap(columnId: string) {
    setWrapColumns((s) => {
      const next = new Set(s);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  }

  const versionToSmartColumn = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const sc of smartColumns) if (sc.activeVersion) map.set(sc.activeVersion.id, sc.id);
    return map;
  }, [smartColumns]);

  const predictionsByRowBySmartColumn = React.useMemo(() => {
    const map = new Map<string, Map<string, PredictionDto>>();
    for (const p of predictions) {
      const scId = versionToSmartColumn.get(p.smartColumnVersionId);
      if (!scId) continue;
      if (!map.has(p.datasetRowId)) map.set(p.datasetRowId, new Map());
      map.get(p.datasetRowId)!.set(scId, p);
    }
    return map;
  }, [predictions, versionToSmartColumn]);

  const sourceColumnNames = React.useMemo(() => datasetColumns.map((c) => c.name), [datasetColumns]);

  // Tanstack column ids are keyed off the stable DatasetColumn.id (not the
  // name) so a rename doesn't orphan sorting/visibility/pinning state that
  // was captured under the old id.
  const sourceColumnById = React.useMemo(() => new Map(datasetColumns.map((c) => [c.id, c])), [datasetColumns]);

  const filteredRows = React.useMemo(
    () => applyFilters(rows, sourceColumnNames, smartColumns, predictionsByRowBySmartColumn, filters),
    [rows, sourceColumnNames, smartColumns, predictionsByRowBySmartColumn, filters],
  );

  const data: RowShape[] = React.useMemo(
    () => filteredRows.map((row) => ({ row, predictions: predictionsByRowBySmartColumn.get(row.id) ?? new Map() })),
    [filteredRows, predictionsByRowBySmartColumn],
  );

  const labelOptionsBySmartColumn = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const sc of smartColumns) {
      const set = new Set<string>();
      for (const p of predictions) {
        if (p.predictedLabel && versionToSmartColumn.get(p.smartColumnVersionId) === sc.id) set.add(p.predictedLabel);
      }
      map.set(sc.id, [...set].sort());
    }
    return map;
  }, [smartColumns, predictions, versionToSmartColumn]);

  const hasFailedBySmartColumn = React.useMemo(() => {
    const map = new Map<string, boolean>();
    for (const sc of smartColumns) {
      map.set(sc.id, predictions.some((p) => versionToSmartColumn.get(p.smartColumnVersionId) === sc.id && p.status === "FAILED"));
    }
    return map;
  }, [smartColumns, predictions, versionToSmartColumn]);

  function copyColumn(columnId: string) {
    const values = data.map((d) => cellText(d, columnId));
    navigator.clipboard.writeText(values.join("\n")).then(
      () => toast.success(`Copied ${values.length.toLocaleString()} value(s).`),
      () => toast.error("Couldn't copy to clipboard."),
    );
  }

  function cellText(d: RowShape, columnId: string): string {
    if (columnId.startsWith("col:")) {
      const name = sourceColumnById.get(columnId.slice(4))?.name;
      return name ? String(d.row.data[name] ?? "").replace(/[\t\n]/g, " ") : "";
    }
    const scId = columnId.slice(3);
    return (d.predictions.get(scId)?.predictedLabel ?? "").replace(/[\t\n]/g, " ");
  }

  function columnLabel(columnId: string): string {
    if (columnId.startsWith("col:")) return sourceColumnById.get(columnId.slice(4))?.name ?? columnId;
    const sc = smartColumns.find((s) => `sc:${s.id}` === columnId);
    return sc?.name ?? columnId;
  }

  function togglePin(columnId: string) {
    setColumnPinning((p) => {
      const left = p.left ?? [];
      if (left.includes(columnId)) return { ...p, left: left.filter((id) => id !== columnId) };
      return { ...p, left: [...left, columnId] };
    });
  }

  const columns = React.useMemo<ColumnDef<RowShape>[]>(() => {
    const select: ColumnDef<RowShape> = {
      id: "__select",
      size: 40,
      enableSorting: false,
      enablePinning: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(v) => table.toggleAllRowsSelected(Boolean(v))}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(Boolean(v))} aria-label="Select row" />
      ),
    };

    const source: ColumnDef<RowShape>[] = datasetColumns.map((col) => {
      const id = `col:${col.id}`;
      return {
        id,
        accessorFn: (r) => r.row.data[col.name],
        size: 220,
        header: ({ column }) =>
          renamingColumnId === col.id ? (
            <ColumnRenameInput
              value={renameDraft}
              onChange={setRenameDraft}
              onCommit={() => {
                setRenamingColumnId(null);
                if (renameDraft.trim() && renameDraft.trim() !== col.name) onRenameColumn(col.id, renameDraft.trim());
              }}
              onCancel={() => setRenamingColumnId(null)}
            />
          ) : (
            <SourceHeader
              sortDir={column.getIsSorted()}
              sortIndex={sorting.length > 1 ? column.getSortIndex() : -1}
              onToggleSort={column.getToggleSortingHandler() ?? (() => column.toggleSorting())}
              onDragHandleStart={() => setDragCol(id)}
              actions={{
                name: col.name,
                pinned: column.getIsPinned() === "left",
                wrapped: wrapColumns.has(id),
                onSortAsc: () => column.toggleSorting(false),
                onSortDesc: () => column.toggleSorting(true),
                onTogglePin: () => togglePin(id),
                onToggleWrap: () => toggleWrap(id),
                onHide: () => setColumnVisibility((v) => ({ ...v, [id]: false })),
                onCopyColumn: () => copyColumn(id),
                onRename: () => {
                  setRenameDraft(col.name);
                  setRenamingColumnId(col.id);
                },
                onDuplicateColumn: () => onDuplicateColumn(col.id),
                onDeleteColumn: () => {
                  onDeleteColumn(col.id);
                },
                onInsertLeft: () => {
                  setInsertColumnRequest({ anchorId: col.id, position: "left" });
                  setNewColumnName("");
                  setAddColumnOpen(true);
                },
                onInsertRight: () => {
                  setInsertColumnRequest({ anchorId: col.id, position: "right" });
                  setNewColumnName("");
                  setAddColumnOpen(true);
                },
              }}
            />
          ),
        cell: ({ getValue, row }) => (
          <EditableCell value={getValue()} onSave={(next) => onUpdateCell(row.original.row.id, col.name, next)} wrap={wrapColumns.has(id)} />
        ),
        sortingFn: (a, b) => {
          const av = a.original.row.data[col.name];
          const bv = b.original.row.data[col.name];
          return String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
        },
      };
    });

    const smart: ColumnDef<RowShape>[] = smartColumns.map((sc) => {
      const id = `sc:${sc.id}`;
      return {
        id,
        accessorFn: (r) => r.predictions.get(sc.id)?.predictedLabel ?? "",
        size: 200,
        header: ({ column }) => (
          <SmartHeader
            smartColumn={sc}
            filterOpen={openFilterFor === sc.id}
            sortDir={column.getIsSorted()}
            sortIndex={sorting.length > 1 ? column.getSortIndex() : -1}
            onToggleSort={column.getToggleSortingHandler() ?? (() => column.toggleSorting())}
            onDragHandleStart={() => setDragCol(id)}
            onOpenFilter={() => setOpenFilterFor(openFilterFor === sc.id ? null : sc.id)}
            onCloseFilter={() => setOpenFilterFor(null)}
            labelOptions={labelOptionsBySmartColumn.get(sc.id) ?? []}
            filterValue={filters.smartColumnFilters[sc.id] ?? {}}
            onFilterChange={(next) =>
              setFilters((f) => ({ ...f, smartColumnFilters: { ...f.smartColumnFilters, [sc.id]: next } }))
            }
            actions={{
              name: sc.name,
              showConfidence: confidenceVisible[sc.id] !== false,
              hasFailedPredictions: hasFailedBySmartColumn.get(sc.id) ?? false,
              pinned: column.getIsPinned() === "left",
              wrapped: wrapColumns.has(id),
              onFilter: () => setOpenFilterFor(openFilterFor === sc.id ? null : sc.id),
              onSortLabel: (dir) => {
                setSortModeBySmartColumn((m) => ({ ...m, [sc.id]: "label" }));
                setSorting([{ id, desc: dir === "desc" }]);
              },
              onSortConfidence: (dir) => {
                setSortModeBySmartColumn((m) => ({ ...m, [sc.id]: "confidence" }));
                setSorting([{ id, desc: dir === "desc" }]);
              },
              onToggleConfidence: () => setConfidenceVisible((v) => ({ ...v, [sc.id]: v[sc.id] === false })),
              onTogglePin: () => togglePin(id),
              onToggleWrap: () => toggleWrap(id),
              onCopyColumn: () => copyColumn(id),
              onEdit: () => onEditSmartColumn(sc.id),
              onViewConfig: () => onViewConfig(sc.id),
              onRegenerate: () => onRegenerate(sc.id),
              onRetryFailed: () => onRetryFailed(sc.id),
              onDelete: () => onDeleteSmartColumn(sc.id),
              onGoToReview: () => onGoToReview(sc.id),
            }}
          />
        ),
        cell: ({ row }) => {
          const prediction = row.original.predictions.get(sc.id);
          return (
            <PredictionCell
              prediction={prediction}
              showConfidence={confidenceVisible[sc.id] !== false}
              wrap={wrapColumns.has(id)}
              version={sc.activeVersion ?? undefined}
              onCorrect={prediction ? (value) => onCorrectPrediction(prediction.id, value) : undefined}
            />
          );
        },
        sortingFn: (a, b) => {
          const av = a.original.predictions.get(sc.id);
          const bv = b.original.predictions.get(sc.id);
          if ((sortModeBySmartColumn[sc.id] ?? "label") === "confidence") {
            return (av?.confidence ?? -1) - (bv?.confidence ?? -1);
          }
          return String(av?.predictedLabel ?? "").localeCompare(String(bv?.predictedLabel ?? ""));
        },
      };
    });

    return [select, ...source, ...smart];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    datasetColumns,
    smartColumns,
    confidenceVisible,
    openFilterFor,
    labelOptionsBySmartColumn,
    filters.smartColumnFilters,
    hasFailedBySmartColumn,
    sortModeBySmartColumn,
    sorting,
    renamingColumnId,
    renameDraft,
    wrapColumns,
    onEditSmartColumn,
    onViewConfig,
    onRegenerate,
    onRetryFailed,
    onDeleteSmartColumn,
    onGoToReview,
    onUpdateCell,
    onCorrectPrediction,
    onRenameColumn,
    onDuplicateColumn,
    onDeleteColumn,
  ]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnOrder, columnPinning, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onRowSelectionChange: setRowSelection,
    getRowId: (r) => r.row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    enableColumnPinning: true,
    columnResizeMode: "onEnd",
  });

  const tableRows = table.getRowModel().rows;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    // Dynamic measurement (via measureElement on each row, below) means a
    // row's *real* rendered height always wins — wrap text growing a row,
    // or a manual per-row height override, are both picked up automatically
    // without needing two separate sizing systems.
  });
  React.useEffect(() => virtualizer.measure(), [rowHeight, virtualizer]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggleableColumns = React.useMemo(
    () =>
      [...datasetColumns.map((c) => ({ id: `col:${c.id}`, label: c.name })), ...smartColumns.map((sc) => ({ id: `sc:${sc.id}`, label: sc.name }))].map(
        (c) => ({ ...c, visible: columnVisibility[c.id] !== false }),
      ),
    [datasetColumns, smartColumns, columnVisibility],
  );

  function handleDrop(targetId: string) {
    setDragOverCol(null);
    if (!dragCol || dragCol === targetId) return;
    const order = table.getAllLeafColumns().map((c) => c.id);
    const from = order.indexOf(dragCol);
    const to = order.indexOf(targetId);
    if (from === -1 || to === -1) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    setColumnOrder(order);
    setDragCol(null);
  }

  function beginResize(e: React.MouseEvent | React.TouchEvent, header: Header<RowShape, unknown>) {
    header.getResizeHandler()(e);
    const clientX = "touches" in e ? e.touches[0]!.clientX : e.clientX;
    const rect = gridRef.current?.getBoundingClientRect();
    setResizeGuide({ x: clientX, top: rect?.top ?? 0, bottom: rect?.bottom ?? window.innerHeight });

    function onMove(ev: MouseEvent | TouchEvent) {
      const x = "touches" in ev ? ev.touches[0]?.clientX ?? 0 : (ev as MouseEvent).clientX;
      setResizeGuide((g) => (g ? { ...g, x } : g));
    }
    function onUp() {
      setResizeGuide(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
  }

  function beginRowResize(e: React.MouseEvent, rowId: string, startHeight: number) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const rect = gridRef.current?.getBoundingClientRect();
    setRowResizeGuide({ y: e.clientY, left: rect?.left ?? 0, right: rect?.right ?? window.innerWidth });

    function onMove(ev: MouseEvent) {
      setRowResizeGuide((g) => (g ? { ...g, y: ev.clientY } : g));
    }
    function onUp(ev: MouseEvent) {
      const next = Math.max(MIN_ROW_HEIGHT, Math.round(startHeight + (ev.clientY - startY)));
      setRowHeightOverrides((h) => ({ ...h, [rowId]: next }));
      setRowResizeGuide(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      requestAnimationFrame(() => virtualizer.measure());
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function copySelection() {
    const rowsToExport = selectedIds.length > 0 ? tableRows.filter((r) => r.getIsSelected()) : tableRows;
    const leafCols = table.getAllLeafColumns().filter((c) => c.id !== "__select");
    const headerLine = leafCols.map((c) => columnLabel(c.id)).join("\t");
    const lines = rowsToExport.map((r) => leafCols.map((c) => cellText(r.original, c.id)).join("\t"));
    try {
      await navigator.clipboard.writeText([headerLine, ...lines].join("\n"));
      toast.success(`${rowsToExport.length.toLocaleString()} row(s) copied to clipboard.`);
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState icon={LayoutGrid} title="This dataset has no rows" description="Something went wrong during import." />
      </div>
    );
  }

  const selectedIds = Object.keys(rowSelection);
  const leftHeaders = table.getLeftFlatHeaders();
  const centerHeaders = table.getCenterFlatHeaders();
  const totalWidth = Math.max(table.getTotalSize(), containerWidth);

  return (
    <div ref={gridRef} className="flex h-full flex-col">
      <GridToolbar
        leading={toolbarLeading}
        trailing={toolbarTrailing}
        filters={filters}
        onFiltersChange={setFilters}
        columns={toggleableColumns}
        onToggleColumn={(id) => setColumnVisibility((v) => ({ ...v, [id]: v[id] === false }))}
        density={density}
        onDensityChange={setDensity}
        onCopy={copySelection}
        selectedCount={selectedIds.length}
        totalCount={filteredRows.length}
        onDuplicateSelected={() => onDuplicateRows(selectedIds)}
        onDeleteSelected={() => onDeleteRows(selectedIds)}
      />
      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        <div style={{ width: totalWidth }}>
          <div className="sticky top-0 z-20 flex border-b border-border bg-muted/60 backdrop-blur-sm">
            {[...leftHeaders, ...centerHeaders].map((header) => {
              const pinned = header.column.getIsPinned();
              const isSmart = header.column.id.startsWith("sc:");
              return (
                <div
                  key={header.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (header.column.id !== "__select") setDragOverCol(header.column.id);
                  }}
                  onDragLeave={() => setDragOverCol((c) => (c === header.column.id ? null : c))}
                  onDrop={() => handleDrop(header.column.id)}
                  style={{
                    width: header.getSize(),
                    ...(pinned === "left" ? { position: "sticky", left: header.column.getStart("left"), zIndex: 21 } : {}),
                  }}
                  className={cn(
                    "group/head relative flex h-10 shrink-0 select-none items-center border-r border-border bg-muted/95 px-2.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-colors last:border-r-0",
                    dragOverCol === header.column.id && "bg-primary/10",
                    pinned && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]",
                    isSmart && "bg-[color-mix(in_oklab,var(--muted)_88%,var(--aurora-b)_12%)]",
                  )}
                >
                  {isSmart && <span className="bg-aurora pointer-events-none absolute inset-x-0 top-0 h-[2px]" aria-hidden />}
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.id !== "__select" && (
                    <div
                      draggable={false}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        beginResize(e, header);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        beginResize(e, header);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-0 z-10 flex h-full w-2.5 cursor-col-resize items-center justify-center"
                    >
                      <div className="h-full w-px bg-border transition-colors group-hover/head:bg-border-strong/60" />
                      <div className="absolute h-full w-1 rounded-full bg-transparent transition-colors hover:bg-primary/50" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = tableRows[vi.index];
              const inSelection = row.getIsSelected() && selectedIds.length > 1;
              const targetIds = inSelection ? selectedIds : [row.id];
              const overrideHeight = rowHeightOverrides[row.id];
              return (
                <ContextMenu key={row.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      data-index={vi.index}
                      ref={virtualizer.measureElement}
                      className={cn(
                        "group absolute left-0 top-0 flex w-full border-b border-border transition-colors hover:bg-muted/40",
                        row.getIsSelected() && "bg-primary/[0.06] hover:bg-primary/[0.08]",
                      )}
                      style={{ minHeight: overrideHeight ?? rowHeight, transform: `translateY(${vi.start}px)` }}
                    >
                      {row.getIsSelected() && <div className="absolute inset-y-0 left-0 z-10 w-0.5 bg-primary" aria-hidden />}
                      {[...row.getLeftVisibleCells(), ...row.getCenterVisibleCells()].map((cell) => {
                        const pinned = cell.column.getIsPinned();
                        return (
                          <div
                            key={cell.id}
                            style={{
                              width: cell.column.getSize(),
                              ...(pinned === "left" ? { position: "sticky", left: cell.column.getStart("left"), zIndex: 10 } : {}),
                            }}
                            className={cn(
                              "flex shrink-0 items-center overflow-hidden border-r border-border/70 px-2.5 last:border-r-0",
                              pinned
                                ? cn("bg-surface", row.getIsSelected() ? "bg-primary/[0.06]" : "group-hover:bg-muted/40", "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]")
                                : undefined,
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        );
                      })}
                      <div
                        onMouseDown={(e) => beginRowResize(e, row.id, overrideHeight ?? rowHeight)}
                        className="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-row-resize opacity-0 transition-opacity hover:bg-primary/40 group-hover:opacity-100"
                      />
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => onInsertRow(row.id, "above")}>
                      <ArrowUpToLine className="h-3.5 w-3.5" /> Insert row above
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => onInsertRow(row.id, "below")}>
                      <ArrowDownToLine className="h-3.5 w-3.5" /> Insert row below
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => onDuplicateRows(targetIds)}>
                      <Copy className="h-3.5 w-3.5" /> Duplicate row{targetIds.length > 1 ? `s (${targetIds.length})` : ""}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() => onDeleteRows(targetIds)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete row{targetIds.length > 1 ? `s (${targetIds.length})` : ""}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>
      </div>
      {resizeGuide && (
        <div
          className="pointer-events-none fixed z-50 w-0.5 bg-primary"
          style={{ left: resizeGuide.x, top: resizeGuide.top, height: resizeGuide.bottom - resizeGuide.top }}
        />
      )}
      {rowResizeGuide && (
        <div
          className="pointer-events-none fixed z-50 h-0.5 bg-primary"
          style={{ top: rowResizeGuide.y, left: rowResizeGuide.left, width: rowResizeGuide.right - rowResizeGuide.left }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{filteredRows.length.toLocaleString()}</span> of {(pagination?.totalRows ?? rows.length).toLocaleString()} rows
        </span>
        {pagination && (
          <GridPaginationControls pagination={pagination} />
        )}
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> {smartColumns.length} Smart Column{smartColumns.length === 1 ? "" : "s"}
        </span>
      </div>

      <Modal
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        title={`Insert column ${insertColumnRequest?.position ?? ""}`}
        description="Inserts a new empty column at this position."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newColumnName.trim();
            if (!name || !insertColumnRequest) return;
            onInsertColumn(name, insertColumnRequest.anchorId, insertColumnRequest.position);
            setNewColumnName("");
            setInsertColumnRequest(null);
            setAddColumnOpen(false);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-col-name">Column name</Label>
            <Input id="new-col-name" value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="e.g. Notes" autoFocus />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAddColumnOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newColumnName.trim()}>
              Insert column
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function GridPaginationControls({ pagination }: { pagination: GridPagination }) {
  const { page, pageSize, totalRows, onPageChange, onPageSizeChange } = pagination;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const start = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalRows, page * pageSize);
  const range = paginationRange(page, totalPages);

  return (
    <div className="flex items-center gap-4">
      <span className="text-xs text-muted-foreground">
        {start.toLocaleString()}–{end.toLocaleString()} of {totalRows.toLocaleString()}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="hidden text-xs text-muted-foreground sm:inline">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-7 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {[100, 200, 500, 1000].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              className="h-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            />
          </PaginationItem>
          {range.map((p, i) =>
            p === "ellipsis" ? (
              <PaginationItem key={`e${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink className="h-7 w-7" isActive={p === page} onClick={() => onPageChange(p)}>
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              className="h-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function SortIcon({ dir, index }: { dir: false | "asc" | "desc"; index?: number }) {
  if (!dir) return <ArrowUp className="h-3 w-3 shrink-0 text-transparent transition-colors group-hover/head:text-muted-foreground/40" />;
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-primary">
      {dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {index !== undefined && index >= 0 && <span className="text-[9px] font-semibold tabular-nums">{index + 1}</span>}
    </span>
  );
}

function SourceHeader({
  sortDir,
  sortIndex,
  onToggleSort,
  onDragHandleStart,
  actions,
}: {
  sortDir: false | "asc" | "desc";
  sortIndex: number;
  onToggleSort: (e: React.MouseEvent) => void;
  onDragHandleStart: () => void;
  actions: SourceColumnMenuActions;
}) {
  return (
    <SourceColumnContextMenu actions={actions}>
      <div className="flex w-full min-w-0 items-center gap-1.5">
        <span draggable onDragStart={onDragHandleStart} className="shrink-0">
          <GripVertical className="h-3 w-3 cursor-grab text-muted-foreground/50 transition-colors hover:text-muted-foreground" />
        </span>
        <button
          type="button"
          onClick={onToggleSort}
          onDoubleClick={(e) => {
            e.stopPropagation();
            actions.onRename();
          }}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
          title="Double-click to rename"
        >
          <span className="truncate transition-colors group-hover/head:text-foreground">{actions.name}</span>
          <SortIcon dir={sortDir} index={sortIndex} />
        </button>
        <div className="ml-auto shrink-0">
          <SourceColumnMenu {...actions} />
        </div>
      </div>
    </SourceColumnContextMenu>
  );
}

function ColumnRenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="h-7 w-full min-w-0 rounded-sm border-none bg-background px-1.5 text-xs font-medium text-foreground outline-none ring-2 ring-primary/50"
    />
  );
}

function SmartHeader({
  smartColumn,
  filterOpen,
  sortDir,
  sortIndex,
  onToggleSort,
  onDragHandleStart,
  onOpenFilter,
  onCloseFilter,
  labelOptions,
  filterValue,
  onFilterChange,
  actions,
}: {
  smartColumn: WorkbenchSmartColumnDto;
  filterOpen: boolean;
  sortDir: false | "asc" | "desc";
  sortIndex: number;
  onToggleSort: (e: React.MouseEvent) => void;
  onDragHandleStart: () => void;
  onOpenFilter: () => void;
  onCloseFilter: () => void;
  labelOptions: string[];
  filterValue: import("./filters").SmartColumnFilter;
  onFilterChange: (next: import("./filters").SmartColumnFilter) => void;
  actions: SmartColumnMenuActions;
}) {
  const hasActiveFilter = Boolean(filterValue.labels?.length || filterValue.minConfidence !== undefined || filterValue.maxConfidence !== undefined);
  return (
    <SmartColumnContextMenu actions={actions}>
      <div className="flex w-full min-w-0 items-center gap-1">
        <span draggable onDragStart={onDragHandleStart} className="shrink-0">
          <GripVertical className="h-3 w-3 cursor-grab text-muted-foreground/50 transition-colors hover:text-muted-foreground" />
        </span>
        <button type="button" onClick={onToggleSort} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left">
          <span className="bg-aurora flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] text-[#0b0b0c]">
            <Sparkles className="h-2.5 w-2.5" />
          </span>
          <span className="truncate font-semibold text-foreground">{smartColumn.name}</span>
          <SortIcon dir={sortDir} index={sortIndex} />
        </button>
        <SmartColumnFilterPopover
          open={filterOpen}
          onOpenChange={(o) => (o ? onOpenFilter() : onCloseFilter())}
          labels={labelOptions}
          value={filterValue}
          onChange={onFilterChange}
          anchor={
            <button
              onClick={onOpenFilter}
              className={cn(
                "shrink-0 rounded-sm p-0.5 transition-colors hover:bg-muted hover:text-foreground",
                hasActiveFilter ? "text-primary" : "text-muted-foreground",
              )}
              aria-label={`Filter ${smartColumn.name}`}
            >
              <Filter className="h-3 w-3" />
            </button>
          }
        />
        <div className="ml-auto shrink-0">
          <SmartColumnHeaderMenu {...actions} />
        </div>
      </div>
    </SmartColumnContextMenu>
  );
}
