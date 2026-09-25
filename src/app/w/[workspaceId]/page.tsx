"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowRight,
  Database,
  FileSpreadsheet,
  History,
  Plus,
  Sparkles,
  Upload,
  Flag,
  CheckCircle2,
  KeyRound,
  Pencil,
  Trash2,
} from "lucide-react";
import { useWorkspace, useWorkspaceChanges } from "@/hooks/use-workspaces";
import { useDatasets } from "@/hooks/use-datasets";
import { useJobs } from "@/hooks/use-jobs";
import { useModels } from "@/hooks/use-models";
import { useGreeting } from "@/hooks/use-greeting";
import { isJobActive } from "@/hooks/use-job";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { StatTile } from "@/components/workspace/stat-tile";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { UploadModal } from "@/components/upload/upload-modal";
import { useDeleteDatasetWithConfirm } from "@/components/workspace/use-delete-dataset";
import { useRenameDatasetDialog } from "@/components/workspace/rename-dataset-modal";
import { useJobsDrawer } from "@/components/jobs/jobs-drawer-context";
import { TYPE_LABEL } from "@/components/insights/smart-column-insight-card";
import { cn } from "@/lib/utils";


function SectionTitle({ index, children, action }: { index: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="flex items-baseline gap-2.5 font-display text-xl font-semibold">
        <span className="font-mono text-[11px] font-normal tracking-normal text-muted-foreground">{index}</span>
        {children}
      </h2>
      {action}
    </div>
  );
}

export default function WorkspaceOverviewPage({ params }: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { setDatasetId } = useDatasetContext();
  const { data: wsData, isLoading: wsLoading } = useWorkspace(workspaceId);
  const { data: datasetsData, isLoading: datasetsLoading } = useDatasets(workspaceId);
  const { data: jobsData } = useJobs(workspaceId);
  const { data: changesData } = useWorkspaceChanges(workspaceId);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const greetingText = useGreeting();
  const deleteDataset = useDeleteDatasetWithConfirm(workspaceId);
  const [openRename, renameDialog] = useRenameDatasetDialog(workspaceId);
  const { openJobsDrawer } = useJobsDrawer();
  const { data: modelsData } = useModels();
  const noModelConnected = modelsData ? !modelsData.providers.some((p) => p.available) : false;

  const datasets = datasetsData?.datasets ?? [];
  const jobs = jobsData?.jobs ?? [];
  const changes = changesData?.changes ?? [];
  const isLoading = wsLoading || datasetsLoading;

  const totalSmartColumns = datasets.reduce((sum, d) => sum + d._count.smartColumns, 0);
  const totalRows = datasets.reduce((sum, d) => sum + d.rowCount, 0);
  const totalNeedsReview = datasets.reduce((sum, d) => sum + d.smartColumns.reduce((s, sc) => s + sc.needsReview, 0), 0);
  const columnsNeedingReview = datasets.reduce((sum, d) => sum + d.smartColumns.filter((sc) => sc.needsReview > 0).length, 0);
  const activeJobCount = jobs.filter((j) => isJobActive(j.status)).length;

  const smartColumns = datasets.flatMap((d) =>
    d.smartColumns.map((sc) => ({ ...sc, datasetId: d.id, datasetFilename: d.filename })),
  );

  function openDataset(id: string) {
    setDatasetId(id);
    router.push(`/w/${workspaceId}/data`);
  }

  function openSmartColumn(datasetId: string) {
    setDatasetId(datasetId);
    router.push(`/w/${workspaceId}/insights`);
  }

  function openReview(datasetId: string, smartColumnId?: string) {
    setDatasetId(datasetId);
    router.push(`/w/${workspaceId}/review${smartColumnId ? `?sc=${smartColumnId}` : ""}`);
  }

  const firstNeedingReview = smartColumns.find((sc) => sc.needsReview > 0);

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 md:px-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div className="min-w-0">
          <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_8px_var(--signal)]" aria-hidden />
            {greetingText}
          </p>
          {isLoading ? (
            <Skeleton className="h-14 w-80" />
          ) : (
            <h1 className="font-display text-5xl font-semibold leading-[0.95] sm:text-6xl">
              {wsData?.workspace.name ?? "Workspace"}
              <span className="text-aurora">.</span>
            </h1>
          )}
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            {wsData?.workspace.description ?? (
              <>
                Ask your spreadsheet questions. Get <span className="font-accent text-base text-foreground">calibrated</span> answers, row by row.
              </>
            )}
          </p>
        </div>
        <Button size="lg" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" /> Upload dataset
        </Button>
      </motion.div>

      {noModelConnected && (
        <Link
          href={`/w/${workspaceId}/settings`}
          className="group -mt-4 flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning-muted px-4 py-3 text-sm text-warning transition-shadow hover:shadow-flat"
        >
          <KeyRound className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            <span className="font-medium">No model connected.</span> Add a TypeSafe API key or a Laya server in Settings to generate Smart Columns.
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Database}
          label="Datasets"
          value={datasets.length}
          loading={isLoading}
          delay={0}
          hint={`${totalRows.toLocaleString()} row${totalRows === 1 ? "" : "s"} total`}
        />
        <StatTile icon={Sparkles} label="Smart Columns" value={totalSmartColumns} loading={isLoading} delay={0.05} tone="ai" hint="Questions your data can answer" />
        <StatTile
          icon={Flag}
          label="Needs review"
          value={totalNeedsReview.toLocaleString()}
          loading={isLoading}
          delay={0.1}
          tone={totalNeedsReview > 0 ? "warning" : undefined}
          hint={
            totalNeedsReview > 0
              ? columnsNeedingReview === 1
                ? "In 1 column, below its review threshold"
                : `Across ${columnsNeedingReview} columns, below their thresholds`
              : "Nothing waiting on a human"
          }
          onClick={firstNeedingReview ? () => openReview(firstNeedingReview.datasetId, firstNeedingReview.id) : undefined}
        />
        <StatTile
          icon={Activity}
          label="Active jobs"
          value={activeJobCount}
          loading={isLoading}
          delay={0.15}
          tone={activeJobCount > 0 ? "primary" : undefined}
          hint={activeJobCount > 0 ? "Model is thinking… · click for live progress" : "All quiet · click for job history"}
          onClick={openJobsDrawer}
        />
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle
          index="01"
          action={
            datasets.length > 0 && (
              <Link href={`/w/${workspaceId}/data`} className="group flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                View all <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )
          }
        >
          Datasets
        </SectionTitle>

        {isLoading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        )}

        {!isLoading && datasets.length === 0 && (
          <EmptyState
            icon={Upload}
            title="No datasets yet"
            description="Upload a CSV, XLSX, JSON, or JSONL file to start building Smart Columns."
            action={
              <Button onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4" /> Upload your first dataset
              </Button>
            }
          />
        )}

        {!isLoading && datasets.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {datasets.slice(0, 6).map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.25 }}>
                <div className="group relative">
                  <Card className="transition-all group-hover:-translate-y-0.5 group-hover:shadow-hover">
                    <button onClick={() => openDataset(d.id)} className="absolute inset-0 z-0 rounded-2xl" aria-label={`Open ${d.filename}`} />
                    <CardContent className="pointer-events-none relative flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-all group-hover:rotate-[-6deg] group-hover:bg-signal group-hover:text-signal-foreground">
                          <FileSpreadsheet className="h-4 w-4" />
                        </div>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{d.filename}</p>
                        <button
                          onClick={() => openRename({ id: d.id, filename: d.filename })}
                          className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label={`Rename ${d.filename}`}
                          title="Rename dataset"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            deleteDataset({ id: d.id, filename: d.filename, rowCount: d.rowCount, smartColumnCount: d._count.smartColumns })
                          }
                          className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-danger-muted hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label={`Delete ${d.filename}`}
                          title="Delete dataset"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                        <span>{d.rowCount.toLocaleString()} rows</span>
                        <span>·</span>
                        <span>{d.columnCount} cols</span>
                        {d._count.smartColumns > 0 && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1 text-primary">
                              <Sparkles className="h-3 w-3" /> {d._count.smartColumns}
                            </span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {smartColumns.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle
            index="02"
            action={
              <Link href={`/w/${workspaceId}/insights`} className="group flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                View insights <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            }
          >
            Smart Columns
          </SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {smartColumns.slice(0, 6).map((sc, i) => (
              <motion.div key={sc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.25 }}>
                <div className="group relative">
                  <Card className="ring-aurora border-transparent transition-all group-hover:-translate-y-0.5 group-hover:shadow-hover">
                    {/* Stretched button: the whole card opens Insights, while
                     * the review chip below sits above it as its own link. */}
                    <button
                      onClick={() => openSmartColumn(sc.datasetId)}
                      className="absolute inset-0 z-0 rounded-2xl"
                      aria-label={`Open insights for ${sc.name}`}
                    />
                    <CardContent className="pointer-events-none relative flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-aurora text-[#0b0b0c] transition-transform group-hover:rotate-12">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{sc.name}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge tone="muted">{TYPE_LABEL[sc.type] ?? sc.type}</Badge>
                        <span className="min-w-0 truncate">on {sc.datasetFilename}</span>
                        {!sc.activeVersionId && (
                          <>
                            <span>·</span>
                            <span className="text-warning">not generated</span>
                          </>
                        )}
                      </div>
                      {sc.activeVersionId && (
                        <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-2.5">
                          {sc.needsReview > 0 ? (
                            <button
                              onClick={() => openReview(sc.datasetId, sc.id)}
                              className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-warning-muted px-2.5 py-1 text-xs font-medium text-warning transition-transform hover:scale-[1.03]"
                            >
                              <Flag className="h-3 w-3" />
                              {sc.needsReview.toLocaleString()} need{sc.needsReview === 1 ? "s" : ""} review
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-success">
                              <CheckCircle2 className="h-3 w-3" /> All clear
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-muted-foreground">&lt; {Math.round(sc.reviewThreshold * 100)}% conf.</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {(jobs.length > 0 || changes.length > 0) && (
        <section className={cn("grid grid-cols-1 gap-4", jobs.length > 0 && changes.length > 0 && "lg:grid-cols-2")}>
          {jobs.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionTitle index="03">Recent activity</SectionTitle>
              <Card>
                <CardContent className="flex flex-col divide-y divide-border px-0 py-0">
                  {jobs.slice(0, 5).map((job) => (
                    <Link
                      key={job.id}
                      href={`/w/${workspaceId}/jobs/${job.id}`}
                      className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                      title={isJobActive(job.status) ? "Open live progress" : "Open run log"}
                    >
                      <JobStatusBadge status={job.status} />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{job.smartColumn?.name ?? "Smart Column"}</span>
                        <span className="text-muted-foreground"> on {job.dataset?.filename ?? "dataset"}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {changes.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionTitle index="04">Recent data changes</SectionTitle>
              <Card>
                <CardContent className="flex flex-col divide-y divide-border px-0 py-0">
                  {changes.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className={cn("min-w-0 flex-1 truncate", c.undone && "text-muted-foreground line-through")}>
                        <span className="font-medium">{c.summary}</span>
                        <span className="text-muted-foreground"> on {c.datasetFilename}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      )}

      <UploadModal workspaceId={workspaceId} open={uploadOpen} onOpenChange={setUploadOpen} />
      {renameDialog}
    </div>
    </div>
  );
}

