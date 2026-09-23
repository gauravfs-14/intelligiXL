import * as React from "react";
import { motion } from "motion/react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

export { Skeleton };

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex gap-px bg-border">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="flex-1 bg-muted/50 px-3 py-2.5">
            <Skeleton className="h-3 w-16 bg-muted-foreground/15" />
          </div>
        ))}
      </div>
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-px">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="flex-1 px-3 py-3">
                <Skeleton className="h-3.5 w-full" style={{ animationDelay: `${(r * cols + c) * 20}ms` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-danger-muted px-6 py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
        <AlertTriangle className="h-5 w-5 text-danger" aria-hidden />
      </div>
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-danger">{title}</p>
        {description && <p className="mt-1 text-sm text-danger/80">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="border-danger/40 text-danger hover:bg-danger hover:text-danger-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </motion.div>
  );
}

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]", className)}
      aria-hidden
    />
  );
}
