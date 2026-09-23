"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return <TabsPrimitive.List className={cn("inline-flex items-center gap-1 border-b border-border", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative px-3 py-2 text-sm font-medium text-muted transition-colors outline-none",
        "hover:text-foreground",
        "data-[state=active]:text-foreground",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:after:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}
