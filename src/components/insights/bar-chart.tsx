"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function InsightBarChart<T extends object>({
  data,
  xKey,
  yKey,
  color = "var(--color-primary)",
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
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={formatY} />
        <Tooltip
          cursor={{ fill: "var(--color-accent)" }}
          contentStyle={{
            background: "var(--color-popover)",
            color: "var(--color-popover-foreground)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-hover)",
            fontSize: 12,
          }}
        />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={56} animationDuration={500} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}
