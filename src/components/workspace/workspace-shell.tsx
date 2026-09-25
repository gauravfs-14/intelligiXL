"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Logo } from "@/components/logo";
import { useWorkspace } from "@/hooks/use-workspaces";
import { JobsDrawerProvider } from "@/components/jobs/jobs-drawer-context";

/** Client wrapper around Sidebar + page content — owns the mobile drawer's
 * open state and renders the small `md:hidden` menu bar that opens it, since
 * below `md` the Sidebar is a slide-in overlay instead of static chrome. */
export function WorkspaceShell({
  workspaceId,
  workspaceName: initialName,
  children,
}: {
  workspaceId: string;
  workspaceName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // The layout renders the name on the server; follow the client query so a
  // rename in Settings shows up here without a reload.
  const { data } = useWorkspace(workspaceId);
  const workspaceName = data?.workspace.name ?? initialName;

  return (
    <JobsDrawerProvider workspaceId={workspaceId}>
    <div className="flex h-screen overflow-hidden">
      <Sidebar workspaceId={workspaceId} workspaceName={workspaceName} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">{workspaceName}</span>
        </div>
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
    </JobsDrawerProvider>
  );
}
