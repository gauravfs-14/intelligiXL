"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Cpu, Flag, Gauge, PlugZap, Sparkles, Timer, RotateCcw, Layers } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { InlineSpinner } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { useModels } from "@/hooks/use-models";
import {
  DEFAULT_SMART_COLUMN_SETTINGS,
  JEV_MODELS,
  SETTINGS_LIMITS,
  isLowConfidence,
  type ModelOption,
  type ModelProviderId,
  type ModelProviderInfo,
  type SmartColumnSettings,
} from "@/lib/decision-models/catalog";
import type { PreviewRowResult } from "@/lib/smart-columns/preview";
import type { BuilderState } from "./types";

const PROVIDER_META: Record<ModelProviderId, { icon: React.ComponentType<{ className?: string }>; blurb: string }> = {
  typesafe: { icon: Sparkles, blurb: "Calibrated System One models. Probabilities you can actually threshold on." },
  laya: { icon: Cpu, blurb: "Open-weights System One engine on your own hardware. One forward pass per question, 100+ languages." },
};

/** Until /api/models answers, assume Jev is there — it's the default and
 * the builder shouldn't flash an empty picker on open. */
const FALLBACK_PROVIDERS: ModelProviderInfo[] = [
  {
    id: "typesafe",
    name: "TypeSafe",
    tagline: "Jev",
    available: true,
    models: JEV_MODELS.map((m) => ({ ...m, available: true })),
  },
];

export function ModelStep({
  state,
  onChange,
  previewResults,
}: {
  state: BuilderState;
  onChange: (next: BuilderState) => void;
  previewResults: PreviewRowResult[] | null;
}) {
  const { data, isLoading } = useModels();
  const providers = data?.providers ?? FALLBACK_PROVIDERS;
  const setSettings = (patch: Partial<SmartColumnSettings>) => onChange({ ...state, settings: { ...state.settings, ...patch } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        {providers.map((p) => (
          <ProviderSection
            key={p.id}
            provider={p}
            selected={state.modelProvider === p.id ? state.modelIdentifier : null}
            onSelect={(m) => onChange({ ...state, modelProvider: m.provider, modelIdentifier: m.id })}
          />
        ))}
        {isLoading && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <InlineSpinner /> Checking which models are reachable…
          </p>
        )}
      </div>

      <ThresholdCard settings={state.settings} onChange={setSettings} previewResults={previewResults} />
      <AdvancedSettings settings={state.settings} onChange={setSettings} />
    </div>
  );
}

function ProviderSection({
  provider,
  selected,
  onSelect,
}: {
  provider: ModelProviderInfo;
  selected: string | null;
  onSelect: (m: ModelOption) => void;
}) {
  const meta = PROVIDER_META[provider.id];
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const Icon = meta?.icon ?? Cpu;
  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h3 className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {provider.name}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{meta?.blurb}</p>
      </div>

      {!provider.available || provider.models.length === 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <PlugZap className="h-4 w-4" />
          </div>
          <div className="min-w-0 text-sm">
            <p className="font-medium">Not connected</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {provider.unavailableReason ?? "No models are reachable for this provider right now."}
            </p>
            {provider.id === "laya" && (
              <code className="mt-2 inline-block rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-foreground/80">make laya</code>
            )}
            {workspaceId && (
              <Link href={`/w/${workspaceId}/settings`} className="mt-2 block text-xs font-medium text-primary underline-offset-4 hover:underline">
                Open Settings →
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className={cn("grid grid-cols-1 gap-2.5", provider.models.length % 3 === 0 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {provider.models.map((m) => (
            <ModelCard key={`${m.provider}:${m.id}`} model={m} selected={selected === m.id} onSelect={() => onSelect(m)} />
          ))}
        </div>
      )}
    </section>
  );
}

function ModelCard({ model, selected, onSelect }: { model: ModelOption; selected: boolean; onSelect: () => void }) {
  const disabled = !model.available;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      title={disabled ? model.unavailableReason : undefined}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-2xl border bg-surface p-3.5 text-left transition-[border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "ring-aurora border-transparent shadow-hover" : "border-border hover:border-foreground/20 hover:shadow-flat",
      )}
      aria-pressed={selected}
    >
      {selected && <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-aurora opacity-25 blur-2xl" aria-hidden />}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="font-display text-lg font-semibold leading-none">{model.name}</span>
          <span className="truncate whitespace-nowrap font-mono text-[11px] text-muted-foreground">{model.variant}</span>
        </span>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected ? "border-transparent bg-foreground text-background" : "border-border text-transparent group-hover:border-foreground/30",
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      </div>
      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{model.description}</p>
      <div className="mt-auto flex flex-wrap gap-1 pt-1">
        {model.recommended && <Badge tone="signal">Recommended</Badge>}
        {model.tags.map((t) => (
          <Badge key={t} tone="muted">
            {t}
          </Badge>
        ))}
      </div>
    </motion.button>
  );
}

function ThresholdCard({
  settings,
  onChange,
  previewResults,
}: {
  settings: SmartColumnSettings;
  onChange: (patch: Partial<SmartColumnSettings>) => void;
  previewResults: PreviewRowResult[] | null;
}) {
  const pct = Math.round(settings.confidenceThreshold * 100);
  // The strip shares the slider's 50–99% scale so the zone edge sits exactly
  // under the thumb; preview ticks below 50% pin to the left edge.
  const { min, max } = SETTINGS_LIMITS.confidenceThreshold;
  const toPos = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const thresholdPos = toPos(settings.confidenceThreshold);
  const flagging = settings.lowConfidenceAction === "flag";
  const scored = previewResults?.filter((r) => r.result.status === "success") ?? [];
  const flaggedInPreview = scored.filter((r) => r.result.status === "success" && isLowConfidence(r.result.confidence, settings)).length;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" /> Confidence threshold
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {flagging ? (
              <>
                Anything under <span className="font-semibold text-foreground">{pct}%</span> gets flagged for a human to check in Review.
              </>
            ) : (
              <>Every prediction is recorded as-is. Nothing gets flagged.</>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("font-display text-4xl font-semibold leading-none tabular-nums transition-opacity", !flagging && "opacity-30")}>
            {pct}
            <span className="text-xl text-muted-foreground">%</span>
          </p>
          {scored.length > 0 && flagging && (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {flaggedInPreview}/{scored.length} preview rows flagged
            </p>
          )}
        </div>
      </div>

      <div className={cn("mt-4 transition-opacity", !flagging && "pointer-events-none opacity-40")}>
        {/* Zone strip: review zone (hatched) up to the threshold, auto-accept after. */}
        <div className="relative mb-2 flex h-7 overflow-hidden rounded-lg border border-border font-mono text-[10px] uppercase tracking-wider">
          <div
            className="flex items-center justify-center bg-[repeating-linear-gradient(135deg,var(--warning-muted)_0_6px,transparent_6px_12px)] text-warning transition-[width] duration-150"
            style={{ width: `${thresholdPos}%` }}
          >
            {thresholdPos > 22 && (
              <span className="flex items-center gap-1">
                <Flag className="h-3 w-3" /> review
              </span>
            )}
          </div>
          <div className="flex flex-1 items-center justify-center bg-accent text-accent-foreground">{thresholdPos < 78 && "auto-accept"}</div>
          {scored.map((r) =>
            r.result.status === "success" ? (
              <span
                key={r.rowId}
                className="absolute top-1/2 h-3 w-[3px] -translate-y-1/2 rounded-full bg-foreground/70"
                style={{ left: `calc(${toPos(r.result.confidence)}% - 1.5px)` }}
                title={`Row ${r.rowIndex + 1}: ${Math.round(r.result.confidence * 100)}%`}
              />
            ) : null,
          )}
        </div>
        <Slider
          value={[settings.confidenceThreshold]}
          min={SETTINGS_LIMITS.confidenceThreshold.min}
          max={SETTINGS_LIMITS.confidenceThreshold.max}
          step={SETTINGS_LIMITS.confidenceThreshold.step}
          onValueChange={([v]) => onChange({ confidenceThreshold: v })}
          aria-label="Confidence threshold"
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>50% · lenient</span>
          <span>99% · paranoid</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-xs font-medium">
        {(
          [
            { value: "flag", label: "Flag for review" },
            { value: "none", label: "Just record it" },
          ] as const
        ).map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange({ lowConfidenceAction: o.value })}
            className={cn(
              "relative rounded-lg px-3 py-1.5 transition-colors",
              settings.lowConfidenceAction === o.value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {settings.lowConfidenceAction === o.value && (
              <motion.span layoutId="low-conf-action" className="absolute inset-0 rounded-lg bg-surface shadow-flat-sm" transition={{ type: "spring", stiffness: 500, damping: 36 }} />
            )}
            <span className="relative">{o.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AdvancedSettings({ settings, onChange }: { settings: SmartColumnSettings; onChange: (patch: Partial<SmartColumnSettings>) => void }) {
  const [open, setOpen] = React.useState(false);
  const isDefault =
    settings.concurrency === DEFAULT_SMART_COLUMN_SETTINGS.concurrency &&
    settings.timeoutMs === DEFAULT_SMART_COLUMN_SETTINGS.timeoutMs &&
    settings.maxRetries === DEFAULT_SMART_COLUMN_SETTINGS.maxRetries;

  return (
    <section className="rounded-2xl border border-border">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2 text-sm font-semibold">
          Advanced
          <span className="font-mono text-[11px] font-normal text-muted-foreground">
            {settings.concurrency}× parallel · {settings.timeoutMs / 1000}s timeout · {settings.maxRetries} retries
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 border-t border-border px-4 py-4">
              <SliderRow
                icon={Layers}
                label="Parallel requests"
                hint="Higher is faster, until you hit the provider's rate limit."
                value={settings.concurrency}
                display={`${settings.concurrency}×`}
                limits={SETTINGS_LIMITS.concurrency}
                onChange={(v) => onChange({ concurrency: v })}
              />
              <SliderRow
                icon={Timer}
                label="Request timeout"
                hint="Per attempt. Long rows on a slow local model may need more."
                value={settings.timeoutMs}
                display={`${settings.timeoutMs / 1000}s`}
                limits={SETTINGS_LIMITS.timeoutMs}
                onChange={(v) => onChange({ timeoutMs: v })}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-xs font-medium">
                    <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /> Retries
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">On timeouts, rate limits and 5xx errors.</p>
                </div>
                <div className="flex gap-1 rounded-xl bg-muted p-1">
                  {Array.from({ length: SETTINGS_LIMITS.maxRetries.max + 1 }, (_, n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onChange({ maxRetries: n })}
                      className={cn(
                        "h-7 w-7 rounded-lg font-mono text-xs transition-colors",
                        settings.maxRetries === n ? "bg-surface text-foreground shadow-flat-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {!isDefault && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      concurrency: DEFAULT_SMART_COLUMN_SETTINGS.concurrency,
                      timeoutMs: DEFAULT_SMART_COLUMN_SETTINGS.timeoutMs,
                      maxRetries: DEFAULT_SMART_COLUMN_SETTINGS.maxRetries,
                    })
                  }
                  className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Reset to defaults
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SliderRow({
  icon: Icon,
  label,
  hint,
  value,
  display,
  limits,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  value: number;
  display: string;
  limits: { min: number; max: number; step: number };
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="font-mono text-sm tabular-nums">{display}</span>
      </div>
      <Slider value={[value]} min={limits.min} max={limits.max} step={limits.step} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  );
}
