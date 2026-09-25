"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NumericSummary } from "@/lib/eda/compute";
import { cn } from "@/lib/utils";

const tooltipStyle: React.CSSProperties = {
  background: "var(--color-popover)",
  color: "var(--color-popover-foreground)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-hover)",
  fontSize: 12,
};
const tick = { fontSize: 10, fill: "var(--color-muted-foreground)" };

export const SERIES = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

export function ChartFrame({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-md border border-border bg-background/40 p-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Vertical bars — histograms, weekday/month/hour breakdowns. */
export function ColumnChart({
  data,
  xKey = "label",
  yKey = "count",
  color = SERIES[0],
  height = 180,
}: {
  data: object[];
  xKey?: string;
  yKey?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap={data.length > 20 ? 1 : "15%"}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey={xKey} tick={tick} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: "var(--color-accent)" }} contentStyle={tooltipStyle} />
        <Bar dataKey={yKey} name="Rows" fill={color} radius={[3, 3, 0, 0]} animationDuration={400} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars with labels on the left — top values, top words, keys. */
export function RankedBars({
  data,
  color = SERIES[1],
  max = 10,
  formatPct = true,
}: {
  data: { value: string; count: number; pct: number }[];
  color?: string;
  max?: number;
  formatPct?: boolean;
}) {
  const rows = data.slice(0, max);
  const peak = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-muted-foreground">No values</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.value} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-xs">
          <div className="relative h-6 min-w-0 overflow-hidden rounded-sm bg-muted/60">
            <div className="absolute inset-y-0 left-0 rounded-sm opacity-70" style={{ width: `${(r.count / peak) * 100}%`, background: color }} />
            <span className="relative z-10 block truncate px-2 leading-6 text-foreground" title={r.value}>
              {r.value === "" ? <em className="text-muted-foreground">(empty)</em> : r.value}
            </span>
          </div>
          <span className="font-mono tabular-nums text-muted-foreground">
            {r.count.toLocaleString()}
            {formatPct && <span className="ml-1.5 text-muted-foreground/70">{(r.pct * 100).toFixed(1)}%</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Timeline({ data, height = 180 }: { data: { label: string; count: number }[]; height?: number }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[2]} stopOpacity={0.4} />
            <stop offset="100%" stopColor={SERIES[2]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} minTickGap={24} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="count" name="Rows" stroke={SERIES[2]} strokeWidth={2} fill={`url(#g${id})`} animationDuration={400} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 180 }: { data: { label: string; count: number }[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} />
            <Pie data={data} dataKey="count" nameKey="label" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none" animationDuration={400}>
              {data.map((d, i) => (
                <Cell key={d.label} fill={SERIES[i % SERIES.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex shrink-0 flex-col gap-1.5 text-xs">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
            <span className="text-foreground">{d.label}</span>
            <span className="font-mono tabular-nums text-muted-foreground">{total ? ((d.count / total) * 100).toFixed(1) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal box-and-whisker (whiskers at 1.5×IQR, clamped to min/max). */
export function BoxPlot({ summary, format }: { summary: NumericSummary; format: (v: number) => string }) {
  const { min, max, q1, q3, median, mean } = summary;
  const iqr = q3 - q1;
  const lo = Math.max(min, q1 - 1.5 * iqr);
  const hi = Math.min(max, q3 + 1.5 * iqr);
  const span = max - min || 1;
  const x = (v: number) => ((v - min) / span) * 100;
  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="relative h-14">
        <div className="absolute top-1/2 h-px bg-border-strong" style={{ left: `${x(lo)}%`, width: `${x(hi) - x(lo)}%` }} />
        <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-border-strong" style={{ left: `${x(lo)}%` }} />
        <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-border-strong" style={{ left: `${x(hi)}%` }} />
        <div
          className="absolute top-1/2 h-9 -translate-y-1/2 rounded-sm border border-primary/60 bg-primary/15"
          style={{ left: `${x(q1)}%`, width: `${Math.max(0.5, x(q3) - x(q1))}%` }}
        />
        <div className="absolute top-1/2 h-9 w-0.5 -translate-y-1/2 bg-primary" style={{ left: `${x(median)}%` }} title={`Median ${format(median)}`} />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-chart-4"
          style={{ left: `${x(mean)}%` }}
          title={`Mean ${format(mean)}`}
        />
        {min < lo && <div className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground" style={{ left: "0%" }} />}
        {max > hi && <div className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground" style={{ left: "100%" }} />}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{format(min)}</span>
        <span>
          Q1 {format(q1)} · Med {format(median)} · Q3 {format(q3)}
        </span>
        <span>{format(max)}</span>
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-0.5 bg-primary" /> median
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rotate-45 bg-chart-4" /> mean
        </span>
      </div>
    </div>
  );
}

/** Correlation heatmap: blue for negative, green for positive, sized by |r|. */
export function CorrelationHeatmap({ names, matrix }: { names: string[]; matrix: (number | null)[][] }) {
  const color = (r: number | null) => {
    if (r === null) return "transparent";
    const a = Math.min(1, Math.abs(r));
    return r >= 0 ? `color-mix(in oklab, var(--color-chart-1) ${a * 85}%, transparent)` : `color-mix(in oklab, var(--color-chart-3) ${a * 85}%, transparent)`;
  };
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th />
            {names.map((n) => (
              <th key={n} className="max-w-24 truncate px-1 pb-1 text-left font-medium text-muted-foreground" title={n}>
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((row, i) => (
            <tr key={row}>
              <th className="max-w-32 truncate pr-2 text-right font-medium text-muted-foreground" title={row}>
                {row}
              </th>
              {matrix[i].map((r, j) => (
                <td
                  key={j}
                  className="h-11 w-16 min-w-16 rounded-sm border border-border text-center font-mono tabular-nums"
                  style={{ background: color(r) }}
                  title={`${row} × ${names[j]}: ${r === null ? "n/a" : r.toFixed(3)}`}
                >
                  {r === null ? "—" : r.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
