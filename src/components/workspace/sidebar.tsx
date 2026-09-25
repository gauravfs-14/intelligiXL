"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Home,
  Table2,
  BarChart3,
  ListChecks,
  LayoutTemplate,
  ChevronsUpDown,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Settings,
  History,
  Microscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, Wordmark } from "@/components/logo";
import { useCreateWorkspace, useWorkspaces } from "@/hooks/use-workspaces";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { DatasetSwitcher } from "./dataset-switcher";
import { JobsNavButton } from "@/components/jobs/jobs-nav-button";
import { ThemeToggle } from "@/components/theme-toggle";

const SECTIONS = [
  { key: "", label: "Overview", icon: Home, hint: "01" },
  { key: "data", label: "Data", icon: Table2, hint: "02" },
  { key: "explore", label: "Explore", icon: Microscope, hint: "03" },
  { key: "insights", label: "Insights", icon: BarChart3, hint: "04" },
  { key: "review", label: "Review", icon: ListChecks, hint: "05" },
  { key: "templates", label: "Templates", icon: LayoutTemplate, hint: "06" },
  { key: "activity", label: "Activity", icon: History, hint: "07" },
  { key: "settings", label: "Settings", icon: Settings, hint: "08" },
];

const COLLAPSE_STORAGE_KEY = "intelligixl:sidebar-collapsed";

export function Sidebar({
  workspaceId,
  workspaceName,
  mobileOpen = false,
  onMobileOpenChange,
}: {
  workspaceId: string;
  workspaceName: string;
  /** Controls the fixed slide-in drawer used below the `md` breakpoint —
   * at `md` and up the sidebar is always visible in normal flow instead. */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useWorkspaces();
  const workspaces = data?.workspaces ?? [];
  const createWorkspace = useCreateWorkspace();

  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
    } catch {
      // Private browsing / blocked storage — default to expanded.
    }
  }, []);

  // The mobile drawer always renders fully expanded (there's no point in an
  // icon-only *drawer* — the rail only makes sense as permanent chrome next
  // to page content) regardless of the persisted desktop rail preference.
  const showCollapsedUI = collapsed && !mobileOpen;

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — collapse state just won't persist this session.
      }
      return next;
    });
  }

  // Close the mobile drawer whenever the route changes — otherwise picking
  // a section would leave the overlay open on top of the new page.
  React.useEffect(() => {
    onMobileOpenChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const [newWorkspaceOpen, setNewWorkspaceOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { workspace } = await createWorkspace.mutateAsync({ name: newName.trim(), description: newDescription.trim() || undefined });
      toast.success(`Workspace "${workspace.name}" created.`);
      setNewWorkspaceOpen(false);
      setNewName("");
      setNewDescription("");
      router.push(`/w/${workspace.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace.");
    }
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[1px] md:hidden"
          onClick={() => onMobileOpenChange?.(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r border-border bg-surface shadow-float backdrop-blur-xl transition-[width,transform] duration-200 md:static md:bg-sidebar md:shadow-none",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          showCollapsedUI ? "w-16" : "w-60",
        )}
      >
      <div className={cn("flex h-16 shrink-0 items-center", showCollapsedUI ? "justify-center px-2" : "justify-between pl-4 pr-3")}>
        {!showCollapsedUI && (
          <Link href="/workspaces" className="flex items-center gap-2 transition-opacity hover:opacity-80" aria-label="All workspaces">
            <Wordmark />
          </Link>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onMobileOpenChange?.(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
          <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleCollapsed}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
        </Tooltip>
        </div>
      </div>

      {showCollapsedUI && (
        <Link href="/workspaces" className="-mt-2 mb-2 flex justify-center" aria-label="All workspaces">
          <Logo className="h-5 w-5" />
        </Link>
      )}
      <div className={cn("mx-3 flex flex-col gap-1 rounded-2xl border border-border bg-surface/70 p-1.5 shadow-flat-sm", showCollapsedUI && "mx-2 items-center p-1")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {showCollapsedUI ? (
              <button className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-muted" aria-label={workspaceName}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal font-display text-sm font-bold text-signal-foreground">
                  {workspaceName.slice(0, 1).toUpperCase()}
                </span>
              </button>
            ) : (
              <button className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal font-display text-sm font-bold text-signal-foreground">
                  {workspaceName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{workspaceName}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem key={ws.id} asChild className={ws.id === workspaceId ? "text-primary" : undefined}>
                <Link href={`/w/${ws.id}`}>
                  <span className="truncate">{ws.name}</span>
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setNewWorkspaceOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New workspace
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/workspaces">All workspaces</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DatasetSwitcher workspaceId={workspaceId} className={showCollapsedUI ? undefined : "w-full px-2"} compact={showCollapsedUI} />
      </div>

      <nav className={cn("flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4", showCollapsedUI && "items-center px-2")}>
        {!showCollapsedUI && <p className="mb-1.5 px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">Workspace</p>}
        {SECTIONS.map((s) => {
          const href = `/w/${workspaceId}${s.key ? `/${s.key}` : ""}`;
          const active = s.key ? pathname?.startsWith(href) : pathname === `/w/${workspaceId}`;
          const link = (
            <Link
              key={s.key || "overview"}
              href={href}
              aria-label={showCollapsedUI ? s.label : undefined}
              className={cn(
                "group relative flex items-center rounded-xl text-sm font-medium transition-colors",
                showCollapsedUI ? "h-10 w-10 justify-center" : "gap-2.5 px-2.5 py-2",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 rounded-xl border border-border bg-surface shadow-flat-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                >
                  <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-x-[5px] -translate-y-1/2 rounded-full bg-signal shadow-[0_0_10px_var(--signal)]" />
                </motion.div>
              )}
              <s.icon className={cn("relative z-10 h-4 w-4 shrink-0 transition-transform group-hover:scale-110", active && "text-primary")} />
              {!showCollapsedUI && (
                <>
                  <span className="relative z-10 flex-1">{s.label}</span>
                  <span className="relative z-10 font-mono text-[10px] text-muted-foreground/50">{s.hint}</span>
                </>
              )}
            </Link>
          );
          if (!showCollapsedUI) return link;
          return (
            <Tooltip key={s.key || "overview"}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{s.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className={cn("m-3 flex items-center gap-2 rounded-2xl border border-border bg-surface/70 p-1.5", showCollapsedUI ? "mx-2 flex-col" : "justify-between")}>
        <JobsNavButton workspaceId={workspaceId} variant="sidebar" compact={showCollapsedUI} />
        <ThemeToggle />
      </div>

      <Modal open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen} title="New Workspace" description="Give it a name your team will recognize.">
        <form className="flex flex-col gap-4" onSubmit={handleCreateWorkspace}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sidebar-ws-name">Name</Label>
            <Input id="sidebar-ws-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Customer Feedback Q3" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sidebar-ws-desc">Description (optional)</Label>
            <Textarea id="sidebar-ws-desc" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="What is this workspace for?" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setNewWorkspaceOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createWorkspace.isPending} disabled={!newName.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
      </aside>
    </>
  );
}
