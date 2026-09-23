"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: DropdownMenuPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[10rem] origin-[var(--radix-dropdown-menu-content-transform-origin)] border border-border-strong bg-surface p-1 text-sm shadow-flat-sm transition-[opacity,transform] duration-150",
          "data-[state=closed]:scale-95 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, inset, ...props }: DropdownMenuPrimitive.DropdownMenuItemProps & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        inset && "pl-7",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({ className, children, checked, ...props }: DropdownMenuPrimitive.DropdownMenuCheckboxItemProps) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 py-1.5 pl-7 pr-2 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: DropdownMenuPrimitive.DropdownMenuLabelProps) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: DropdownMenuPrimitive.DropdownMenuSeparatorProps) {
  return <DropdownMenuPrimitive.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}

export function DropdownMenuSubTrigger({ className, children, ...props }: DropdownMenuPrimitive.DropdownMenuSubTriggerProps) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-3.5 w-3.5" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({ className, ...props }: DropdownMenuPrimitive.DropdownMenuSubContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        className={cn("z-50 min-w-[8rem] border border-border-strong bg-surface p-1 shadow-flat-sm", className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}
