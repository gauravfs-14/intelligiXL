"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({ className, ...props }: SliderPrimitive.SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-5 w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-aurora" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block h-[18px] w-[18px] cursor-grab rounded-full border-[3px] border-foreground bg-background shadow-flat outline-none transition-transform hover:scale-110 focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-95 active:cursor-grabbing"
        />
      ))}
    </SliderPrimitive.Root>
  );
}
