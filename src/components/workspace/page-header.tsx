import * as React from "react";
import { cn } from "@/lib/utils";

/** The one page-header shape every page shares — a title/description block
 * sized to read as a real "hero" section (not a thin utility strip), meant
 * to sit as the first child inside that page's own `mx-auto max-w-6xl`
 * wrapper (see Overview) so every page's title lines up at the same left
 * edge and the same width, instead of every page inventing its own header. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small mono label above the title, e.g. "02 — Insights". */
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_8px_var(--signal)]" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl font-semibold leading-[1.05] sm:text-[2.75rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
