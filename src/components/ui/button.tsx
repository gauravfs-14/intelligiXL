"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium tracking-tight outline-none transition-[background-color,box-shadow,transform,border-color,opacity,color] duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Ink pill on paper, lime pill in the dark — the one loud button.
        primary:
          "bg-cta text-cta-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18),var(--shadow-flat-sm)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_0_0_4px_color-mix(in_oklab,var(--signal)_28%,transparent),var(--shadow-hover)]",
        // Anything that asks the model to do work: aurora fill + sweep.
        ai: "bg-aurora animate-aurora ai-sweep text-[#0b0b0c] font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.4),var(--shadow-flat-sm)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_0_24px_-4px_color-mix(in_oklab,var(--aurora-b)_70%,transparent)]",
        secondary: "bg-surface text-foreground border border-border shadow-flat-sm hover:bg-muted hover:shadow-hover",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        outline: "bg-transparent text-foreground border border-border hover:bg-muted hover:border-foreground/25",
        danger: "bg-danger text-danger-foreground shadow-flat-sm hover:shadow-hover hover:brightness-110",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
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

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size, loading, disabled, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        whileTap={!disabled && !loading ? { scale: 0.97 } : undefined}
        whileHover={!disabled && !loading && variant !== "link" ? { y: -1 } : undefined}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        {...props}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
        {children}
      </motion.button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
