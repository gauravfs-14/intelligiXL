"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Prevent closing via overlay click / Escape — for in-progress work. */
  preventClose?: boolean;
}

const sizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

export function Modal({ open, onOpenChange, title, description, children, size = "md", preventClose }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-foreground/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              onEscapeKeyDown={(e) => preventClose && e.preventDefault()}
              onPointerDownOutside={(e) => preventClose && e.preventDefault()}
              onInteractOutside={(e) => preventClose && e.preventDefault()}
            >
              <motion.div
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col border border-border-strong bg-surface shadow-flat",
                  sizes[size],
                )}
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 4 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                  <div>
                    <Dialog.Title className="text-sm font-semibold tracking-tight">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                        {description}
                      </Dialog.Description>
                    ) : (
                      <VisuallyHidden asChild>
                        <Dialog.Description>{title}</Dialog.Description>
                      </VisuallyHidden>
                    )}
                  </div>
                  {!preventClose && (
                    <Dialog.Close asChild>
                      <button
                        className="flex h-7 w-7 shrink-0 items-center justify-center border border-transparent text-muted transition-colors hover:border-border-strong hover:text-foreground"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </Dialog.Close>
                  )}
                </div>
                <div className="overflow-y-auto px-5 py-4">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
