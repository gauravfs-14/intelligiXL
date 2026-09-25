"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BoxPlot, ChartFrame, ColumnChart, Donut, RankedBars, SERIES, Timeline } from "./charts";
import { KIND_META } from "./kind-meta";
import type {
  BooleanProfile,
  CategoryProfile,
  ColumnProfile,
  DateProfile,
  EdaKind,
  JsonProfile,
  NumberProfile,
  NumericSummary,
  TextProfile,
} from "@/lib/eda/compute";

function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return v.toLocaleString();
  const abs = Math.abs(v);
  if (abs >= 1e6) return v.toExponential(2);
  return v.toLocaleString(undefined, { maximumFractionDigits: abs >= 100 ? 1 : digits });
}
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");
const fmtDate = (iso: string | null, withTime: boolean) =>
  iso ? (withTime ? iso.replace("T", " ").slice(0, 16) : iso.slice(0, 10)) : "—";

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "warning" | "danger" }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border bg-background/40 px-3 py-2">
      <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`truncate font-mono text-sm tabular-nums ${tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground"}`}>
        {value}
      </span>
      {sub && <span className="truncate text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{children}</p>;
}

/** Compact min/mean/median/max/std table for one or more derived measures. */
function SummaryTable({ rows }: { rows: { label: string; unit?: string; s: NumericSummary | null }[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {["Measure", "Min", "Mean", "Median", "Max", "Std dev", "P5", "P95"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold first:w-40">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map(({ label, unit, s }) => (
            <tr key={label} className="border-t border-border">
              <td className="px-3 py-2 font-sans font-medium text-foreground">
                {label}
                {unit && <span className="ml-1 text-muted-foreground">({unit})</span>}
              </td>
              {s ? (
                [s.min, s.mean, s.median, s.max, s.std, s.p5, s.p95].map((v, i) => (
                  <td key={i} className="px-3 py-2">
                    {fmt(v)}
                  </td>
                ))
              ) : (
                <td colSpan={7} className="px-3 py-2 text-muted-foreground">
                  —
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Completeness({ p }: { p: ColumnProfile }) {
  const presentPct = p.total ? (p.present / p.total) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-success" style={{ width: `${presentPct}%` }} />
        <div className="h-full bg-danger/60" style={{ width: `${100 - presentPct}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          <span className="font-mono text-foreground">{p.present.toLocaleString()}</span> present ({pct(p.present, p.total)})
        </span>
        <span>
          <span className={`font-mono ${p.missing ? "text-danger" : "text-foreground"}`}>{p.missing.toLocaleString()}</span> missing ({pct(p.missing, p.total)})
        </span>
        <span>
          <span className="font-mono text-foreground">{p.unique.toLocaleString()}</span> distinct ({pct(p.unique, p.present)} of present)
        </span>
      </div>
    </div>
  );
}

// --- Per-kind bodies ---------------------------------------------------------

function NumberBody({ p }: { p: NumberProfile }) {
  const s = p.summary;
  if (!s) return <p className="text-sm text-muted-foreground">No numeric values to analyze.</p>;
  const skewLabel = Math.abs(p.skewness) < 0.5 ? "≈ symmetric" : p.skewness > 0 ? "right-skewed" : "left-skewed";
  const outliers = p.outliersLow + p.outliersHigh;
  return (
    <>
      <StatGrid>
        <Stat label="Mean" value={fmt(s.mean)} />
        <Stat label="Median" value={fmt(s.median)} />
        <Stat label="Std dev" value={fmt(s.std)} sub={p.cv !== null ? `CV ${fmt(p.cv * 100, 1)}%` : undefined} />
        <Stat label="Min" value={fmt(s.min)} />
        <Stat label="Max" value={fmt(s.max)} />
        <Stat label="Range" value={fmt(p.range)} />
        <Stat label="Q1 / Q3" value={`${fmt(s.q1)} / ${fmt(s.q3)}`} sub={`IQR ${fmt(p.iqr)}`} />
        <Stat label="Sum" value={fmt(p.sum)} />
        <Stat label="Variance" value={fmt(p.variance)} />
        <Stat label="Skewness" value={fmt(p.skewness)} sub={skewLabel} />
        <Stat label="Kurtosis" value={fmt(p.kurtosis)} sub={p.kurtosis > 1 ? "heavy tails" : p.kurtosis < -1 ? "light tails" : "near normal"} />
        <Stat label="Outliers" value={outliers.toLocaleString()} sub={`${p.outliersLow} low · ${p.outliersHigh} high`} tone={outliers ? "warning" : undefined} />
        <Stat label="Zeros" value={p.zeros.toLocaleString()} sub={pct(p.zeros, s.count)} />
        <Stat label="Negatives" value={p.negatives.toLocaleString()} sub={pct(p.negatives, s.count)} />
        <Stat label="Integers" value={pct(p.integers, s.count)} />
        {p.unparseable > 0 && <Stat label="Non-numeric" value={p.unparseable.toLocaleString()} tone="danger" sub="ignored" />}
      </StatGrid>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartFrame title="Distribution" hint={`${p.histogram.length} bins`}>
          <ColumnChart data={p.histogram} />
        </ChartFrame>
        <ChartFrame title="Box plot" hint="whiskers at 1.5×IQR">
          <BoxPlot summary={s} format={(v) => fmt(v)} />
        </ChartFrame>
        <ChartFrame title="Most frequent values" className="lg:col-span-2">
          <RankedBars data={p.topValues} color={SERIES[2]} />
        </ChartFrame>
      </div>
    </>
  );
}

function TextBody({ p }: { p: TextProfile }) {
  return (
    <>
      <StatGrid>
        <Stat label="Avg characters" value={fmt(p.charLength?.mean, 1)} sub={`${fmt(p.charLength?.min)}–${fmt(p.charLength?.max)}`} />
        <Stat label="Avg words" value={fmt(p.wordCount?.mean, 1)} sub={`${fmt(p.wordCount?.min)}–${fmt(p.wordCount?.max)}`} />
        <Stat label="Avg sentences" value={fmt(p.sentenceCount?.mean, 1)} sub={`${fmt(p.sentenceCount?.min)}–${fmt(p.sentenceCount?.max)}`} />
        <Stat label="Avg word length" value={fmt(p.wordLength?.mean, 1)} sub="characters" />
        <Stat label="Total words" value={p.totalWords.toLocaleString()} />
        <Stat label="Vocabulary" value={p.vocabularySize.toLocaleString()} sub={`diversity ${fmt(p.lexicalDiversity, 3)}`} />
        {p.empty > 0 && <Stat label="Blank strings" value={p.empty.toLocaleString()} tone="warning" />}
        <Stat label="Duplicates" value={(p.present - p.unique).toLocaleString()} sub={pct(p.present - p.unique, p.present)} />
      </StatGrid>

      <div className="flex flex-col gap-2">
        <SectionLabel>Length statistics</SectionLabel>
        <SummaryTable
          rows={[
            { label: "Character length", unit: "chars", s: p.charLength },
            { label: "Word count", unit: "words", s: p.wordCount },
            { label: "Sentence count", unit: "sentences", s: p.sentenceCount },
            { label: "Word length", unit: "chars", s: p.wordLength },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartFrame title="Character length distribution">
          <ColumnChart data={p.charHistogram} color={SERIES[0]} />
        </ChartFrame>
        <ChartFrame title="Word count distribution">
          <ColumnChart data={p.wordHistogram} color={SERIES[1]} />
        </ChartFrame>
        <ChartFrame title="Top words" hint="stopwords removed">
          <RankedBars data={p.topWords} color={SERIES[2]} max={12} formatPct={false} />
        </ChartFrame>
        <ChartFrame title="Top bigrams">
          <RankedBars data={p.topBigrams} color={SERIES[3]} max={12} formatPct={false} />
        </ChartFrame>
        <ChartFrame title="Content patterns" hint="rows matching">
          <RankedBars
            data={p.patterns.map((x) => ({ value: x.label, count: x.count, pct: p.present ? x.count / p.present : 0 }))}
            color={SERIES[4]}
          />
        </ChartFrame>
        <ChartFrame title="Most repeated values">
          <RankedBars data={p.topValues.filter((t) => t.count > 1)} color={SERIES[1]} max={8} />
        </ChartFrame>
      </div>

      {(p.shortest !== null || p.longest !== null) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[
            ["Shortest value", p.shortest],
            ["Longest value", p.longest],
          ].map(([label, v]) => (
            <div key={label} className="rounded-md border border-border bg-background/40 p-3">
              <p className="mb-1 text-xs font-semibold">
                {label} <span className="font-normal text-muted-foreground">· {v?.length ?? 0} chars</span>
              </p>
              <p className="line-clamp-4 whitespace-pre-wrap break-words text-xs text-muted-foreground">{v || <em>(empty)</em>}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CategoryBody({ p }: { p: CategoryProfile }) {
  const donutData = [
    ...p.topValues.slice(0, 5).map((t) => ({ label: t.value || "(empty)", count: t.count })),
    ...(p.present - p.topValues.slice(0, 5).reduce((s, t) => s + t.count, 0) > 0
      ? [{ label: "Other", count: p.present - p.topValues.slice(0, 5).reduce((s, t) => s + t.count, 0) }]
      : []),
  ];
  const imbalance = p.modePct >= 0.8 ? "highly imbalanced" : p.modePct >= 0.5 ? "dominant class" : "balanced-ish";
  return (
    <>
      <StatGrid>
        <Stat label="Categories" value={p.unique.toLocaleString()} />
        <Stat label="Mode" value={p.mode || "—"} sub={`${(p.modePct * 100).toFixed(1)}% of rows`} />
        <Stat label="Balance" value={imbalance} tone={p.modePct >= 0.8 ? "warning" : undefined} />
        <Stat label="Entropy" value={`${fmt(p.entropy, 2)} bits`} sub={`normalized ${fmt(p.normalizedEntropy, 2)}`} />
        <Stat label="Singletons" value={p.singletons.toLocaleString()} sub="appear once" />
        <Stat label="Outside top 20" value={p.otherCount.toLocaleString()} sub={pct(p.otherCount, p.present)} />
      </StatGrid>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartFrame title="Frequency" hint={p.unique > 20 ? "top 20" : undefined}>
          <RankedBars data={p.topValues} max={20} />
        </ChartFrame>
        <ChartFrame title="Share">
          <Donut data={donutData} height={220} />
        </ChartFrame>
      </div>
    </>
  );
}

function BooleanBody({ p }: { p: BooleanProfile }) {
  return (
    <>
      <StatGrid>
        <Stat label="True" value={p.trueCount.toLocaleString()} sub={pct(p.trueCount, p.trueCount + p.falseCount)} />
        <Stat label="False" value={p.falseCount.toLocaleString()} sub={pct(p.falseCount, p.trueCount + p.falseCount)} />
        <Stat label="True ratio" value={fmt(p.trueRatio, 3)} />
        <Stat label="Odds (T:F)" value={p.falseCount ? fmt(p.trueCount / p.falseCount, 2) : "∞"} />
        {p.invalid > 0 && <Stat label="Unrecognized" value={p.invalid.toLocaleString()} tone="danger" />}
      </StatGrid>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartFrame title="True vs false">
          <Donut
            data={[
              { label: "True", count: p.trueCount },
              { label: "False", count: p.falseCount },
              ...(p.missing ? [{ label: "Missing", count: p.missing }] : []),
            ]}
          />
        </ChartFrame>
        <ChartFrame title="Counts">
          <ColumnChart
            data={[
              { label: "True", count: p.trueCount },
              { label: "False", count: p.falseCount },
              { label: "Missing", count: p.missing },
            ]}
            color={SERIES[1]}
          />
        </ChartFrame>
      </div>
    </>
  );
}

function DateBody({ p }: { p: DateProfile }) {
  const busiestDay = [...p.byWeekday].sort((a, b) => b.count - a.count)[0];
  const span =
    p.spanDays >= 730 ? `${fmt(p.spanDays / 365.25, 1)} years` : p.spanDays >= 60 ? `${fmt(p.spanDays / 30.44, 1)} months` : `${fmt(p.spanDays, 1)} days`;
  return (
    <>
      <StatGrid>
        <Stat label="Earliest" value={fmtDate(p.min, p.hasTime)} />
        <Stat label="Latest" value={fmtDate(p.max, p.hasTime)} />
        <Stat label="Median" value={fmtDate(p.median, p.hasTime)} />
        <Stat label="Span" value={span} />
        <Stat label="Busiest weekday" value={busiestDay?.count ? busiestDay.label : "—"} />
        <Stat label="Weekend" value={`${(p.weekendPct * 100).toFixed(1)}%`} />
        <Stat label="Distinct days" value={p.unique.toLocaleString()} />
        {p.invalid > 0 && <Stat label="Unparseable" value={p.invalid.toLocaleString()} tone="danger" />}
      </StatGrid>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartFrame title="Over time" hint={`per ${p.timelineGranularity}`} className="lg:col-span-2">
          <Timeline data={p.timeline} />
        </ChartFrame>
        <ChartFrame title="By weekday">
          <ColumnChart data={p.byWeekday} color={SERIES[0]} />
        </ChartFrame>
        <ChartFrame title="By month">
          <ColumnChart data={p.byMonth} color={SERIES[1]} />
        </ChartFrame>
        {p.hasTime && (
          <ChartFrame title="By hour of day" hint="UTC" className="lg:col-span-2">
            <ColumnChart data={p.byHour} color={SERIES[3]} />
          </ChartFrame>
        )}
      </div>
    </>
  );
}

function JsonBody({ p }: { p: JsonProfile }) {
  return (
    <>
      <StatGrid>
        <Stat label="Avg keys" value={fmt(p.keyCount?.mean, 1)} sub={p.keyCount ? `${fmt(p.keyCount.min)}–${fmt(p.keyCount.max)}` : "no objects"} />
        <Stat label="Avg array length" value={fmt(p.arrayLength?.mean, 1)} sub={p.arrayLength ? `${fmt(p.arrayLength.min)}–${fmt(p.arrayLength.max)}` : "no arrays"} />
        <Stat label="Max depth" value={fmt(p.depth?.max)} sub={`avg ${fmt(p.depth?.mean, 1)}`} />
        <Stat label="Avg size" value={`${fmt(p.serializedLength?.mean, 0)} chars`} />
        <Stat label="Distinct keys" value={p.keyFrequency.length.toLocaleString()} sub={p.keyFrequency.length >= 15 ? "top 15 shown" : undefined} />
      </StatGrid>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartFrame title="Value shapes">
          <Donut data={p.shapes} />
        </ChartFrame>
        <ChartFrame title="Key presence" hint="% of objects">
          <RankedBars data={p.keyFrequency} color={SERIES[2]} max={15} />
        </ChartFrame>
      </div>
    </>
  );
}

export interface ColumnProfileCardProps {
  name: string;
  sourceLabel: string;
  kind: EdaKind;
  availableKinds: EdaKind[];
  onKindChange: (kind: EdaKind) => void;
  onRemove: () => void;
  profile: ColumnProfile;
}

export function ColumnProfileCard({ name, sourceLabel, kind, availableKinds, onKindChange, onRemove, profile }: ColumnProfileCardProps) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <Panel>
      <PanelHeader className="flex-wrap">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <PanelTitle className="truncate">{name}</PanelTitle>
          <Badge tone="muted">{sourceLabel}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Analyze as</span>
          <Select value={kind} onValueChange={(v) => onKindChange(v as EdaKind)}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableKinds.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_META[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Remove ${name}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </PanelHeader>
      <PanelBody className="flex flex-col gap-4">
        <Completeness p={profile} />
        {profile.kind === "NUMBER" && <NumberBody p={profile} />}
        {profile.kind === "TEXT" && <TextBody p={profile} />}
        {profile.kind === "CATEGORY" && <CategoryBody p={profile} />}
        {profile.kind === "BOOLEAN" && <BooleanBody p={profile} />}
        {profile.kind === "DATE" && <DateBody p={profile} />}
        {profile.kind === "JSON" && <JsonBody p={profile} />}
      </PanelBody>
    </Panel>
  );
}
