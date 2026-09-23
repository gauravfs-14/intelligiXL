"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-tight outline-none transition-[background-color,box-shadow,transform,border-color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-flat-sm hover:shadow-hover hover:brightness-110",
        secondary: "bg-surface text-foreground border border-border shadow-flat-sm hover:bg-muted hover:shadow-hover",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        outline: "bg-transparent text-foreground border border-border hover:bg-muted hover:border-border-strong/40",
        danger: "bg-danger text-danger-foreground shadow-flat-sm hover:shadow-hover hover:brightness-110",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-2.5 text-xs",
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
