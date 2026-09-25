"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border border-input bg-muted transition-colors data-[state=checked]:border-transparent data-[state=checked]:bg-signal disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-background shadow-flat-sm transition-transform data-[state=checked]:bg-[#0b0b0c] data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}
