"use client";

import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SmartColumnType } from "@/generated/prisma/browser";
import { LabelEditor } from "@/components/smart-column-builder/label-editor";
import { emptyBuilderState, builderLabels, type BuilderState } from "@/components/smart-column-builder/types";
import { useSaveTemplate } from "@/hooks/use-templates";
import type { SmartColumnConfig } from "@/types/smart-column";

const TYPE_OPTIONS: { type: SmartColumnType; title: string; description: string }[] = [
  { type: SmartColumnType.BINARY, title: "Yes / No", description: "A binary classification, e.g. “Is this urgent?”" },
  { type: SmartColumnType.CATEGORICAL, title: "Category", description: "Pick one of several labeled options." },
  { type: SmartColumnType.RATING, title: "Ordered rating", description: "A scale from low to high, e.g. priority." },
];

// There was previously no way to start a template from scratch — only to
// save one from an existing Smart Column. This reuses the same LabelEditor
// the builder wizard uses, so the label-editing UX stays identical.
export function CreateTemplateModal({
  open,
  onOpenChange,
  workspaceId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onCreated: (templateId: string) => void;
}) {
  const [templateName, setTemplateName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [hintsInput, setHintsInput] = React.useState("");
  const [state, setState] = React.useState<BuilderState>(emptyBuilderState);
  const saveTemplate = useSaveTemplate(workspaceId);

  React.useEffect(() => {
    if (!open) return;
    setTemplateName("");
    setDescription("");
    setHintsInput("");
    setState(emptyBuilderState());
  }, [open]);

  const labelsValid =
    state.type === SmartColumnType.CATEGORICAL
      ? state.categorical.filter((o) => o.key.trim()).length >= 2
      : state.type === SmartColumnType.RATING
        ? state.rating.filter((l) => l.trim()).length >= 2
        : true;
  const isValid = Boolean(templateName.trim() && state.name.trim() && state.question.trim() && labelsValid);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    const config: SmartColumnConfig = {
      name: state.name.trim(),
      type: state.type,
      question: state.question.trim(),
      instructions: state.instructions.trim() || undefined,
      labels: builderLabels(state) as SmartColumnConfig["labels"],
      sourceColumns: hintsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      const { template } = await saveTemplate.mutateAsync({
        name: templateName.trim(),
        description: description.trim() || undefined,
        config: config as unknown as Record<string, unknown>,
      });
      toast.success(`Template "${template.name}" created.`);
      onCreated(template.id);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create template.");
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New template" description="Define a reusable Smart Column configuration from scratch." size="lg">
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input id="tpl-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Support ticket urgency" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-sc-name">Smart Column name</Label>
            <Input id="tpl-sc-name" value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} placeholder="e.g. Urgency" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-desc">Description (optional)</Label>
          <Textarea id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this template for?" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => setState({ ...state, type: opt.type })}
                className={cn(
                  "flex flex-col gap-1 rounded-md border p-3 text-left transition-colors",
                  state.type === opt.type ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                )}
              >
                <span className="text-sm font-semibold">{opt.title}</span>
                <span className="text-xs text-muted-foreground">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-question">Question</Label>
          <Textarea
            id="tpl-question"
            value={state.question}
            onChange={(e) => setState({ ...state, question: e.target.value })}
            placeholder="What should the model decide for each row?"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-instructions">Instructions (optional)</Label>
          <Textarea
            id="tpl-instructions"
            value={state.instructions}
            onChange={(e) => setState({ ...state, instructions: e.target.value })}
            placeholder="Any extra guidance for the model"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Labels</Label>
          <LabelEditor state={state} onChange={setState} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-hints">Source column hints (optional)</Label>
          <Input
            id="tpl-hints"
            value={hintsInput}
            onChange={(e) => setHintsInput(e.target.value)}
            placeholder="e.g. text, description, body"
          />
          <p className="text-xs text-muted-foreground">Comma-separated column-name hints shown when this template is applied.</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={saveTemplate.isPending} disabled={!isValid}>
            Create template
          </Button>
        </div>
      </form>
    </Modal>
  );
}
