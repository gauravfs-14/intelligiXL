"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: CheckboxPrimitive.CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center border border-border-strong bg-surface data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-foreground disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        {props.checked === "indeterminate" ? <Minus className="h-3 w-3" /> : <Check className="h-3 w-3" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
