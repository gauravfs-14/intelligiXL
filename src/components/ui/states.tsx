import * as React from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-border", className)} />;
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-px bg-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-px bg-border">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1 bg-surface p-3">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-border px-6 py-16 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-danger bg-danger-muted px-6 py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-danger">{title}</p>
        {description && <p className="mt-1 text-xs text-danger/80">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="border-danger text-danger hover:bg-danger hover:text-danger-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-3.5 w-3.5 animate-spin border-2 border-current border-t-transparent align-[-2px]", className)}
      aria-hidden
    />
  );
}
