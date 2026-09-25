import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav role="navigation" aria-label="pagination" className={cn("flex items-center", className)} {...props} />;
}

export function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-row items-center gap-1", className)} {...props} />;
}

export function PaginationItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("", className)} {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
  size?: "icon" | "sm";
} & React.ComponentProps<"button">;

export function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  return (
    <button
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? "outline" : "ghost", size: size === "icon" ? "icon-sm" : "sm" }),
        isActive && "border-primary/40 bg-primary/10 text-primary",
        className,
      )}
      {...props}
    />
  );
}

export function PaginationPrevious({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <PaginationLink aria-label="Go to previous page" size="sm" className={cn("gap-1 px-2.5", className)} {...props}>
      <ChevronLeft className="h-3.5 w-3.5" />
      <span>Previous</span>
    </PaginationLink>
  );
}

export function PaginationNext({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <PaginationLink aria-label="Go to next page" size="sm" className={cn("gap-1 px-2.5", className)} {...props}>
      <span>Next</span>
      <ChevronRight className="h-3.5 w-3.5" />
    </PaginationLink>
  );
}

export function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span aria-hidden className={cn("flex h-8 w-8 items-center justify-center text-muted-foreground", className)} {...props}>
      <MoreHorizontal className="h-3.5 w-3.5" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

/** Computes which page numbers/ellipses to render for a given page count,
 * so callers don't have to re-derive this windowing logic themselves. */
export function paginationRange(current: number, total: number, siblingCount = 1): (number | "ellipsis")[] {
  const totalNumbers = siblingCount * 2 + 5;
  if (total <= totalNumbers) return Array.from({ length: total }, (_, i) => i + 1);

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => i + 1);
    return [...leftRange, "ellipsis", total];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    const rightRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => total - (3 + siblingCount * 2) + i + 1);
    return [1, "ellipsis", ...rightRange];
  }
  const middleRange = Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i);
  return [1, "ellipsis", ...middleRange, "ellipsis", total];
}
