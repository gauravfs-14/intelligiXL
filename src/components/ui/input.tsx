import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-shadow focus-visible:shadow-flat-sm disabled:opacity-40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full resize-y border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-shadow focus-visible:shadow-flat-sm disabled:opacity-40",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-xs font-semibold uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}

export function FieldHint({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}
