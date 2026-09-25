"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Plus, FolderOpen, Trash2, Database, ArrowRight, FolderKanban, Layers } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { toast } from "sonner";
import { useCreateWorkspace, useDeleteWorkspace, useWorkspaces } from "@/hooks/use-workspaces";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useGreeting } from "@/hooks/use-greeting";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { StatTile } from "@/components/workspace/stat-tile";
import { ThemeToggle } from "@/components/theme-toggle";


export default function WorkspacesPage() {
  const { data, isLoading, isError, refetch } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const confirm = useConfirm();
  const greetingText = useGreeting();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const workspaces = data?.workspaces ?? [];
  const totalDatasets = workspaces.reduce((sum, w) => sum + (w._count?.datasets ?? 0), 0);
  const totalSmartColumns = workspaces.reduce((sum, w) => sum + (w._count?.smartColumns ?? 0), 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createWorkspace.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
      toast.success(`Workspace "${name.trim()}" created.`);
      setModalOpen(false);
      setName("");
      setDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace.");
    }
  }

  async function handleDelete(id: string, wsName: string) {
    const ws = workspaces.find((w) => w.id === id);
    const n = (count: number | undefined, word: string) => `${count ?? 0} ${word}${count === 1 ? "" : "s"}`;
    const ok = await confirm({
      title: `Delete workspace “${wsName}”?`,
      description: "Everything inside it is permanently deleted:",
      details: [
        `${n(ws?._count?.datasets, "dataset")}, including uploaded files and exports`,
        `${n(ws?._count?.smartColumns, "Smart Column")}, with every prediction and review`,
        "Templates saved in this workspace, jobs and history",
      ],
      confirmText: wsName,
      confirmLabel: "Delete workspace",
    });
    if (!ok) return;
    try {
      await deleteWorkspace.mutateAsync(id);
      toast.success(`Workspace "${wsName}" deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete workspace.");
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/60 px-5 backdrop-blur-xl">
        <Wordmark />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Workspace
          </Button>
        </div>
      </header>

      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-8 overflow-y-auto px-6 py-12 md:px-10">
        <div>
          <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_8px_var(--signal)]" aria-hidden />
            {greetingText}
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[0.95] sm:text-6xl">
            Your <span className="font-accent font-normal">workspaces</span>
            <span className="text-aurora">.</span>
          </h1>
        </div>

        {isError && <ErrorState description="Couldn't load workspaces." onRetry={() => refetch()} />}

        {!isError && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile icon={FolderKanban} label="Workspaces" value={workspaces.length} loading={isLoading} delay={0} />
            <StatTile icon={Database} label="Datasets" value={totalDatasets} loading={isLoading} delay={0.05} />
            <StatTile icon={Layers} label="Smart Columns" value={totalSmartColumns} loading={isLoading} delay={0.1} tone="ai" />
          </div>
        )}

        {isLoading && <TableSkeleton rows={3} cols={1} />}

        {data && data.workspaces.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="No workspaces yet"
            description="A Workspace holds your datasets, Smart Columns, and results."
            action={
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" /> Create your first workspace
              </Button>
            }
          />
        )}

        {data && data.workspaces.length > 0 && (
          <div className="flex flex-col gap-3">
            {data.workspaces.map((ws, i) => (
              <motion.div key={ws.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link href={`/w/${ws.id}`} className="group block">
                  <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover">
                    <CardContent className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-signal font-display text-lg font-bold text-signal-foreground transition-transform group-hover:rotate-[-6deg]">
                          {ws.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-display text-lg font-semibold">{ws.name}</p>
                          {ws.description && <p className="truncate text-xs text-muted-foreground">{ws.description}</p>}
                          <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                            <Database className="h-3 w-3" /> {ws._count?.datasets ?? 0} dataset(s) · {ws._count?.smartColumns ?? 0} Smart Column(s)
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(ws.id, ws.name);
                        }}
                        aria-label={`Delete ${ws.name}`}
                        className="hover:bg-danger-muted hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="New Workspace" description="Give it a name your team will recognize.">
        <form className="flex flex-col gap-4" onSubmit={handleCreate}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-name">Name</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer Feedback Q3" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-desc">Description (optional)</Label>
            <Textarea id="ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this workspace for?" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createWorkspace.isPending} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
