"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium tracking-tight transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground border border-border-strong shadow-flat-sm",
        secondary: "bg-surface text-foreground border border-border-strong shadow-flat-sm",
        ghost: "bg-transparent text-foreground border border-transparent hover:border-border",
        outline: "bg-transparent text-foreground border border-border-strong",
        danger: "bg-danger text-danger-foreground border border-border-strong shadow-flat-sm",
      },
      size: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children?: React.ReactNode;
}

const shiftable = new Set(["primary", "secondary", "danger"]);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size, loading, disabled, children, ...props }, ref) => {
    const pressable = shiftable.has(variant ?? "primary");
    return (
      <motion.button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        whileTap={pressable && !disabled && !loading ? { x: 2, y: 2, boxShadow: "0 0 0 0 rgb(0 0 0)" } : undefined}
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        {...props}
      >
        {loading ? (
          <span className="h-3.5 w-3.5 animate-spin border-2 border-current border-t-transparent" aria-hidden />
        ) : null}
        {children}
      </motion.button>
    );
  },
);
Button.displayName = "Button";
