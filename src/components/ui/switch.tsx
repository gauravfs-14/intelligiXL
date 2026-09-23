"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-5 w-9 shrink-0 border border-border-strong bg-surface transition-colors data-[state=checked]:bg-accent disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-3.5 w-3.5 translate-x-0.5 bg-foreground transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-foreground" />
    </SwitchPrimitive.Root>
  );
}
