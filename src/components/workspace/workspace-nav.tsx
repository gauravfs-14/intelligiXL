"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { LayoutDashboard, LayoutGrid, BarChart3, ListChecks, LayoutTemplate, FolderKanban, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatasetSwitcher } from "./dataset-switcher";
import { JobsNavButton } from "@/components/jobs/jobs-nav-button";
import { ThemeToggle } from "@/components/theme-toggle";

const SECTIONS = [
  { key: "", label: "Overview", icon: LayoutDashboard },
  { key: "data", label: "Data", icon: LayoutGrid },
  { key: "insights", label: "Insights", icon: BarChart3 },
  { key: "review", label: "Review", icon: ListChecks },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
];

export function WorkspaceNav({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-4 px-4">
        <Link href="/workspaces" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80" aria-label="All workspaces">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">IntelligiXL</span>
        </Link>
        <div className="h-5 w-px bg-border" />
        <Link
          href={`/w/${workspaceId}`}
          className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <FolderKanban className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{workspaceName}</span>
        </Link>

        <nav className="ml-2 flex items-center gap-0.5">
          {SECTIONS.map((s) => {
            const href = `/w/${workspaceId}${s.key ? `/${s.key}` : ""}`;
            const active = s.key ? pathname?.startsWith(href) : pathname === `/w/${workspaceId}`;
            return (
              <Link
                key={s.key || "overview"}
                href={href}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-md bg-muted"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <s.icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{s.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <JobsNavButton workspaceId={workspaceId} />
          <DatasetSwitcher workspaceId={workspaceId} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
