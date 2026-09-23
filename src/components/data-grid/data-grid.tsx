"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Filter, GripVertical, LayoutGrid, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ExpandableCell } from "./expandable-cell";
import { PredictionCell } from "./prediction-cell";
import { GridToolbar } from "./grid-toolbar";
import { SmartColumnHeaderMenu } from "./smart-column-header-menu";
import { SmartColumnFilterPopover } from "./smart-column-filter-popover";
import { applyFilters, EMPTY_FILTERS, type GridFilterState } from "./filters";
import { EmptyState } from "@/components/ui/states";
import type { DatasetColumnDto, DatasetRowDto, PredictionDto, WorkbenchSmartColumnDto } from "@/types/workbench";

interface RowShape {
  row: DatasetRowDto;
  predictions: Map<string, PredictionDto>;
}

const ROW_HEIGHT = 44;

export function DataGrid({
  columns: datasetColumns,
  rows,
  smartColumns,
  predictions,
  onAddSmartColumn,
  onExport,
  onEditSmartColumn,
  onViewConfig,
  onRegenerate,
  onRetryFailed,
  onDeleteSmartColumn,
  onGoToReview,
}: {
  columns: DatasetColumnDto[];
  rows: DatasetRowDto[];
  smartColumns: WorkbenchSmartColumnDto[];
  predictions: PredictionDto[];
  onAddSmartColumn: () => void;
  onExport: () => void;
  onEditSmartColumn: (smartColumnId: string) => void;
  onViewConfig: (smartColumnId: string) => void;
  onRegenerate: (smartColumnId: string) => void;
  onRetryFailed: (smartColumnId: string) => void;
  onDeleteSmartColumn: (smartColumnId: string) => void;
  onGoToReview: (smartColumnId: string) => void;
}) {
  const [filters, setFilters] = React.useState<GridFilterState>(EMPTY_FILTERS);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [confidenceVisible, setConfidenceVisible] = React.useState<Record<string, boolean>>({});
  const [openFilterFor, setOpenFilterFor] = React.useState<string | null>(null);
  const [dragCol, setDragCol] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);
  const [sortModeBySmartColumn, setSortModeBySmartColumn] = React.useState<Record<string, "label" | "confidence">>({});

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

  const columns = React.useMemo<ColumnDef<RowShape>[]>(() => {
    const select: ColumnDef<RowShape> = {
      id: "__select",
      size: 40,
      enableSorting: false,
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

    const source: ColumnDef<RowShape>[] = datasetColumns.map((col) => ({
      id: `col:${col.name}`,
      accessorFn: (r) => r.row.data[col.name],
      size: 220,
      header: ({ column }) => <SourceHeader name={col.name} sortDir={column.getIsSorted()} onSort={() => column.toggleSorting()} />,
      cell: ({ getValue }) => <ExpandableCell value={getValue()} />,
      sortingFn: (a, b) => {
        const av = a.original.row.data[col.name];
        const bv = b.original.row.data[col.name];
        return String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
      },
    }));

    const smart: ColumnDef<RowShape>[] = smartColumns.map((sc) => ({
      id: `sc:${sc.id}`,
      accessorFn: (r) => r.predictions.get(sc.id)?.predictedLabel ?? "",
      size: 200,
      header: ({ column }) => (
        <SmartHeader
          smartColumn={sc}
          showConfidence={confidenceVisible[sc.id] !== false}
          hasFailed={hasFailedBySmartColumn.get(sc.id) ?? false}
          filterOpen={openFilterFor === sc.id}
          sortDir={column.getIsSorted()}
          onOpenFilter={() => setOpenFilterFor(openFilterFor === sc.id ? null : sc.id)}
          onCloseFilter={() => setOpenFilterFor(null)}
          labelOptions={labelOptionsBySmartColumn.get(sc.id) ?? []}
          filterValue={filters.smartColumnFilters[sc.id] ?? {}}
          onFilterChange={(next) =>
            setFilters((f) => ({ ...f, smartColumnFilters: { ...f.smartColumnFilters, [sc.id]: next } }))
          }
          onSortLabel={(dir) => {
            setSortModeBySmartColumn((m) => ({ ...m, [sc.id]: "label" }));
            setSorting([{ id: `sc:${sc.id}`, desc: dir === "desc" }]);
          }}
          onSortConfidence={(dir) => {
            setSortModeBySmartColumn((m) => ({ ...m, [sc.id]: "confidence" }));
            setSorting([{ id: `sc:${sc.id}`, desc: dir === "desc" }]);
          }}
          onToggleConfidence={() => setConfidenceVisible((v) => ({ ...v, [sc.id]: v[sc.id] === false }))}
          onEdit={() => onEditSmartColumn(sc.id)}
          onViewConfig={() => onViewConfig(sc.id)}
          onRegenerate={() => onRegenerate(sc.id)}
          onRetryFailed={() => onRetryFailed(sc.id)}
          onDelete={() => onDeleteSmartColumn(sc.id)}
          onGoToReview={() => onGoToReview(sc.id)}
        />
      ),
      cell: ({ row }) => <PredictionCell prediction={row.original.predictions.get(sc.id)} showConfidence={confidenceVisible[sc.id] !== false} />,
      sortingFn: (a, b) => {
        const av = a.original.predictions.get(sc.id);
        const bv = b.original.predictions.get(sc.id);
        if ((sortModeBySmartColumn[sc.id] ?? "label") === "confidence") {
          return (av?.confidence ?? -1) - (bv?.confidence ?? -1);
        }
        return String(av?.predictedLabel ?? "").localeCompare(String(bv?.predictedLabel ?? ""));
      },
    }));

    return [select, ...source, ...smart];
  }, [
    datasetColumns,
    smartColumns,
    confidenceVisible,
    openFilterFor,
    labelOptionsBySmartColumn,
    filters.smartColumnFilters,
    hasFailedBySmartColumn,
    sortModeBySmartColumn,
    onEditSmartColumn,
    onViewConfig,
    onRegenerate,
    onRetryFailed,
    onDeleteSmartColumn,
    onGoToReview,
  ]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnOrder, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    getRowId: (r) => r.row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
  });

  const tableRows = table.getRowModel().rows;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const toggleableColumns = React.useMemo(
    () =>
      [...datasetColumns.map((c) => ({ id: `col:${c.name}`, label: c.name })), ...smartColumns.map((sc) => ({ id: `sc:${sc.id}`, label: sc.name }))].map(
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

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState icon={LayoutGrid} title="This dataset has no rows" description="Something went wrong during import." />
      </div>
    );
  }

  const selectedIds = Object.keys(rowSelection);

  return (
    <div className="flex h-full flex-col">
      <GridToolbar
        filters={filters}
        onFiltersChange={setFilters}
        columns={toggleableColumns}
        onToggleColumn={(id) => setColumnVisibility((v) => ({ ...v, [id]: v[id] === false }))}
        onAddSmartColumn={onAddSmartColumn}
        onExport={onExport}
        selectedCount={selectedIds.length}
        totalCount={filteredRows.length}
      />
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ width: table.getTotalSize() }}>
          <div className="sticky top-0 z-10 flex border-b border-border bg-muted/60 backdrop-blur-sm">
            {table.getHeaderGroups().map((hg) =>
              hg.headers.map((header) => (
                <div
                  key={header.id}
                  draggable={header.column.id !== "__select"}
                  onDragStart={() => setDragCol(header.column.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (header.column.id !== "__select") setDragOverCol(header.column.id);
                  }}
                  onDragLeave={() => setDragOverCol((c) => (c === header.column.id ? null : c))}
                  onDrop={() => handleDrop(header.column.id)}
                  style={{ width: header.getSize() }}
                  className={cn(
                    "group/head relative flex h-10 shrink-0 select-none items-center border-r border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors last:border-r-0",
                    dragOverCol === header.column.id && "bg-primary/10",
                  )}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize opacity-0 transition-opacity group-hover/head:opacity-100 hover:bg-primary/40"
                  />
                </div>
              )),
            )}
          </div>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = tableRows[vi.index];
              return (
                <div
                  key={row.id}
                  className={cn(
                    "group absolute left-0 top-0 flex w-full border-b border-border transition-colors hover:bg-muted/40",
                    row.getIsSelected() && "bg-primary/[0.06] hover:bg-primary/[0.08]",
                  )}
                  style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
                >
                  {row.getIsSelected() && <div className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="flex shrink-0 items-center overflow-hidden border-r border-border/70 px-2.5 last:border-r-0"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{filteredRows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} rows
        </span>
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> {smartColumns.length} Smart Column{smartColumns.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  if (!dir) return <ArrowUp className="h-3 w-3 shrink-0 text-transparent transition-colors group-hover/head:text-muted-foreground/40" />;
  return dir === "asc" ? (
    <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
  ) : (
    <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
  );
}

function SourceHeader({ name, sortDir, onSort }: { name: string; sortDir: false | "asc" | "desc"; onSort: () => void }) {
  return (
    <button type="button" onClick={onSort} className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 text-left">
      <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground/50 transition-colors hover:text-muted-foreground" onClick={(e) => e.stopPropagation()} />
      <span className="truncate transition-colors group-hover/head:text-foreground">{name}</span>
      <SortIcon dir={sortDir} />
    </button>
  );
}

function SmartHeader({
  smartColumn,
  showConfidence,
  hasFailed,
  filterOpen,
  sortDir,
  onOpenFilter,
  onCloseFilter,
  labelOptions,
  filterValue,
  onFilterChange,
  onSortLabel,
  onSortConfidence,
  onToggleConfidence,
  onEdit,
  onViewConfig,
  onRegenerate,
  onRetryFailed,
  onDelete,
  onGoToReview,
}: {
  smartColumn: WorkbenchSmartColumnDto;
  showConfidence: boolean;
  hasFailed: boolean;
  filterOpen: boolean;
  sortDir: false | "asc" | "desc";
  onOpenFilter: () => void;
  onCloseFilter: () => void;
  labelOptions: string[];
  filterValue: import("./filters").SmartColumnFilter;
  onFilterChange: (next: import("./filters").SmartColumnFilter) => void;
  onSortLabel: (dir: "asc" | "desc") => void;
  onSortConfidence: (dir: "asc" | "desc") => void;
  onToggleConfidence: () => void;
  onEdit: () => void;
  onViewConfig: () => void;
  onRegenerate: () => void;
  onRetryFailed: () => void;
  onDelete: () => void;
  onGoToReview: () => void;
}) {
  const hasActiveFilter = Boolean(filterValue.labels?.length || filterValue.minConfidence !== undefined || filterValue.maxConfidence !== undefined);
  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground/50 transition-colors hover:text-muted-foreground" />
      <Sparkles className="h-3 w-3 shrink-0 text-primary" />
      <span className="truncate font-medium text-primary">{smartColumn.name}</span>
      {sortDir && <SortIcon dir={sortDir} />}
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
        <SmartColumnHeaderMenu
          name={smartColumn.name}
          showConfidence={showConfidence}
          hasFailedPredictions={hasFailed}
          onFilter={onOpenFilter}
          onSortLabel={onSortLabel}
          onSortConfidence={onSortConfidence}
          onToggleConfidence={onToggleConfidence}
          onViewConfig={onViewConfig}
          onEdit={onEdit}
          onRegenerate={onRegenerate}
          onRetryFailed={onRetryFailed}
          onGoToReview={onGoToReview}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
