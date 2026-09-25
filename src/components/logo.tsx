import * as React from "react";
import { cn } from "@/lib/utils";

/** The IntelligiXL mark: a 2x3 grid (ink squares = your data, aurora squares
 * = what Smart Columns add) plus two rising bars (the "XL" growth motif).
 * Left-column squares use `currentColor` so they follow --foreground and
 * stay legible in both themes; the aurora elements are fixed, like most
 * brand marks are regardless of light/dark. */
export function Logo({ className }: { className?: string }) {
  const id = React.useId();
  return (
    <svg
      viewBox="0 -10 222 196"
      className={cn("text-foreground", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#C6F432" />
          <stop offset="100%" stopColor="#2EE6C8" />
        </linearGradient>
      </defs>
      <rect x="0" y="30" width="44" height="44" rx="10" fill="currentColor" />
      <rect x="0" y="86" width="44" height="44" rx="10" fill="currentColor" />
      <rect x="0" y="142" width="44" height="44" rx="10" fill="currentColor" />
      <rect x="56" y="30" width="44" height="44" rx="22" fill="#C6F432" />
      <rect x="56" y="86" width="44" height="44" rx="10" fill={`url(#${id}-grad)`} opacity="0.75" />
      <rect x="56" y="142" width="44" height="44" rx="10" fill={`url(#${id}-grad)`} opacity="0.4" />
      <rect x="122" y="10" width="44" height="176" rx="22" fill={`url(#${id}-grad)`} />
      <rect x="178" y="-10" width="44" height="196" rx="22" fill={`url(#${id}-grad)`} />
    </svg>
  );
}

/** Logo + wordmark, with the "XL" in the serif accent face. */
export function Wordmark({ className, logoClassName }: { className?: string; logoClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo className={cn("h-5 w-5 shrink-0", logoClassName)} />
      <span className="font-display text-[15px] font-semibold tracking-tight">
        Intelligi<span className="font-accent text-[17px]">XL</span>
      </span>
    </span>
  );
}
