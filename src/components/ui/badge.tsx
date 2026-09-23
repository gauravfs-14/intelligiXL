import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface text-foreground",
        primary: "border-primary/20 bg-primary/10 text-primary",
        warning: "border-warning/30 bg-warning-muted text-warning",
        danger: "border-danger/30 bg-danger-muted text-danger",
        success: "border-success/30 bg-success-muted text-success",
        muted: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
