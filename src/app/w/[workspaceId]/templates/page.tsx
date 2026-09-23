"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LayoutTemplate, Sparkles, Trash2 } from "lucide-react";
import { useDeleteTemplate, useTemplates } from "@/hooks/use-templates";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { SmartColumnType } from "@/generated/prisma/browser";

// FR-042/043 — reusable Smart Column configs, seeded with built-in recipes.
export default function TemplatesPage({ params }: PageProps<"/w/[workspaceId]/templates">) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useTemplates(workspaceId);
  const deleteTemplate = useDeleteTemplate(workspaceId);

  function applyTemplate(config: Record<string, unknown>) {
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
    router.push(`/w/${workspaceId}/data?upload=0`);
    toast.info("Pick a dataset, then the builder will open pre-filled from this template.");
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success("Template deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  if (isLoading) return <div className="p-6"><TableSkeleton rows={4} cols={3} /></div>;
  if (isError) return <div className="p-6"><ErrorState onRetry={() => refetch()} /></div>;
  if (!data || data.templates.length === 0) {
    return (
      <div className="p-6">
        <EmptyState icon={LayoutTemplate} title="No templates" description="Save a Smart Column's configuration as a template to reuse it." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold tracking-tight">Templates & Recipes</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.templates.map((t) => (
          <Panel key={t.id} className="flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-hover">
            <PanelBody className="flex flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{t.name}</p>
                {t.isBuiltIn ? (
                  <Badge tone="primary">Recipe</Badge>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id, t.name)} aria-label={`Delete ${t.name}`}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                )}
              </div>
              {t.description && <p className="flex-1 text-xs text-muted-foreground">{t.description}</p>}
              <Badge tone="muted" className="self-start">
                {String((t.config as Record<string, unknown>).type ?? "")}
              </Badge>
              <Button size="sm" variant="outline" className="mt-2 self-start" onClick={() => applyTemplate(t.config)}>
                <Sparkles className="h-3.5 w-3.5" /> Use this template
              </Button>
            </PanelBody>
          </Panel>
        ))}
      </div>
    </div>
  );
}
