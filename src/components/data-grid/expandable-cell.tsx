"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** FR-005 "text expansion" — long source text truncates by default and
 * expands in a popover on click. */
export function ExpandableCell({ value }: { value: unknown }) {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.length === 0) return <span className="text-muted-foreground">—</span>;
  if (text.length <= 80) return <span className="block truncate text-sm">{text}</span>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="block w-full truncate text-left text-sm hover:underline" title="Click to expand">
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-h-80 w-96 overflow-y-auto whitespace-pre-wrap text-sm" align="start">
        {text}
      </PopoverContent>
    </Popover>
  );
}
