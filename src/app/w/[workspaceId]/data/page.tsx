"use client";

import * as React from "react";
import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { UploadCloud, Plus } from "lucide-react";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { useDatasets, useWorkbench } from "@/hooks/use-datasets";
import { useDeleteSmartColumn, useGenerateSmartColumn, useRetrySmartColumn } from "@/hooks/use-smart-columns";
import { useTelemetry } from "@/hooks/use-telemetry";
import { UploadModal } from "@/components/upload/upload-modal";
import { DataGrid } from "@/components/data-grid/data-grid";
import { JobProgressBanner } from "@/components/data-grid/job-progress-banner";
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
  const { data: workbench, isLoading, isError, refetch } = useWorkbench(datasetId ?? undefined);
  const track = useTelemetry(workspaceId);

  const [uploadOpen, setUploadOpen] = React.useState(searchParams.get("upload") === "1");
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [templateSeed, setTemplateSeed] = React.useState<Partial<BuilderState> | null>(null);
  const [viewConfigId, setViewConfigId] = React.useState<string | null>(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [activeJobs, setActiveJobs] = React.useState<{ jobId: string; name: string }[]>([]);

  const deleteSmartColumn = useDeleteSmartColumn(datasetId ?? "");
  const generate = useGenerateSmartColumn(datasetId ?? "");
  const retry = useRetrySmartColumn(datasetId ?? "");

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

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete Smart Column "${name}"? All predictions and reviews for it will be removed.`)) return;
    try {
      await deleteSmartColumn.mutateAsync(id);
      toast.success(`"${name}" deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  async function handleRegenerate(id: string, name: string) {
    try {
      const { job } = await generate.mutateAsync(id);
      setActiveJobs((jobs) => [...jobs, { jobId: job.id, name }]);
      toast.success(`Regenerating "${name}"…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start regeneration.");
    }
  }

  async function handleRetryFailed(id: string, name: string) {
    try {
      const { job } = await retry.mutateAsync(id);
      setActiveJobs((jobs) => [...jobs, { jobId: job.id, name: `${name} (retry)` }]);
      toast.success(`Retrying failed rows for "${name}"…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't retry.");
    }
  }

  const hasDatasets = (datasetsData?.datasets.length ?? 0) > 0;

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)] flex-col">
      <AnimatePresence>
        {activeJobs.map((j) => (
          <JobProgressBanner
            key={j.jobId}
            jobId={j.jobId}
            name={j.name}
            datasetId={datasetId ?? ""}
            onDismiss={() => setActiveJobs((jobs) => jobs.filter((x) => x.jobId !== j.jobId))}
          />
        ))}
      </AnimatePresence>

      {datasetsLoading && (
        <div className="p-6">
          <TableSkeleton />
        </div>
      )}

      {!datasetsLoading && !hasDatasets && (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={UploadCloud}
            title="No datasets yet"
            description="Upload a CSV, XLSX, JSON, or JSONL file to get started."
            action={<Button onClick={() => setUploadOpen(true)}><UploadCloud className="h-4 w-4" /> Upload dataset</Button>}
          />
        </div>
      )}

      {!datasetsLoading && hasDatasets && !datasetId && (
        <div className="flex flex-1 items-center justify-center p-6">
          <TableSkeleton />
        </div>
      )}

      {datasetId && isLoading && (
        <div className="p-6">
          <TableSkeleton rows={12} cols={6} />
        </div>
      )}

      {datasetId && isError && (
        <div className="p-6">
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
              columns={workbench.dataset.columns}
              rows={workbench.rows}
              smartColumns={workbench.smartColumns}
              predictions={workbench.predictions}
              onAddSmartColumn={workbench.dataset.columns.length > 0 ? openBuilder : () => toast.error("This dataset has no columns.")}
              onExport={() => setExportOpen(true)}
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
            onGenerated={(jobId, name) => setActiveJobs((jobs) => [...jobs, { jobId, name }])}
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
            rows={workbench.rows}
            smartColumns={workbench.smartColumns}
            predictionsByRow={buildPredictionsByRow(workbench)}
          />
        </>
      )}

      {hasDatasets && !builderOpen && datasetId && workbench && workbench.smartColumns.length === 0 && (
        <div className="pointer-events-none absolute bottom-6 right-6">
          <Button onClick={openBuilder} className="pointer-events-auto shadow-flat">
            <Plus className="h-4 w-4" /> Add your first Smart Column
          </Button>
        </div>
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
