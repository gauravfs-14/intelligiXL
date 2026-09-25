"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Columns3,
  Cpu,
  Eye,
  ListOrdered,
  MessageCircleQuestion,
  Rocket,
  Shapes,
  Sparkles,
  Tags,
  ToggleRight,
} from "lucide-react";
import { SmartColumnType } from "@/generated/prisma/browser";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, FieldHint } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LabelEditor } from "./label-editor";
import { PreviewStep } from "./preview-step";
import { ModelStep } from "./model-step";
import { builderIsValid, builderLabels, emptyBuilderState, type BuilderState } from "./types";
import { useCreateSmartColumn, useGenerateSmartColumn, usePreviewSmartColumn, useUpdateSmartColumn } from "@/hooks/use-smart-columns";
import { DEFAULT_MODEL_IDENTIFIER, DEFAULT_MODEL_PROVIDER, modelDisplayName, resolveSettings, type ModelProviderId } from "@/lib/decision-models/catalog";
import type { DatasetColumnDto, WorkbenchSmartColumnDto } from "@/types/workbench";
import type { SmartColumnConfig } from "@/types/smart-column";
import type { PreviewRowResult } from "@/lib/smart-columns/preview";

const STEPS = [
  { key: "source", label: "Source", hint: "What to read", icon: Columns3 },
  { key: "question", label: "Question", hint: "What to ask", icon: MessageCircleQuestion },
  { key: "type", label: "Answer type", hint: "Shape of the answer", icon: Shapes },
  { key: "labels", label: "Labels", hint: "Possible answers", icon: Tags },
  { key: "model", label: "Model & tuning", hint: "Who answers, how strictly", icon: Cpu },
  { key: "preview", label: "Preview", hint: "Dry run on a sample", icon: Eye },
  { key: "generate", label: "Generate", hint: "Run the whole dataset", icon: Rocket },
] as const;

const TYPE_OPTIONS: { type: SmartColumnType; title: string; description: string; example: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: SmartColumnType.BINARY, title: "Yes / No", description: "A binary call.", example: "Is this urgent?", icon: ToggleRight },
  { type: SmartColumnType.CATEGORICAL, title: "Category", description: "Pick one of several labels.", example: "Which topic is this?", icon: Tags },
  { type: SmartColumnType.RATING, title: "Rating", description: "A low → high scale.", example: "How positive is it?", icon: ListOrdered },
];

const LAYA_COMFORTABLE_OPTIONS = 20;

/** Placeholder examples, drawn from different domains so the builder
 * doesn't read as tailored to any one kind of dataset. One is picked per
 * open. */
const EXAMPLES = [
  { name: "Sentiment", question: "What's the overall sentiment of this review?" },
  { name: "Needs follow-up", question: "Does this message ask for a reply or an action?" },
  { name: "Topic", question: "What is this document mainly about?" },
  { name: "Urgency", question: "How urgent is this request?" },
  { name: "Mentions pricing", question: "Does this text talk about price or cost?" },
] as const;

const TYPE_SHORT: Record<SmartColumnType, string> = {
  [SmartColumnType.BINARY]: "Yes / No",
  [SmartColumnType.CATEGORICAL]: "Category",
  [SmartColumnType.RATING]: "Rating",
};

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
  onGenerated?: (jobId: string, smartColumnName: string) => void;
}) {
  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [state, setState] = React.useState<BuilderState>(emptyBuilderState());
  const [previewResults, setPreviewResults] = React.useState<PreviewRowResult[] | null>(null);
  const [sampleMode, setSampleMode] = React.useState<"random" | "first">("random");
  const [exampleIndex, setExampleIndex] = React.useState(0);
  const example = EXAMPLES[exampleIndex];

  const createSmartColumn = useCreateSmartColumn(datasetId);
  const updateSmartColumn = useUpdateSmartColumn(editing?.id ?? "", datasetId);
  const previewMutation = usePreviewSmartColumn();
  const generate = useGenerateSmartColumn(datasetId);

  React.useEffect(() => {
    if (!open) return;
    setExampleIndex(Math.floor(Math.random() * EXAMPLES.length));
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
      base.modelProvider = (v.modelProvider as ModelProviderId) || DEFAULT_MODEL_PROVIDER;
      base.modelIdentifier = v.modelIdentifier || DEFAULT_MODEL_IDENTIFIER;
      base.settings = resolveSettings(v.settings);
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
  // Laya packs every option into one fixed token window; past ~20 described
  // options it starts trimming them, so warn (the server rejects outright
  // only far beyond that, with a clear per-row error).
  const optionCount = state.type === SmartColumnType.CATEGORICAL ? state.categorical.filter((o) => o.key.trim()).length : 0;
  const layaCrowded = state.modelProvider === "laya" && optionCount > LAYA_COMFORTABLE_OPTIONS;
  const canAdvance = [
    state.name.trim().length > 0 && state.sourceColumns.length > 0,
    state.question.trim().length > 0,
    Boolean(state.type),
    builderIsValid(state),
    Boolean(state.modelIdentifier),
    true,
    true,
  ];
  const furthestValid = canAdvance.findIndex((ok) => !ok);
  const maxReachable = furthestValid === -1 ? STEPS.length - 1 : furthestValid;

  function goTo(next: number) {
    if (next === step || next > maxReachable) return;
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  async function runPreview() {
    try {
      const results = await previewMutation.mutateAsync({
        datasetId,
        config: buildConfig(state),
        sampleMode,
        sampleSize: 10,
      });
      setPreviewResults(results.results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed.");
    }
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
      onGenerated?.(job.id, state.name);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start generation.");
    }
  }

  const busy = createSmartColumn.isPending || updateSmartColumn.isPending || generate.isPending;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit “${editing.name}”` : "New Smart Column"}
      description={editing ? "Changes create a new version. Past predictions stay attributable." : "Teach your spreadsheet a new question."}
      size="xl"
      preventClose={busy}
    >
      <div className="-mx-6 -my-5 flex h-[min(42rem,calc(85vh-6rem))] flex-col md:flex-row">
        {/* Stepper rail + live recipe */}
        <aside className="flex shrink-0 flex-col gap-4 border-b border-border bg-muted/40 px-4 py-4 md:w-60 md:border-b-0 md:border-r">
          <ol className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              const reachable = i <= maxReachable;
              return (
                <li key={s.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    disabled={!reachable}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors",
                      active ? "text-foreground" : reachable ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/50",
                    )}
                  >
                    {active && (
                      <motion.span layoutId="builder-step-pill" className="absolute inset-0 rounded-xl border border-border bg-surface shadow-flat-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                    )}
                    <span
                      className={cn(
                        "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] transition-colors",
                        active ? "bg-foreground text-background" : done ? "bg-signal text-signal-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="relative hidden min-w-0 md:block">
                      <span className="block text-sm font-medium leading-tight">{s.label}</span>
                      {active && <span className="block truncate text-[11px] text-muted-foreground">{s.hint}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <RecipeCard state={state} className="mt-auto hidden md:flex" />
        </aside>

        {/* Step body */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 px-6 pt-5">
            <current.icon className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-lg font-semibold">{current.label}</h3>
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
            </span>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="px-6 py-5"
              >
                {step === 0 && (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="sc-name">Column name</Label>
                      <Input
                        id="sc-name"
                        value={state.name}
                        onChange={(e) => setState({ ...state, name: e.target.value })}
                        placeholder={`e.g. ${example.name}`}
                        autoFocus
                        className="h-11 font-display text-lg"
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex items-end justify-between gap-2">
                        <div>
                          <Label>Source columns</Label>
                          <FieldHint className="mt-0.5">The model reads these, combined as named fields.</FieldHint>
                        </div>
                        {state.sourceColumns.length > 0 && (
                          <span className="font-mono text-[11px] text-muted-foreground">{state.sourceColumns.length} selected</span>
                        )}
                      </div>
                      <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                        {sourceColumns.map((c) => {
                          const checked = state.sourceColumns.includes(c.name);
                          return (
                            <label
                              key={c.id}
                              className={cn(
                                "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors",
                                checked ? "border-foreground/30 bg-surface shadow-flat-sm" : "border-border hover:border-foreground/20",
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  setState({
                                    ...state,
                                    sourceColumns: v ? [...state.sourceColumns, c.name] : state.sourceColumns.filter((n) => n !== c.name),
                                  })
                                }
                              />
                              <span className="flex-1 truncate">{c.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{c.dataType.toLowerCase()}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="sc-question">Question</Label>
                      <Textarea
                        id="sc-question"
                        value={state.question}
                        onChange={(e) => setState({ ...state, question: e.target.value })}
                        placeholder={`e.g. ${example.question}`}
                        className="min-h-28 font-display text-lg leading-snug"
                        autoFocus
                      />
                      <FieldHint>Ask one narrow thing. Split independent questions into separate columns.</FieldHint>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="sc-instructions">Additional instructions (optional)</Label>
                      <Textarea
                        id="sc-instructions"
                        value={state.instructions}
                        onChange={(e) => setState({ ...state, instructions: e.target.value })}
                        placeholder="Definitions, edge cases, what to ignore…"
                      />
                    </div>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                      <span>
                        Offer an <span className="font-accent text-base">“Unclear”</span> option where appropriate
                      </span>
                      <Switch checked={state.unclearEnabled} onCheckedChange={(v) => setState({ ...state, unclearEnabled: v })} />
                    </label>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {TYPE_OPTIONS.map((opt) => {
                      const selected = state.type === opt.type;
                      return (
                        <motion.button
                          key={opt.type}
                          type="button"
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setState({ ...state, type: opt.type })}
                          className={cn(
                            "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-surface p-4 text-left transition-shadow",
                            selected ? "ring-aurora border-transparent shadow-hover" : "border-border hover:shadow-flat",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                              selected ? "bg-aurora text-[#0b0b0c]" : "bg-muted text-muted-foreground group-hover:rotate-[-6deg]",
                            )}
                          >
                            <opt.icon className="h-5 w-5" />
                          </span>
                          <span>
                            <span className="block font-display text-lg font-semibold">{opt.title}</span>
                            <span className="block text-xs text-muted-foreground">{opt.description}</span>
                          </span>
                          <span className="font-accent text-base text-foreground/70">“{opt.example}”</span>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {step === 3 && <LabelEditor state={state} onChange={setState} />}

                {step === 4 && (
                  <div className="flex flex-col gap-4">
                    {layaCrowded && (
                      <p className="rounded-xl border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-warning">
                        This column has {optionCount} options. Laya starts trimming option text past about {LAYA_COMFORTABLE_OPTIONS}, so similar labels may blur together. Consider Jev, or shorter descriptions.
                      </p>
                    )}
                    <ModelStep state={state} onChange={setState} previewResults={previewResults} />
                  </div>
                )}

                {step === 5 && (
                  <PreviewStep
                    results={previewResults}
                    loading={previewMutation.isPending}
                    sampleMode={sampleMode}
                    onSampleModeChange={setSampleMode}
                    onRun={runPreview}
                    modelName={modelDisplayName(state.modelProvider, state.modelIdentifier)}
                    settings={state.settings}
                  />
                )}

                {step === 6 && (
                  <div className="flex flex-col gap-4">
                    <RecipeCard state={state} large />
                    <p className="text-xs text-muted-foreground">
                      This runs <span className="font-medium text-foreground">{modelDisplayName(state.modelProvider, state.modelIdentifier)}</span> against every
                      eligible row in the background. Keep working while it runs; progress shows in the toolbar and the Jobs panel.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {!isLast ? (
              <Button type="button" onClick={() => goTo(step + 1)} disabled={!canAdvance[step]}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" variant="ai" size="lg" onClick={handleGenerate} loading={busy}>
                <Sparkles className="h-4 w-4" /> Generate column
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Running summary of what's been configured so far — the "recipe" the
 * column will be generated from. */
function RecipeCard({ state, large, className }: { state: BuilderState; large?: boolean; className?: string }) {
  const rows: { k: string; v: React.ReactNode }[] = [
    { k: "reads", v: state.sourceColumns.length ? state.sourceColumns.join(" + ") : "—" },
    { k: "answers", v: TYPE_SHORT[state.type] },
    { k: "model", v: modelDisplayName(state.modelProvider, state.modelIdentifier) },
    {
      k: "review",
      v: state.settings.lowConfidenceAction === "flag" ? `< ${Math.round(state.settings.confidenceThreshold * 100)}% conf.` : "off",
    },
  ];
  if (large) rows.push({ k: "runs", v: `${state.settings.concurrency}× parallel · ${state.settings.maxRetries} retries` });

  return (
    <div className={cn("ring-aurora flex flex-col gap-3 rounded-2xl bg-surface p-4", className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-aurora text-[#0b0b0c]">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className={cn("min-w-0 truncate font-display font-semibold", large ? "text-xl" : "text-sm")}>{state.name || "Untitled column"}</span>
      </div>
      {state.question && <p className={cn("font-accent leading-snug text-foreground/80", large ? "text-lg" : "line-clamp-3 text-sm")}>“{state.question}”</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
        {rows.map((r) => (
          <React.Fragment key={r.k}>
            <dt className="text-muted-foreground">{r.k}</dt>
            <dd className="min-w-0 truncate text-foreground/90">{r.v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
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
    modelProvider: state.modelProvider,
    modelIdentifier: state.modelIdentifier,
    settings: state.settings,
  };
}
