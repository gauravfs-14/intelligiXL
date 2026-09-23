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
  BarChart3,
  Database,
  FileSpreadsheet,
  LayoutTemplate,
  ListChecks,
  Plus,
  Rows3,
  Sparkles,
  Upload,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspaces";
import { useDatasets } from "@/hooks/use-datasets";
import { useJobs } from "@/hooks/use-jobs";
import { isJobActive } from "@/hooks/use-job";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { UploadModal } from "@/components/upload/upload-modal";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function WorkspaceOverviewPage({ params }: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { setDatasetId } = useDatasetContext();
  const { data: wsData, isLoading: wsLoading } = useWorkspace(workspaceId);
  const { data: datasetsData, isLoading: datasetsLoading } = useDatasets(workspaceId);
  const { data: jobsData } = useJobs(workspaceId);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const datasets = datasetsData?.datasets ?? [];
  const jobs = jobsData?.jobs ?? [];
  const isLoading = wsLoading || datasetsLoading;

  const totalSmartColumns = datasets.reduce((sum, d) => sum + d._count.smartColumns, 0);
  const totalRows = datasets.reduce((sum, d) => sum + d.rowCount, 0);
  const activeJobCount = jobs.filter((j) => isJobActive(j.status)).length;

  function openDataset(id: string) {
    setDatasetId(id);
    router.push(`/w/${workspaceId}/data`);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:px-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-8 w-64" />
          ) : (
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{wsData?.workspace.name ?? "Workspace"}</h1>
          )}
          {wsData?.workspace.description && <p className="mt-1 text-sm text-muted-foreground">{wsData.workspace.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/w/${workspaceId}/templates`)}>
            <LayoutTemplate className="h-4 w-4" /> Templates
          </Button>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" /> Upload dataset
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Database} label="Datasets" value={datasets.length} loading={isLoading} delay={0} />
        <StatCard icon={Sparkles} label="Smart Columns" value={totalSmartColumns} loading={isLoading} delay={0.05} tone="primary" />
        <StatCard icon={Rows3} label="Total rows" value={totalRows.toLocaleString()} loading={isLoading} delay={0.1} />
        <StatCard icon={Activity} label="Active jobs" value={activeJobCount} loading={isLoading} delay={0.15} tone={activeJobCount > 0 ? "primary" : undefined} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Datasets</h2>
          {datasets.length > 0 && (
            <Link href={`/w/${workspaceId}/data`} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

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
                <button onClick={() => openDataset(d.id)} className="group block w-full text-left">
                  <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover">
                    <CardContent className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                          <FileSpreadsheet className="h-4 w-4" />
                        </div>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{d.filename}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {jobs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Recent activity</h2>
          <Card>
            <CardContent className="flex flex-col divide-y divide-border px-0 py-0">
              {jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <JobStatusBadge status={job.status} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{job.smartColumn?.name ?? "Smart Column"}</span>
                    <span className="text-muted-foreground"> on {job.dataset?.filename ?? "dataset"}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLink href={`/w/${workspaceId}/insights`} icon={BarChart3} title="Insights" description="Distributions & cross-column comparisons" />
        <QuickLink href={`/w/${workspaceId}/review`} icon={ListChecks} title="Review Queue" description="Confirm or correct uncertain predictions" />
        <QuickLink href={`/w/${workspaceId}/templates`} icon={LayoutTemplate} title="Templates" description="Reusable Smart Column recipes" />
      </section>

      <UploadModal workspaceId={workspaceId} open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  delay,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  loading: boolean;
  delay: number;
  tone?: "primary";
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.25 }}>
      <Card>
        <CardContent className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            {loading ? <Skeleton className="mt-1 h-5 w-10" /> : <p className="text-lg font-semibold tabular-nums">{value}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
            <CardTitle className="text-sm">{title}</CardTitle>
            <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
