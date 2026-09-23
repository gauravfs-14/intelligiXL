"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Plus, FolderOpen, Trash2, Database, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useCreateWorkspace, useDeleteWorkspace, useWorkspaces } from "@/hooks/use-workspaces";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { ThemeToggle } from "@/components/theme-toggle";

export default function WorkspacesPage() {
  const { data, isLoading, isError, refetch } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

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
    if (!confirm(`Delete workspace "${wsName}"? This deletes every dataset, Smart Column, and prediction inside it.`)) return;
    try {
      await deleteWorkspace.mutateAsync(id);
      toast.success(`Workspace "${wsName}" deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete workspace.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">IntelligiXL</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Workspace
          </Button>
        </div>
      </div>

      {isLoading && <TableSkeleton rows={3} cols={1} />}
      {isError && <ErrorState description="Couldn't load workspaces." onRetry={() => refetch()} />}

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
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{ws.name}</p>
                        {ws.description && <p className="truncate text-xs text-muted-foreground">{ws.description}</p>}
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
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

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="New Workspace" description="Give it a name your team will recognize.">
        <form className="flex flex-col gap-4" onSubmit={handleCreate}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-name">Name</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Crash Report Analysis" autoFocus />
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
