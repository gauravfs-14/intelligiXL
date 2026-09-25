import { useSyncExternalStore } from "react";

function greetingFor(hour: number): string {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const noopSubscribe = () => () => {};

/** Time-of-day greeting in the viewer's local time. The server snapshot is a
 * neutral "Welcome back": the server's clock/timezone (UTC in Docker) can
 * differ from the browser's, and rendering the hour on both sides caused a
 * hydration mismatch. React swaps in the client value right after hydration. */
export function useGreeting(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => greetingFor(new Date().getHours()),
    () => "Welcome back",
  );
}
