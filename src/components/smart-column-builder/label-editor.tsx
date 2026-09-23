"use client";

import * as React from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { SmartColumnType } from "@/generated/prisma/browser";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BuilderState } from "./types";

export function LabelEditor({ state, onChange }: { state: BuilderState; onChange: (next: BuilderState) => void }) {
  if (state.type === SmartColumnType.BINARY) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">Optionally describe what counts as each outcome — this sharpens the model&apos;s judgment.</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="yes-desc">Yes means…</Label>
          <Input id="yes-desc" value={state.binaryYes} onChange={(e) => onChange({ ...state, binaryYes: e.target.value })} placeholder="Optional description" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="no-desc">No means…</Label>
          <Input id="no-desc" value={state.binaryNo} onChange={(e) => onChange({ ...state, binaryNo: e.target.value })} placeholder="Optional description" />
        </div>
      </div>
    );
  }

  if (state.type === SmartColumnType.CATEGORICAL) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Add at least two options. Descriptions are optional but improve accuracy.</p>
        {state.categorical.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={opt.key}
              onChange={(e) => {
                const next = [...state.categorical];
                next[i] = { ...next[i], key: e.target.value };
                onChange({ ...state, categorical: next });
              }}
              placeholder={`Option ${i + 1}`}
              className="w-40"
            />
            <Input
              value={opt.description}
              onChange={(e) => {
                const next = [...state.categorical];
                next[i] = { ...next[i], description: e.target.value };
                onChange({ ...state, categorical: next });
              }}
              placeholder="Description (optional)"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              disabled={state.categorical.length <= 2}
              onClick={() => onChange({ ...state, categorical: state.categorical.filter((_, j) => j !== i) })}
              aria-label="Remove option"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {state.categorical.length < 255 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => onChange({ ...state, categorical: [...state.categorical, { key: "", description: "" }] })}
          >
            <Plus className="h-3.5 w-3.5" /> Add option
          </Button>
        )}
      </div>
    );
  }

  // RATING
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">List levels from low to high (2–10). Order matters.</p>
      {state.rating.map((level, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border font-mono text-[11px] text-muted-foreground">{i}</span>
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={level}
            onChange={(e) => {
              const next = [...state.rating];
              next[i] = e.target.value;
              onChange({ ...state, rating: next });
            }}
            placeholder={`Level ${i + 1}`}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            type="button"
            disabled={state.rating.length <= 2}
            onClick={() => onChange({ ...state, rating: state.rating.filter((_, j) => j !== i) })}
            aria-label="Remove level"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {state.rating.length < 10 && (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onChange({ ...state, rating: [...state.rating, ""] })}>
          <Plus className="h-3.5 w-3.5" /> Add level
        </Button>
      )}
    </div>
  );
}
