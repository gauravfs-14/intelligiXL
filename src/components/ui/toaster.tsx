"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-2 border border-border-strong bg-surface px-4 py-3 text-sm text-foreground shadow-flat-sm w-full",
          error: "border-danger bg-danger-muted text-danger",
          success: "border-success bg-success-muted text-success",
          warning: "border-warning bg-warning-muted text-warning",
          title: "font-semibold",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
