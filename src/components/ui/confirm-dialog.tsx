"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  /** Bullet list of what will be affected. */
  details?: React.ReactNode[];
  confirmLabel?: string;
  /** Destructive styling (default true). */
  danger?: boolean;
  /** Require typing this exact text to enable the confirm button. */
  confirmText?: string;
  /** Short reassurance, e.g. "You can undo this from the change log." */
  note?: React.ReactNode;
}

type Resolver = (confirmed: boolean) => void;

const ConfirmContext = React.createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/** App-wide themed replacement for `window.confirm`. Use via `useConfirm()`:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete template?" }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = React.useState("");
  const resolver = React.useRef<Resolver | null>(null);

  const confirm = React.useCallback((next: ConfirmOptions) => {
    // A second request while one is open cancels the first.
    resolver.current?.(false);
    setTyped("");
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(result: boolean) {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }

  const danger = options?.danger ?? true;
  const locked = Boolean(options?.confirmText) && typed.trim() !== options?.confirmText;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={Boolean(options)} onOpenChange={(open) => !open && settle(false)} title={options?.title ?? ""} size="sm">
        {options && (
          <form
            className="flex flex-col gap-4 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (!locked) settle(true);
            }}
          >
            {options.description && <div className="text-muted-foreground">{options.description}</div>}
            {options.details && options.details.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 rounded-xl border border-border bg-muted/40 py-3 pl-8 pr-4 text-muted-foreground">
                {options.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
            {options.note && <p className="text-xs text-muted-foreground">{options.note}</p>}
            {options.confirmText && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-text">
                  Type <span className="font-mono font-semibold text-foreground">{options.confirmText}</span> to confirm
                </Label>
                <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" spellCheck={false} />
              </div>
            )}
            {danger && !options.note && (
              <p className="flex items-center gap-1.5 text-xs text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> This can&apos;t be undone.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => settle(false)}>
                Cancel
              </Button>
              <Button type="submit" variant={danger ? "danger" : "primary"} disabled={locked} autoFocus={!options.confirmText}>
                {options.confirmLabel ?? (danger ? "Delete" : "Confirm")}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
