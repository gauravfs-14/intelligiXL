"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Tags,
  Frown,
  Gauge,
  LayoutTemplate,
  Plus,
  Route,
  Search,
  Smile,
  Sparkles,
  Trash2,
  Copy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useDeleteTemplate, useSaveTemplate, useTemplates, useUseTemplate } from "@/hooks/use-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { CreateTemplateModal } from "@/components/templates/create-template-modal";
import { PageHeader } from "@/components/workspace/page-header";
import { cn } from "@/lib/utils";
import { RECIPE_ICON_BY_NAME, type RecipeIcon } from "@/lib/templates/recipes";
import { SmartColumnType } from "@/generated/prisma/browser";
import type { TemplateDto } from "@/types/api";

const ICONS: Record<RecipeIcon, LucideIcon> = {
  zap: Zap,
  smile: Smile,
  route: Route,
  tags: Tags,
  gauge: Gauge,
  frown: Frown,
};

const TYPE_LABEL: Record<string, string> = { BINARY: "Binary", CATEGORICAL: "Categorical", RATING: "Rating" };

type FilterTab = "all" | "builtin" | "mine";

// FR-042/043 — reusable Smart Column configs: built-in recipes + whatever a
// workspace has saved. A master list on the left, full detail on the right,
// so browsing doesn't require opening each one.
export default function TemplatesPage({ params }: PageProps<"/w/[workspaceId]/templates">) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useTemplates(workspaceId);
  const deleteTemplate = useDeleteTemplate(workspaceId);
  const confirm = useConfirm();
  const saveTemplate = useSaveTemplate(workspaceId);
  const useTemplateMutation = useUseTemplate(workspaceId);

  const [tab, setTab] = React.useState<FilterTab>("all");
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const templates = data?.templates ?? [];
  const builtInCount = templates.filter((t) => t.isBuiltIn).length;
  const mineCount = templates.filter((t) => !t.isBuiltIn).length;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (tab === "builtin" && !t.isBuiltIn) return false;
      if (tab === "mine" && t.isBuiltIn) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [templates, tab, search]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, TemplateDto[]>();
    for (const t of filtered) {
      const key = t.category ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()];
  }, [filtered]);

  React.useEffect(() => {
    if (selectedId && filtered.some((t) => t.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  function applyTemplate(t: TemplateDto) {
    const config = t.config;
    try {
      sessionStorage.setItem(
        "intelligixl:pending-template",
        JSON.stringify({
          name: (config.name as string) ?? "",
          type: (config.type as string) ?? SmartColumnType.BINARY,
          question: (config.question as string) ?? "",
          instructions: (config.instructions as string) ?? "",
          binaryYes: (config.labels as { yes?: string })?.yes ?? "",
          binaryNo: (config.labels as { no?: string })?.no ?? "",
          categorical:
            config.type === SmartColumnType.CATEGORICAL
              ? Object.entries((config.labels as Record<string, string | null>) ?? {}).map(([key, description]) => ({
                  key,
                  description: description ?? "",
                }))
              : undefined,
          rating: config.type === SmartColumnType.RATING ? (config.labels as string[]) : undefined,
        }),
      );
    } catch {
      // sessionStorage unavailable — the builder will just open blank.
    }
    useTemplateMutation.mutate(t.id);
    router.push(`/w/${workspaceId}/data?upload=0`);
    toast.info("Pick a dataset, then the builder will open pre-filled from this template.");
  }

  async function handleDuplicate(t: TemplateDto) {
    try {
      const copy = await saveTemplate.mutateAsync({
        name: `${t.name} (Copy)`,
        description: t.description ?? undefined,
        config: t.config,
      });
      toast.success("Saved a copy to My Templates.");
      setTab("mine");
      setSelectedId(copy.template.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't duplicate template.");
    }
  }

  async function handleDelete(t: TemplateDto) {
    const ok = await confirm({
      title: `Delete template “${t.name}”?`,
      description: "Smart Columns already created from it are not affected.",
      confirmLabel: "Delete template",
    });
    if (!ok) return;
    try {
      await deleteTemplate.mutateAsync(t.id);
      toast.success("Template deleted.");
      setSelectedId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  const header = (
    <PageHeader
      eyebrow="Recipes"
      title="Templates & Recipes"
      description="Reusable Smart Column definitions — built-in recipes plus anything your workspace has saved."
      actions={
        <>
          <div className="relative w-64 max-w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" className="h-9 pl-8" />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New Template
          </Button>
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-8 overflow-y-auto px-6 py-10 md:px-8">
      {header}

      {isLoading && <TableSkeleton rows={4} cols={3} />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <>
          <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
            <TabsList>
              <TabsTrigger value="all">All ({templates.length})</TabsTrigger>
              <TabsTrigger value="builtin">Built-in ({builtInCount})</TabsTrigger>
              <TabsTrigger value="mine">My Templates ({mineCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          {templates.length === 0 ? (
            <EmptyState icon={LayoutTemplate} title="No templates" description="Save a Smart Column's configuration as a template to reuse it." />
          ) : (
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="flex min-w-0 flex-1 flex-col gap-5">
                {filtered.length === 0 && tab === "mine" && !search.trim() && (
                  <EmptyState
                    icon={LayoutTemplate}
                    title="No templates yet"
                    description="Save one from an existing Smart Column, or build one from scratch."
                    action={
                      <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-3.5 w-3.5" /> New Template
                      </Button>
                    }
                  />
                )}
                {filtered.length === 0 && !(tab === "mine" && !search.trim()) && (
                  <EmptyState icon={Search} title="No matches" description="Try a different search term or tab." />
                )}
                {grouped.map(([category, items]) => (
                  <section key={category} className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                    <div className="flex flex-col gap-2">
                      {items.map((t) => (
                        <TemplateListItem key={t.id} template={t} selected={t.id === selectedId} onClick={() => setSelectedId(t.id)} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <div className="w-full shrink-0 md:w-[22rem]">
                {selected ? (
                  <TemplateDetailPanel
                    template={selected}
                    onUse={() => applyTemplate(selected)}
                    onDuplicate={() => handleDuplicate(selected)}
                    onDelete={!selected.isBuiltIn ? () => handleDelete(selected) : undefined}
                    useLoading={useTemplateMutation.isPending}
                    duplicateLoading={saveTemplate.isPending}
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                    Select a template to preview it
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <CreateTemplateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        onCreated={(id) => {
          setTab("mine");
          setSelectedId(id);
        }}
      />
    </div>
  );
}

function TemplateListItem({ template, selected, onClick }: { template: TemplateDto; selected: boolean; onClick: () => void }) {
  const Icon = (template.isBuiltIn && RECIPE_ICON_BY_NAME[template.name] && ICONS[RECIPE_ICON_BY_NAME[template.name]]) || Sparkles;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-hover",
        selected ? "border-primary bg-primary/[0.04] shadow-flat" : "border-border bg-surface shadow-flat",
      )}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{template.name}</p>
          {template.isBuiltIn && <Badge tone="primary" className="shrink-0">Recipe</Badge>}
        </div>
        {template.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{template.description}</p>}
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{TYPE_LABEL[(template.config.type as string) ?? ""] ?? "—"}</span>
          <span>Used {template.usageCount.toLocaleString()}×</span>
        </div>
      </div>
    </button>
  );
}

function TemplateDetailPanel({
  template,
  onUse,
  onDuplicate,
  onDelete,
  useLoading,
  duplicateLoading,
}: {
  template: TemplateDto;
  onUse: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  useLoading: boolean;
  duplicateLoading: boolean;
}) {
  const type = (template.config.type as string) ?? "";
  const question = (template.config.question as string) ?? "";
  const instructions = (template.config.instructions as string) ?? "";
  const sourceColumns = (template.config.sourceColumns as string[]) ?? [];
  const labels = template.config.labels;

  const outputBadges: string[] = [];
  if (type) outputBadges.push(TYPE_LABEL[type] ?? type);
  if (type === SmartColumnType.CATEGORICAL && labels && typeof labels === "object") {
    outputBadges.push(`${Object.keys(labels).length} categories`);
  }
  if (type === SmartColumnType.RATING && Array.isArray(labels)) {
    outputBadges.push(`${labels.length} levels`);
  }
  if (type === SmartColumnType.BINARY) outputBadges.push("Yes / No");

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 shadow-flat">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{template.name}</h2>
        <p className="text-xs text-muted-foreground">{template.isBuiltIn ? "Built-in" : "Custom"} · {TYPE_LABEL[type] ?? type} type</p>
      </div>

      {template.description && (
        <Section title="Description">
          <p className="text-sm text-foreground">{template.description}</p>
        </Section>
      )}

      <Section title="Output format">
        <div className="flex flex-wrap gap-1.5">
          {outputBadges.map((b) => (
            <Badge key={b} tone="neutral">{b}</Badge>
          ))}
        </div>
      </Section>

      {question && (
        <Section title="AI prompt">
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground">
            {question}
            {instructions ? `\n\n${instructions}` : ""}
          </pre>
        </Section>
      )}

      {sourceColumns.length > 0 && (
        <Section title="Source column hints">
          <div className="flex flex-wrap gap-1.5">
            {sourceColumns.map((c) => (
              <Badge key={c} tone="muted">{c}</Badge>
            ))}
          </div>
        </Section>
      )}

      <Section title="Recommended model">
        <p className="text-sm text-foreground">Jev <span className="text-muted-foreground">(via TypeSafe)</span></p>
      </Section>

      <Section title="Usage">
        <p className="text-sm text-foreground">Used <span className="font-semibold">{template.usageCount.toLocaleString()}</span> time{template.usageCount === 1 ? "" : "s"}</p>
      </Section>

      {template.tags.length > 0 && (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {template.tags.map((tag) => (
              <Badge key={tag} tone="muted">{tag}</Badge>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-1 flex flex-col gap-2 border-t border-border pt-4">
        <Button onClick={onUse} loading={useLoading}>
          <Sparkles className="h-3.5 w-3.5" /> Use this template
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onDuplicate} loading={duplicateLoading}>
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </Button>
          {onDelete && (
            <Button variant="outline" className="hover:bg-danger-muted hover:text-danger" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
