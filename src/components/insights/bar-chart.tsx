"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function InsightBarChart<T extends object>({
  data,
  xKey,
  yKey,
  color = "var(--color-accent)",
  height = 260,
  formatY,
}: {
  data: T[];
  xKey: Extract<keyof T, string>;
  yKey: Extract<keyof T, string>;
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--color-muted)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} tickFormatter={formatY} />
        <Tooltip
          cursor={{ fill: "var(--color-accent-muted)" }}
          contentStyle={{
            background: "var(--color-foreground)",
            color: "var(--color-background)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 0,
            fontSize: 12,
          }}
        />
        <Bar dataKey={yKey} fill={color} radius={0} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}
