"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/utils";
import type { SmartColumnFilter } from "./filters";

// FR-022/023 — filter a Smart Column by label and/or a confidence range.
export function SmartColumnFilterPopover({
  open,
  onOpenChange,
  labels,
  value,
  onChange,
  anchor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: string[];
  value: SmartColumnFilter;
  onChange: (next: SmartColumnFilter) => void;
  anchor: React.ReactNode;
}) {
  // Driven directly from `value` (no local mirror state) so an external
  // reset — e.g. the toolbar's "clear all filters" — is reflected
  // immediately without needing an effect to resync anything.
  const range: [number, number] = [Math.round((value.minConfidence ?? 0) * 100), Math.round((value.maxConfidence ?? 1) * 100)];

  function toggleLabel(label: string) {
    const current = value.labels ?? [];
    const next = current.includes(label) ? current.filter((l) => l !== label) : [...current, label];
    onChange({ ...value, labels: next.length > 0 ? next : undefined });
  }

  function applyRange(next: [number, number]) {
    onChange({ ...value, minConfidence: next[0] / 100, maxConfidence: next[1] / 100 });
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent className="w-72" align="start">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Labels</p>
            <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
              {labels.map((label) => (
                <label key={label} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={(value.labels ?? []).includes(label)} onCheckedChange={() => toggleLabel(label)} />
                  <span className="truncate">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Confidence</span>
              <span className="font-mono text-foreground">
                {formatPercent(range[0] / 100)}–{formatPercent(range[1] / 100)}
              </span>
            </p>
            <Slider min={0} max={100} step={1} value={range} onValueChange={(v) => applyRange(v as [number, number])} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            Clear filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
