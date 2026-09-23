"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { SmartColumnType } from "@/generated/prisma/browser";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, FieldHint } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LabelEditor } from "./label-editor";
import { PreviewStep } from "./preview-step";
import { builderIsValid, builderLabels, emptyBuilderState, type BuilderState } from "./types";
import { useCreateSmartColumn, useGenerateSmartColumn, usePreviewSmartColumn, useUpdateSmartColumn } from "@/hooks/use-smart-columns";
import type { DatasetColumnDto, WorkbenchSmartColumnDto } from "@/types/workbench";
import type { SmartColumnConfig } from "@/types/smart-column";
import type { PreviewRowResult } from "@/lib/smart-columns/preview";

const STEPS = ["Source", "Question", "Type", "Labels", "Preview", "Generate"] as const;

const TYPE_OPTIONS: { type: SmartColumnType; title: string; description: string }[] = [
  { type: SmartColumnType.BINARY, title: "Yes / No", description: "A binary classification, e.g. “Is this urgent?”" },
  { type: SmartColumnType.CATEGORICAL, title: "Category", description: "Pick one of several labeled options." },
  { type: SmartColumnType.RATING, title: "Ordered rating", description: "A scale from low to high, e.g. severity." },
];

export function SmartColumnBuilderModal({
  open,
  onOpenChange,
  workspaceId,
  datasetId,
  datasetColumns,
  editing,
  initialConfig,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  datasetId: string;
  datasetColumns: DatasetColumnDto[];
  editing?: WorkbenchSmartColumnDto | null;
  initialConfig?: Partial<BuilderState> | null;
  onGenerated: (jobId: string, smartColumnName: string) => void;
}) {
  const [step, setStep] = React.useState(0);
  const [state, setState] = React.useState<BuilderState>(emptyBuilderState());
  const [previewResults, setPreviewResults] = React.useState<PreviewRowResult[] | null>(null);
  const [sampleMode, setSampleMode] = React.useState<"random" | "first">("random");

  const createSmartColumn = useCreateSmartColumn(datasetId);
  const updateSmartColumn = useUpdateSmartColumn(editing?.id ?? "", datasetId);
  const previewMutation = usePreviewSmartColumn();
  const generate = useGenerateSmartColumn(datasetId);

  React.useEffect(() => {
    if (!open) return;
    setStep(0);
    setPreviewResults(null);
    if (editing?.activeVersion) {
      const v = editing.activeVersion;
      const base = emptyBuilderState();
      base.name = editing.name;
      base.type = editing.type;
      base.sourceColumns = v.sourceColumns;
      base.question = v.question;
      base.instructions = v.instructions ?? "";
      base.unclearEnabled = v.unclearEnabled;
      if (editing.type === SmartColumnType.BINARY) {
        const l = v.labels as { yes: string | null; no: string | null };
        base.binaryYes = l.yes ?? "";
        base.binaryNo = l.no ?? "";
      } else if (editing.type === SmartColumnType.CATEGORICAL) {
        const l = v.labels as Record<string, string | null>;
        base.categorical = Object.entries(l).map(([key, description]) => ({ key, description: description ?? "" }));
      } else {
        base.rating = v.labels as string[];
      }
      setState(base);
    } else {
      setState({ ...emptyBuilderState(), ...initialConfig });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const sourceColumns = datasetColumns.filter((c) => c.isSource);
  const canAdvance = [
    state.sourceColumns.length > 0,
    state.question.trim().length > 0,
    Boolean(state.type),
    builderIsValid(state),
    true,
    true,
  ];

  async function runPreview() {
    const results = await previewMutation.mutateAsync({
      datasetId,
      config: buildConfig(state),
      sampleMode,
      sampleSize: 10,
    });
    setPreviewResults(results.results);
  }

  async function handleGenerate() {
    try {
      const config = buildConfig(state);
      let smartColumnId: string;
      if (editing) {
        const res = await updateSmartColumn.mutateAsync(config);
        smartColumnId = res.smartColumn.id;
      } else {
        const res = await createSmartColumn.mutateAsync({ workspaceId, datasetId, config });
        smartColumnId = res.smartColumn.id;
      }
      const { job } = await generate.mutateAsync(smartColumnId);
      toast.success(`Generating "${state.name}" for the full dataset…`);
      onGenerated(job.id, state.name);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start generation.");
    }
  }

  const busy = createSmartColumn.isPending || updateSmartColumn.isPending || generate.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit "${editing.name}"` : "New Smart Column"}
      size="lg"
      preventClose={busy}
    >
      <div className="mb-5 flex items-center gap-1">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-xs font-medium transition-colors",
                i === step ? "bg-foreground text-background" : i < step ? "text-accent hover:underline" : "text-muted-foreground",
              )}
            >
              <span className="font-mono">{i + 1}</span> {label}
            </button>
            {i < STEPS.length - 1 && <div className="h-px w-3 bg-border" />}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sc-name">Smart Column name</Label>
            <Input id="sc-name" value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} placeholder="Crash Type" autoFocus />
          </div>
          <div>
            <Label>Source columns</Label>
            <FieldHint className="mb-2">Selected columns are combined deterministically, e.g. “Title + Article Text”.</FieldHint>
            <div className="max-h-56 overflow-y-auto border border-border">
              {sourceColumns.map((c) => (
                <label key={c.id} className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-sm last:border-b-0">
                  <Checkbox
                    checked={state.sourceColumns.includes(c.name)}
                    onCheckedChange={(v) =>
                      setState({
                        ...state,
                        sourceColumns: v ? [...state.sourceColumns, c.name] : state.sourceColumns.filter((n) => n !== c.name),
                      })
                    }
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{c.dataType}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sc-question">Question</Label>
            <Textarea
              id="sc-question"
              value={state.question}
              onChange={(e) => setState({ ...state, question: e.target.value })}
              placeholder="What was the primary type of crash described?"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sc-instructions">Additional instructions (optional)</Label>
            <Textarea
              id="sc-instructions"
              value={state.instructions}
              onChange={(e) => setState({ ...state, instructions: e.target.value })}
              placeholder="Extra context the model should weigh."
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={state.unclearEnabled} onCheckedChange={(v) => setState({ ...state, unclearEnabled: v })} />
            Recommend an “Unclear” option where appropriate
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => setState({ ...state, type: opt.type })}
              className={cn(
                "flex flex-col gap-1 border p-3 text-left transition-colors",
                state.type === opt.type ? "border-accent bg-accent-muted" : "border-border-strong hover:bg-background",
              )}
            >
              <span className="text-sm font-semibold">{opt.title}</span>
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            </button>
          ))}
        </div>
      )}

      {step === 3 && <LabelEditor state={state} onChange={setState} />}

      {step === 4 && (
        <PreviewStep results={previewResults} loading={previewMutation.isPending} sampleMode={sampleMode} onSampleModeChange={setSampleMode} onRun={runPreview} />
      )}

      {step === 5 && (
        <div className="flex flex-col gap-3">
          <div className="border border-border-strong bg-background p-3 text-sm">
            <p className="font-semibold">{state.name}</p>
            <p className="mt-1 text-muted-foreground">{state.question}</p>
            <p className="mt-2 text-xs text-muted">
              {state.type} · {state.sourceColumns.join(" + ")}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            This runs Jev against every eligible row in the background. You can keep working while it runs — progress shows in the toolbar.
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!canAdvance[step]}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleGenerate} loading={busy}>
            <Sparkles className="h-4 w-4" /> Generate
          </Button>
        )}
      </div>
    </Modal>
  );
}

function buildConfig(state: BuilderState): SmartColumnConfig {
  return {
    name: state.name.trim(),
    type: state.type,
    question: state.question.trim(),
    instructions: state.instructions.trim() || undefined,
    labels: builderLabels(state) as SmartColumnConfig["labels"],
    sourceColumns: state.sourceColumns,
    unclearEnabled: state.unclearEnabled,
  };
}
