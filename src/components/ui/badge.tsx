import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-tight transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface text-foreground",
        primary: "border-primary/20 bg-primary/10 text-primary",
        warning: "border-warning/30 bg-warning-muted text-warning",
        danger: "border-danger/30 bg-danger-muted text-danger",
        success: "border-success/30 bg-success-muted text-success",
        muted: "border-border bg-transparent text-muted-foreground",
        signal: "border-transparent bg-signal text-signal-foreground",
        ai: "border-transparent bg-aurora text-[#0b0b0c] font-semibold",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
