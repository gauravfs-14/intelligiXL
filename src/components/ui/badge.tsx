import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        neutral: "border-border-strong bg-surface text-foreground",
        accent: "border-accent bg-accent-muted text-accent",
        warning: "border-warning bg-warning-muted text-warning",
        danger: "border-danger bg-danger-muted text-danger",
        success: "border-success bg-success-muted text-success",
        muted: "border-border text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
