"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BarChart3, ListChecks, LayoutTemplate, FolderKanban, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatasetSwitcher } from "./dataset-switcher";

const SECTIONS = [
  { key: "data", label: "Data", icon: LayoutGrid },
  { key: "insights", label: "Insights", icon: BarChart3 },
  { key: "review", label: "Review", icon: ListChecks },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
];

export function WorkspaceNav({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border-strong bg-surface">
      <div className="flex h-14 items-center gap-4 px-4">
        <Link href="/workspaces" className="flex items-center gap-2 shrink-0" aria-label="All workspaces">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">IntelligiXL</span>
        </Link>
        <div className="h-5 w-px bg-border" />
        <Link href="/workspaces" className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground">
          <FolderKanban className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{workspaceName}</span>
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          {SECTIONS.map((s) => {
            const href = `/w/${workspaceId}/${s.key}`;
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={s.key}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 border border-transparent px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "border-border-strong bg-foreground text-background" : "text-muted hover:text-foreground",
                )}
              >
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto">
          <DatasetSwitcher workspaceId={workspaceId} />
        </div>
      </div>
    </header>
  );
}
