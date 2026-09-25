"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  EyeOff,
  FolderKanban,
  History,
  KeyRound,
  Lock,
  Pencil,
  PlugZap,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, FieldHint } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { useConnectionStatus, useSettings, useUpdateSetting } from "@/hooks/use-settings";
import { useActivitySettings, useDeleteWorkspace, useUpdateActivitySettings, useUpdateWorkspace, useWorkspace } from "@/hooks/use-workspaces";
import { ACTIVITY_CATEGORIES, ACTIVITY_CATEGORY_IDS, type ActivityCategory, type ActivitySettings } from "@/lib/activity/categories";
import { ACTIVITY_ICON } from "@/components/activity/category-meta";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import { useDatasets } from "@/hooks/use-datasets";
import { useRenameDatasetDialog } from "@/components/workspace/rename-dataset-modal";
import { useDeleteDatasetWithConfirm } from "@/components/workspace/use-delete-dataset";
import type { WorkspaceDto } from "@/types/api";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SETTING_DEFINITIONS, type ConnectionStatus, type SettingDefinition, type SettingState } from "@/lib/settings/definitions";

const PROVIDERS: {
  id: ConnectionStatus["provider"];
  name: string;
  description: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: "typesafe",
    name: "TypeSafe · Jev",
    description: (
      <>
        Hosted System One models. Get a key at{" "}
        <a href="https://console.typesafe.ai" target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
          console.typesafe.ai
        </a>
        .
      </>
    ),
    icon: Sparkles,
  },
  {
    id: "laya",
    name: "Laya",
    description: (
      <>
        Open-weights System One engine you run yourself with <code className="font-mono text-xs">laya-serve</code>. Optional. See the{" "}
        <a href="https://github.com/NandhaKishorM/laya" target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
          Laya repo
        </a>
        .
      </>
    ),
    icon: Cpu,
  },
];

export default function SettingsPage({ params }: PageProps<"/w/[workspaceId]/settings">) {
  const { workspaceId } = use(params);
  const { data, isLoading } = useSettings();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 md:px-8">
        <PageHeader eyebrow="Configuration" title="Settings" description="This workspace, its datasets, and the model providers every workspace shares." />

        <WorkspaceSection workspaceId={workspaceId} />
        <DatasetsSection workspaceId={workspaceId} />
        <ActivityLoggingSection workspaceId={workspaceId} />

        <div>
          <h2 className="font-display text-xl font-semibold">Model providers</h2>
          <p className="text-sm text-muted-foreground">API keys and endpoints. These apply to every workspace.</p>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Keys are encrypted at rest and never sent back to the browser. Environment variables with the same name take precedence over
            values saved here. IntelligiXL has no login, so anyone who can open this page can change these settings. Don&apos;t expose it
            publicly without putting authentication in front of it.
          </p>
        </div>

        {PROVIDERS.map((p) => (
          <ProviderSection key={p.id} provider={p} settings={data?.settings} loading={isLoading} />
        ))}

        <DangerZone workspaceId={workspaceId} />
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function WorkspaceSection({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useWorkspace(workspaceId);
  const workspace = data?.workspace;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-flat-sm">
      <SectionHeading icon={FolderKanban} title="Workspace" description="The name and description shown across the app." />
      {isLoading || !workspace ? (
        <Skeleton className="h-40" />
      ) : (
        // Remount when the saved values change so the draft starts from them.
        <WorkspaceForm key={`${workspace.name}\u0000${workspace.description ?? ""}`} workspace={workspace} />
      )}
    </section>
  );
}

function WorkspaceForm({ workspace }: { workspace: WorkspaceDto }) {
  const update = useUpdateWorkspace(workspace.id);
  const [name, setName] = React.useState(workspace.name);
  const [description, setDescription] = React.useState(workspace.description ?? "");

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const dirty = trimmedName !== workspace.name || trimmedDescription !== (workspace.description ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || !trimmedName) return;
    try {
      await update.mutateAsync({ name: trimmedName, description: trimmedDescription || null });
      toast.success("Workspace updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the workspace.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workspace-name">Name</Label>
        <Input id="workspace-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        {!trimmedName && <p className="text-xs text-danger">The workspace needs a name.</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workspace-description">Description</Label>
        <Textarea
          id="workspace-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="What is this workspace for? (optional)"
        />
      </div>
      <div className="flex justify-end gap-2">
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setName(workspace.name);
              setDescription(workspace.description ?? "");
            }}
            disabled={update.isPending}
          >
            Discard
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!dirty || !trimmedName} loading={update.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function DatasetsSection({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useDatasets(workspaceId);
  const datasets = data?.datasets ?? [];
  const [openRename, renameDialog] = useRenameDatasetDialog(workspaceId);
  const deleteDataset = useDeleteDatasetWithConfirm(workspaceId);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-flat-sm">
      <SectionHeading icon={Database} title="Datasets" description="Rename or delete the datasets in this workspace." />
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : datasets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No datasets yet. Upload one from the Data page.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {datasets.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.filename}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {d.rowCount.toLocaleString()} rows · {d.columnCount} cols
                  {d._count.smartColumns > 0 && ` · ${d._count.smartColumns} Smart Column${d._count.smartColumns === 1 ? "" : "s"}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => openRename({ id: d.id, filename: d.filename })}>
                <Pencil className="h-3.5 w-3.5" /> Rename
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-danger-muted hover:text-danger"
                onClick={() => deleteDataset({ id: d.id, filename: d.filename, rowCount: d.rowCount, smartColumnCount: d._count.smartColumns })}
                aria-label={`Delete ${d.filename}`}
                title="Delete dataset"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {renameDialog}
    </section>
  );
}

function ActivityLoggingSection({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useActivitySettings(workspaceId);
  const update = useUpdateActivitySettings(workspaceId);
  // Optimistic: the switch flips immediately; a failed save flips it back.
  const [pending, setPending] = React.useState<Partial<ActivitySettings>>({});
  const settings = data ? { ...data.settings, ...pending } : null;
  const enabledCount = settings ? ACTIVITY_CATEGORY_IDS.filter((id) => settings[id]).length : 0;

  async function save(change: Partial<ActivitySettings>) {
    setPending((p) => ({ ...p, ...change }));
    try {
      await update.mutateAsync(change);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save logging settings.");
    } finally {
      setPending((p) => {
        const next = { ...p };
        for (const key of Object.keys(change) as ActivityCategory[]) delete next[key];
        return next;
      });
    }
  }

  const setAll = (value: boolean) => save(Object.fromEntries(ACTIVITY_CATEGORY_IDS.map((id) => [id, value])) as ActivitySettings);

  return (
    <section id="activity-logging" className="flex scroll-mt-6 flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-flat-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          icon={History}
          title="Activity logging"
          description="Choose what this workspace records in its activity log. Navigating around the app is never recorded."
        />
        <Link href={`/w/${workspaceId}/activity`} className="shrink-0 text-xs text-primary underline-offset-4 hover:underline">
          View activity log →
        </Link>
      </div>
      {isLoading || !settings ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Recording {enabledCount} of {ACTIVITY_CATEGORY_IDS.length} categories
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setAll(true)} disabled={enabledCount === ACTIVITY_CATEGORY_IDS.length}>
                Turn all on
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAll(false)} disabled={enabledCount === 0}>
                Turn all off
              </Button>
            </div>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {ACTIVITY_CATEGORIES.map((c) => {
              const Icon = ACTIVITY_ICON[c.id];
              const inputId = `activity-${c.id}`;
              return (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm font-medium">{c.label}</span>
                    <span className="block text-xs text-muted-foreground">{c.description}</span>
                  </label>
                  <Switch id={inputId} checked={settings[c.id]} onCheckedChange={(v) => save({ [c.id]: v })} />
                </li>
              );
            })}
          </ul>
          <FieldHint>Turning a category off stops new entries; what&apos;s already in the log stays. Changes to these settings are always recorded.</FieldHint>
        </>
      )}
    </section>
  );
}

function DangerZone({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { data } = useWorkspace(workspaceId);
  const remove = useDeleteWorkspace();
  const confirm = useConfirm();
  const workspace = data?.workspace;

  async function handleDelete() {
    if (!workspace) return;
    const n = (count: number | undefined, word: string) => `${count ?? 0} ${word}${count === 1 ? "" : "s"}`;
    const ok = await confirm({
      title: `Delete workspace “${workspace.name}”?`,
      description: "Everything inside it is permanently deleted:",
      details: [
        `${n(workspace._count?.datasets, "dataset")}, including uploaded files and exports`,
        `${n(workspace._count?.smartColumns, "Smart Column")}, with every prediction and review`,
        "Templates saved in this workspace, jobs and history",
      ],
      confirmText: workspace.name,
      confirmLabel: "Delete workspace",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(workspace.id);
      toast.success(`Workspace “${workspace.name}” deleted.`);
      router.push("/workspaces");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete workspace.");
    }
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-danger/40 bg-card p-5 shadow-flat-sm">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold">Delete this workspace</h2>
        <p className="text-xs text-muted-foreground">Permanently removes every dataset, Smart Column, prediction and review in it.</p>
      </div>
      <Button variant="danger" size="sm" onClick={handleDelete} disabled={!workspace} loading={remove.isPending}>
        <Trash2 className="h-3.5 w-3.5" /> Delete workspace
      </Button>
    </section>
  );
}

function ProviderSection({
  provider: p,
  settings,
  loading,
}: {
  provider: (typeof PROVIDERS)[number];
  settings?: SettingState[];
  loading: boolean;
}) {
  const fields = SETTING_DEFINITIONS.filter((d) => d.group === p.id);
  const primaryKey = p.id === "typesafe" ? "TYPESAFE_API_KEY" : "LAYA_BASE_URL";
  const configured = settings?.find((s) => s.key === primaryKey)?.source !== "unset" && Boolean(settings);
  const status = useConnectionStatus(p.id, configured);
  const checking = status.isFetching;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-flat-sm">
      {/* Stacks on phones; from sm up the description wraps instead, so the
          status + Test stay on the title row whatever its length. */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <p.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">{p.name}</h2>
            <p className="text-xs text-muted-foreground">{p.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill status={configured ? status.data : undefined} loading={checking} configured={configured} />
          <Button variant="outline" size="sm" onClick={() => status.refetch()} loading={checking} disabled={!configured}>
            {!checking && <PlugZap className="h-3.5 w-3.5" />} Test
          </Button>
        </div>
      </div>

      {loading || !settings ? (
        <Skeleton className="h-20" />
      ) : (
        fields.map((def) => {
          const state = settings.find((s) => s.key === def.key)!;
          // Remount when the saved value changes so the draft starts from it.
          return <SettingField key={`${def.key}:${state.source}:${state.value ?? state.hint ?? ""}`} def={def} state={state} />;
        })
      )}
    </section>
  );
}

function StatusPill({ status, loading, configured }: { status?: ConnectionStatus; loading: boolean; configured: boolean }) {
  if (!configured) return <Badge tone="muted">Not configured</Badge>;
  if (loading) return <Badge tone="muted">Checking…</Badge>;
  if (!status) return <Badge tone="muted">Not checked</Badge>;
  return status.ok ? (
    <Badge tone="success" title={status.message}>
      <CheckCircle2 className="h-3 w-3" /> Connected
    </Badge>
  ) : (
    <Badge tone="danger" title={status.message}>
      <XCircle className="h-3 w-3" /> {status.message}
    </Badge>
  );
}

function SettingField({ def, state }: { def: SettingDefinition; state: SettingState }) {
  const update = useUpdateSetting();
  const confirm = useConfirm();
  const [draft, setDraft] = React.useState(def.secret ? "" : (state.value ?? ""));
  const [editing, setEditing] = React.useState(false);
  const [reveal, setReveal] = React.useState(false);
  const inputId = `setting-${def.key}`;

  const envManaged = state.source === "env";
  const hasValue = state.source !== "unset";
  // Secrets are write-only: once saved, show the masked hint and offer
  // Replace instead of an editable field. Non-secrets are edited inline.
  const showInput = !envManaged && (!def.secret || !hasValue || editing || state.unreadable);

  async function save(value: string | null) {
    if (value === null) {
      const name = def.label.replace(/\s*\(optional\)/i, "");
      const provider = def.group === "typesafe" ? "Jev" : "Laya";
      const ok = await confirm({
        title: `Remove saved ${name.toLowerCase()}?`,
        description:
          def.group === "typesafe" || def.key === "LAYA_BASE_URL"
            ? `${provider} requests will fail until you add it again. Running jobs will start failing within a few seconds.`
            : "Requests to an authenticated laya-serve will fail until you add it again.",
        confirmLabel: "Remove",
      });
      if (!ok) return;
    }
    try {
      await update.mutateAsync({ key: def.key, value });
      const name = def.label.replace(/\s*\(optional\)/i, "");
      toast.success(value ? `${name} saved.` : `${name} removed.`);
      setEditing(false);
      if (def.secret) setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the setting.");
    }
  }

  const dirty = def.secret ? draft.trim().length > 0 : draft.trim() !== (state.value ?? "");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId}>{def.label}</Label>
        <span className="font-mono text-[10px] text-muted-foreground">{def.key}</span>
      </div>

      {envManaged ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{def.secret ? state.hint : state.value}</span>
          <span className="shrink-0 text-xs text-muted-foreground">from environment</span>
        </div>
      ) : showInput ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty) void save(draft);
          }}
        >
          <div className="relative flex-1">
            <Input
              id={inputId}
              type={def.secret && !reveal ? "password" : "text"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={def.placeholder}
              autoComplete="off"
              spellCheck={false}
              className={cn("font-mono text-xs", def.secret && "pr-9")}
            />
            {def.secret && (
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={reveal ? "Hide value" : "Show value"}
              >
                {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          <Button type="submit" size="sm" className="h-9" disabled={!dirty} loading={update.isPending}>
            Save
          </Button>
          {editing && (
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          {!def.secret && hasValue && (
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => save(null)} disabled={update.isPending}>
              Remove
            </Button>
          )}
        </form>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{state.hint}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hover:bg-danger-muted hover:text-danger"
            onClick={() => save(null)}
            disabled={update.isPending}
          >
            Remove
          </Button>
        </div>
      )}

      {state.unreadable && (
        <p className="text-xs text-warning">
          The saved value can&apos;t be decrypted. APP_SECRET or <code className="font-mono">.data/app-secret</code> changed. Enter it again.
        </p>
      )}
      <FieldHint>{def.description}</FieldHint>
    </div>
  );
}
