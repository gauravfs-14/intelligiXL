"use client";

import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

/** The one "stat tile" shape used by every dashboard-style page (Workspaces
 * home, per-workspace Overview) — mono label, big display number, icon in
 * the corner, with a matching loading skeleton and staggered fade-in. Kept
 * in one place so those pages can't quietly drift into slightly different
 * stat cards over time. `tone="ai"` gets the aurora treatment for numbers
 * the model produced. */
export function StatTile({
  icon: Icon,
  label,
  value,
  loading,
  delay = 0,
  tone,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  loading?: boolean;
  delay?: number;
  tone?: "primary" | "warning" | "ai";
  hint?: string;
  /** Makes the tile a button, e.g. jump to the Review queue. */
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()) : undefined}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-flat-sm transition-shadow hover:shadow-hover",
        onClick && "cursor-pointer",
        tone === "warning" && "border-warning/40",
        tone === "ai" && "ring-aurora border-transparent",
      )}
    >
      {tone === "ai" && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-aurora opacity-20 blur-2xl transition-opacity group-hover:opacity-35" aria-hidden />
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:rotate-[-8deg] group-hover:scale-110",
            tone === "primary" && "text-primary",
            tone === "warning" && "text-warning",
            tone === "ai" && "text-foreground",
          )}
        />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-14" />
      ) : (
        <p className={cn("mt-2 font-display text-[2rem] font-semibold leading-none tabular-nums", tone === "ai" && "text-aurora", tone === "warning" && "text-warning")}>
          {value}
        </p>
      )}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </motion.div>
  );
}
