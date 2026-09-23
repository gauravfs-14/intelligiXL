import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("border border-border-strong bg-surface", className)}
      {...props}
    />
  );
}

export function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 border-b border-border px-4 py-3", className)}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-sm font-semibold tracking-tight", className)} {...props} />;
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}
