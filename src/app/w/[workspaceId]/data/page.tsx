"use client";

import * as React from "react";
import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, Download, Undo2, Redo2, Sparkles } from "lucide-react";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  useAddColumn,
  useCreateRows,
  useDatasetChanges,
  useDatasets,
  useDeleteColumn,
  useDeleteRows,
  useDuplicateColumn,
  useRedoChange,
  useRenameColumn,
  useUndoChange,
  useUpdateRow,
  useWorkbench,
} from "@/hooks/use-datasets";
import { useDeleteSmartColumn, useGenerateSmartColumn, useRetrySmartColumn } from "@/hooks/use-smart-columns";
import { useUpsertReview } from "@/hooks/use-reviews";
import { useTelemetry } from "@/hooks/use-telemetry";
import { UploadModal } from "@/components/upload/upload-modal";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DatasetSwitcher } from "@/components/workspace/dataset-switcher";
import { JobBanners } from "@/components/data-grid/job-progress-banner";
import { ExportModal } from "@/components/data-grid/export-modal";
import { SmartColumnBuilderModal } from "@/components/smart-column-builder/builder-modal";
import { ViewConfigModal } from "@/components/smart-column-builder/view-config-modal";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import type { BuilderState } from "@/components/smart-column-builder/types";

export default function DataPage({ params }: PageProps<"/w/[workspaceId]/data">) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { datasetId } = useDatasetContext();
  const { data: datasetsData, isLoading: datasetsLoading } = useDatasets(workspaceId);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(200);
  const { data: workbench, isLoading, isError, refetch } = useWorkbench(datasetId ?? undefined, { page, pageSize });
  const [exportOpen, setExportOpen] = React.useState(false);
  const { data: fullWorkbench, isLoading: fullWorkbenchLoading } = useWorkbench(datasetId ?? undefined, undefined, exportOpen);
  const track = useTelemetry(workspaceId);

  const [uploadOpen, setUploadOpen] = React.useState(searchParams.get("upload") === "1");
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [templateSeed, setTemplateSeed] = React.useState<Partial<BuilderState> | null>(null);
  const [viewConfigId, setViewConfigId] = React.useState<string | null>(null);

  const deleteSmartColumn = useDeleteSmartColumn(datasetId ?? "");
  const confirm = useConfirm();
  const generate = useGenerateSmartColumn(datasetId ?? "");
  const retry = useRetrySmartColumn(datasetId ?? "");
  const createRows = useCreateRows(datasetId ?? "");
  const updateRow = useUpdateRow(datasetId ?? "");
  const deleteRows = useDeleteRows(datasetId ?? "");
  const addColumn = useAddColumn(datasetId ?? "");
  const renameColumn = useRenameColumn(datasetId ?? "");
  const duplicateColumn = useDuplicateColumn(datasetId ?? "");
  const deleteColumn = useDeleteColumn(datasetId ?? "");
  const upsertReview = useUpsertReview(datasetId ?? "");
  const { data: changesData } = useDatasetChanges(datasetId ?? undefined);
  const undoChange = useUndoChange(datasetId ?? "");
  const redoChange = useRedoChange(datasetId ?? "");

  React.useEffect(() => setPage(1), [datasetId]);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem("intelligixl:pending-template");
      if (raw) {
        setTemplateSeed(JSON.parse(raw));
        sessionStorage.removeItem("intelligixl:pending-template");
        setBuilderOpen(true);
      }
    } catch {
      // sessionStorage unavailable — just skip the pending-template handoff.
    }
  }, []);

  const editing = workbench?.smartColumns.find((sc) => sc.id === editingId) ?? null;
  const viewConfigSmartColumn = workbench?.smartColumns.find((sc) => sc.id === viewConfigId) ?? null;

  function openBuilder() {
    setEditingId(null);
    setTemplateSeed(null);
    setBuilderOpen(true);
    track("smart_column_started", {});
  }

  const canUndo = changesData?.canUndo ?? false;
  const canRedo = changesData?.canRedo ?? false;

  const handleUndo = React.useCallback(async () => {
    if (!datasetId || !changesData?.canUndo) return;
    try {
      await undoChange.mutateAsync();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nothing to undo.");
    }
  }, [datasetId, changesData?.canUndo, undoChange]);

  const handleRedo = React.useCallback(async () => {
    if (!datasetId || !changesData?.canRedo) return;
    try {
      await redoChange.mutateAsync();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nothing to redo.");
    }
  }, [datasetId, changesData?.canRedo, redoChange]);

  // Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) to redo — standard
  // spreadsheet shortcuts, skipped while typing in a field so they don't
  // fight with normal text-undo inside an input/textarea/contenteditable.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: `Delete Smart Column “${name}”?`,
      details: ["Every version of its configuration", "All predictions and human reviews", "Its generation jobs and run logs"],
      confirmLabel: "Delete column",
    });
    if (!ok) return;
    try {
      await deleteSmartColumn.mutateAsync(id);
      toast.success(`"${name}" deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  async function handleRegenerate(id: string, name: string) {
    try {
      await generate.mutateAsync(id);
      toast.success(`Regenerating "${name}"…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start regeneration.");
    }
  }

  async function handleRetryFailed(id: string, name: string) {
    try {
      await retry.mutateAsync(id);
      toast.success(`Retrying failed rows for "${name}"…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't retry.");
    }
  }

  const hasDatasets = (datasetsData?.datasets.length ?? 0) > 0;

  return (
    <div className="relative flex h-full flex-col">
      <JobBanners workspaceId={workspaceId} currentDatasetId={datasetId} />

      {datasetsLoading && (
        <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-8">
          <TableSkeleton />
        </div>
      )}

      {!datasetsLoading && !hasDatasets && (
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 py-10 md:px-8">
          <EmptyState
            icon={UploadCloud}
            title="No datasets yet"
            description="Upload a CSV, XLSX, JSON, or JSONL file to get started."
            action={<Button onClick={() => setUploadOpen(true)}><UploadCloud className="h-4 w-4" /> Upload dataset</Button>}
          />
        </div>
      )}

      {!datasetsLoading && hasDatasets && !datasetId && (
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 py-10 md:px-8">
          <TableSkeleton />
        </div>
      )}

      {datasetId && isLoading && (
        <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-8">
          <TableSkeleton rows={12} cols={6} />
        </div>
      )}

      {datasetId && isError && (
        <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-8">
          <ErrorState description="Couldn't load this dataset." onRetry={() => refetch()} />
        </div>
      )}

      {workbench && (
        <>
          {workbench.dataset.warning && (
            <div className="border-b border-warning bg-warning-muted px-4 py-1.5 text-xs text-warning">{workbench.dataset.warning}</div>
          )}
          <div className="flex-1 overflow-hidden">
            <DataGrid
              toolbarLeading={<DatasetSwitcher workspaceId={workspaceId} />}
              toolbarTrailing={
                <>
                  <Button variant="ghost" size="sm" onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">
                    <Undo2 className="h-3.5 w-3.5" /> Undo
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">
                    <Redo2 className="h-3.5 w-3.5" /> Redo
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
                    <Download className="h-3.5 w-3.5" /> Export
                  </Button>
                  <Button
                    size="sm"
                    variant="ai"
                    onClick={workbench.dataset.columns.length > 0 ? openBuilder : () => toast.error("This dataset has no columns.")}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Add Smart Column
                  </Button>
                </>
              }
              columns={workbench.dataset.columns}
              rows={workbench.rows}
              smartColumns={workbench.smartColumns}
              predictions={workbench.predictions}
              onEditSmartColumn={(id) => {
                setEditingId(id);
                setBuilderOpen(true);
              }}
              onViewConfig={(id) => setViewConfigId(id)}
              onRegenerate={(id) => {
                const sc = workbench.smartColumns.find((s) => s.id === id);
                if (sc) handleRegenerate(id, sc.name);
              }}
              onRetryFailed={(id) => {
                const sc = workbench.smartColumns.find((s) => s.id === id);
                if (sc) handleRetryFailed(id, sc.name);
              }}
              onDeleteSmartColumn={(id) => {
                const sc = workbench.smartColumns.find((s) => s.id === id);
                if (sc) handleDelete(id, sc.name);
              }}
              onGoToReview={(id) => router.push(`/w/${workspaceId}/review?sc=${id}`)}
              onUpdateCell={(rowId, columnName, value) => {
                updateRow.mutate({ rowId, data: { [columnName]: value } }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save cell.") });
              }}
              onCorrectPrediction={(predictionId, value) =>
                upsertReview.mutate(
                  { predictionId, status: "CORRECTED", reviewedValue: value },
                  {
                    onSuccess: () => toast.success("Correction saved."),
                    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save correction."),
                  },
                )
              }
              onInsertRow={(anchorRowId, position) =>
                createRows.mutate(
                  { anchorRowId, position },
                  { onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't insert row.") },
                )
              }
              onDuplicateRows={(rowIds) =>
                createRows.mutate(
                  { duplicateOf: rowIds },
                  {
                    onSuccess: (res) => toast.success(`Duplicated ${res.rows.length} row${res.rows.length > 1 ? "s" : ""}.`),
                    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't duplicate row(s)."),
                  },
                )
              }
              onDeleteRows={async (rowIds) => {
                const n = rowIds.length;
                const ok = await confirm({
                  title: `Delete ${n} row${n > 1 ? "s" : ""}?`,
                  description: n > 1 ? "These rows and their Smart Column predictions will be removed." : "This row and its Smart Column predictions will be removed.",
                  note: "You can undo this with Undo (⌘Z / Ctrl+Z) or from the change log.",
                  confirmLabel: `Delete row${n > 1 ? "s" : ""}`,
                });
                if (!ok) return;
                deleteRows.mutate(rowIds, {
                  onSuccess: (res) => toast.success(`Deleted ${res.deleted} row${res.deleted > 1 ? "s" : ""}.`),
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete row(s)."),
                });
              }}
              onInsertColumn={(name, anchorColumnId, position) =>
                addColumn.mutate(
                  { name, anchorColumnId, position },
                  {
                    onSuccess: () => toast.success(`Column "${name}" added.`),
                    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add column."),
                  },
                )
              }
              onRenameColumn={(columnId, name) =>
                renameColumn.mutate({ columnId, name }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't rename column.") })
              }
              onDuplicateColumn={(columnId) =>
                duplicateColumn.mutate(columnId, {
                  onSuccess: (res) => toast.success(`Added "${res.column.name}".`),
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't duplicate column."),
                })
              }
              onDeleteColumn={async (columnId) => {
                const name = workbench.dataset.columns.find((c) => c.id === columnId)?.name ?? "this column";
                const ok = await confirm({
                  title: `Delete column “${name}”?`,
                  description: "Its values in every row will be removed. Smart Columns that use it as a source will treat it as empty on their next run.",
                  note: "You can undo this with Undo (⌘Z / Ctrl+Z) or from the change log.",
                  confirmLabel: "Delete column",
                });
                if (!ok) return;
                deleteColumn.mutate(columnId, {
                  onSuccess: () => toast.success(`Column “${name}” deleted.`),
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete column."),
                });
              }}
              pagination={{
                page,
                pageSize,
                totalRows: workbench.totalRows ?? workbench.rows.length,
                onPageChange: setPage,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                },
              }}
            />
          </div>
        </>
      )}

      <UploadModal workspaceId={workspaceId} open={uploadOpen} onOpenChange={setUploadOpen} />

      {datasetId && workbench && (
        <>
          <SmartColumnBuilderModal
            open={builderOpen}
            onOpenChange={(o) => {
              setBuilderOpen(o);
              if (!o) {
                setEditingId(null);
                setTemplateSeed(null);
              }
            }}
            workspaceId={workspaceId}
            datasetId={datasetId}
            datasetColumns={workbench.dataset.columns}
            editing={editing}
            initialConfig={templateSeed}
          />
          <ViewConfigModal
            smartColumn={viewConfigSmartColumn}
            workspaceId={workspaceId}
            open={Boolean(viewConfigId)}
            onOpenChange={(o) => !o && setViewConfigId(null)}
          />
          <ExportModal
            open={exportOpen}
            onOpenChange={setExportOpen}
            workspaceId={workspaceId}
            dataset={workbench.dataset}
            rows={fullWorkbench?.rows ?? []}
            smartColumns={fullWorkbench?.smartColumns ?? workbench.smartColumns}
            predictionsByRow={fullWorkbench ? buildPredictionsByRow(fullWorkbench) : new Map()}
            loading={fullWorkbenchLoading || !fullWorkbench}
          />
        </>
      )}
    </div>
  );
}

function buildPredictionsByRow(workbench: NonNullable<ReturnType<typeof useWorkbench>["data"]>) {
  const versionToSmartColumn = new Map(workbench.smartColumns.filter((s) => s.activeVersion).map((s) => [s.activeVersion!.id, s.id]));
  const map = new Map<string, Map<string, (typeof workbench.predictions)[number]>>();
  for (const p of workbench.predictions) {
    const scId = versionToSmartColumn.get(p.smartColumnVersionId);
    if (!scId) continue;
    if (!map.has(p.datasetRowId)) map.set(p.datasetRowId, new Map());
    map.get(p.datasetRowId)!.set(scId, p);
  }
  return map;
}
