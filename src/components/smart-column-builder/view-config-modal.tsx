"use client";

import { format } from "date-fns";
import { toast } from "sonner";
import { Download, BookmarkPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSaveTemplate } from "@/hooks/use-templates";
import type { WorkbenchSmartColumnDto } from "@/types/workbench";
import { modelDisplayName, resolveSettings } from "@/lib/decision-models/catalog";

// FR-021 (model information) + FR-039 (reproducibility export) live together
// here: this is the read-only "View configuration" panel, and its Export
// button writes out exactly the JSON shape FR-039 specifies.
export function ViewConfigModal({
  smartColumn,
  workspaceId,
  open,
  onOpenChange,
}: {
  smartColumn: WorkbenchSmartColumnDto | null;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const saveTemplate = useSaveTemplate(workspaceId);
  if (!smartColumn?.activeVersion) return null;
  const v = smartColumn.activeVersion;
  const settings = resolveSettings(v.settings);

  async function saveAsTemplate() {
    if (!smartColumn?.activeVersion) return;
    const v = smartColumn.activeVersion;
    try {
      await saveTemplate.mutateAsync({
        name: smartColumn.name,
        description: v.question,
        config: {
          name: smartColumn.name,
          type: smartColumn.type,
          question: v.question,
          instructions: v.instructions ?? "",
          labels: v.labels,
          sourceColumnHints: v.sourceColumns,
          modelProvider: v.modelProvider,
          modelIdentifier: v.modelIdentifier,
          settings: resolveSettings(v.settings),
        },
      });
      toast.success(`Saved "${smartColumn.name}" as a template.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template.");
    }
  }

  function exportConfig() {
    if (!smartColumn?.activeVersion) return;
    const v = smartColumn.activeVersion;
    const payload = {
      name: smartColumn.name,
      question: v.question,
      instructions: v.instructions ?? "",
      type: smartColumn.type,
      labels: v.labels,
      source_columns: v.sourceColumns,
      model: v.modelProvider,
      model_version: v.modelIdentifier,
      settings: resolveSettings(v.settings),
      created_at: v.createdAt,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${smartColumn.name.replace(/\s+/g, "_")}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={smartColumn.name} description="Configuration & provenance" size="md">
      <div className="flex flex-col gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question</p>
          <p className="mt-1 font-accent text-lg leading-snug">“{v.question}”</p>
        </div>
        {v.instructions && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instructions</p>
            <p className="mt-1 text-muted-foreground">{v.instructions}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source columns</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {v.sourceColumns.map((c) => (
              <Badge key={c}>{c}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Labels</p>
          <pre className="mt-1 overflow-x-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs">{JSON.stringify(v.labels, null, 2)}</pre>
        </div>
        <div className="ring-aurora grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-2xl p-4 font-mono text-[11px]">
          <span className="text-muted-foreground">model</span>
          <span>{modelDisplayName(v.modelProvider, v.modelIdentifier)} <span className="text-muted-foreground">({v.modelProvider})</span></span>
          <span className="text-muted-foreground">review threshold</span>
          <span>{settings.lowConfidenceAction === "flag" ? `${Math.round(settings.confidenceThreshold * 100)}%` : "off"}</span>
          <span className="text-muted-foreground">runtime</span>
          <span>{settings.concurrency}× parallel · {settings.timeoutMs / 1000}s · {settings.maxRetries} retries</span>
          <span className="text-muted-foreground">version</span>
          <span>v{v.versionNumber} · {format(new Date(v.createdAt), "MMM d, yyyy HH:mm")}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportConfig}>
            <Download className="h-3.5 w-3.5" /> Export config JSON
          </Button>
          <Button variant="outline" size="sm" onClick={saveAsTemplate} loading={saveTemplate.isPending}>
            <BookmarkPlus className="h-3.5 w-3.5" /> Save as template
          </Button>
        </div>
      </div>
    </Modal>
  );
}
