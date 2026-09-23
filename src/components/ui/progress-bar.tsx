"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  tone?: "accent" | "success" | "danger" | "warning";
  label?: string;
}

const toneClass = { accent: "bg-accent", success: "bg-success", danger: "bg-danger", warning: "bg-warning" };

export function ProgressBar({ value, max = 100, className, tone = "accent", label }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn("w-full", className)}>
      <ProgressPrimitive.Root
        value={pct}
        max={100}
        aria-label={label}
        className="relative h-2.5 w-full overflow-hidden border border-border-strong bg-surface"
      >
        <ProgressPrimitive.Indicator asChild>
          <motion.div
            className={cn("h-full", toneClass[tone])}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </ProgressPrimitive.Indicator>
      </ProgressPrimitive.Root>
    </div>
  );
}
