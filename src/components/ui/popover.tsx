"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({ className, sideOffset = 6, ...props }: PopoverPrimitive.PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 border border-border-strong bg-surface p-3 shadow-flat-sm outline-none",
          "data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity duration-150",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
