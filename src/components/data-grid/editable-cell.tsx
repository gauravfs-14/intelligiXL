"use client";

import * as React from "react";
import { ExpandableCell } from "./expandable-cell";

// Excel-style inline cell editing — double-click to edit, Enter/blur to
// commit, Escape to discard. Only fires the save callback when the value
// actually changed, so tabbing through cells without touching them is free.
export function EditableCell({ value, onSave, wrap }: { value: unknown; onSave: (next: string) => void; wrap?: boolean }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const original = value === null || value === undefined ? "" : String(value);

  function startEdit() {
    setDraft(original);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft !== original) onSave(draft);
  }

  React.useEffect(() => {
    if (!editing) return;
    const el = wrap ? textareaRef.current : inputRef.current;
    el?.focus();
    el?.select();
  }, [editing, wrap]);

  if (editing) {
    const shared = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && (wrap ? e.metaKey || e.ctrlKey : true)) {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
        }
        e.stopPropagation();
      },
    };
    if (wrap) {
      return (
        <textarea
          ref={textareaRef}
          {...shared}
          rows={3}
          className="w-full min-w-0 resize-none rounded-sm border-none bg-background px-1 py-1 text-sm outline-none ring-2 ring-primary/50"
        />
      );
    }
    return (
      <input
        ref={inputRef}
        {...shared}
        className="h-7 w-full min-w-0 rounded-sm border-none bg-background px-1 text-sm outline-none ring-2 ring-primary/50"
      />
    );
  }

  return (
    <div onDoubleClick={startEdit} className="w-full min-w-0 cursor-text" title="Double-click to edit">
      <ExpandableCell value={value} wrap={wrap} />
    </div>
  );
}
