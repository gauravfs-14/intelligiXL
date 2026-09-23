"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg";
}

const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

export function Sheet({ open, onOpenChange, title, description, children, width = "md" }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className={cn(
                  "fixed right-0 top-0 z-50 flex h-full w-[calc(100vw-2rem)] flex-col border-l border-border bg-popover text-popover-foreground shadow-float",
                  widths[width],
                )}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                  <div>
                    <Dialog.Title className="text-sm font-semibold tracking-tight">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-1 text-xs text-muted-foreground">{description}</Dialog.Description>
                    ) : (
                      <VisuallyHidden asChild>
                        <Dialog.Description>{title}</Dialog.Description>
                      </VisuallyHidden>
                    )}
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
