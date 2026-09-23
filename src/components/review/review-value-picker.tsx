"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SmartColumnVersionDto } from "@/types/workbench";

/** FR-027 — the human-assigned value, constrained to the same label set the
 * AI could have chosen from, so corrections stay comparable to predictions. */
export function ReviewValuePicker({
  version,
  value,
  onChange,
}: {
  version: SmartColumnVersionDto;
  value: string | null;
  onChange: (value: string) => void;
}) {
  const options: string[] = Array.isArray(version.labels)
    ? (version.labels as string[])
    : Object.keys(version.labels as Record<string, unknown>);

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <Button
          key={opt}
          type="button"
          size="sm"
          variant={value === opt ? "primary" : "outline"}
          onClick={() => onChange(opt)}
          className={cn(value === opt && "ring-2 ring-accent ring-offset-1 ring-offset-background")}
        >
          {opt}
        </Button>
      ))}
    </div>
  );
}
