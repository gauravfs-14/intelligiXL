"use client";

import * as React from "react";
import { apiPost } from "@/lib/api-client";

/** Fire-and-forget study telemetry (§11). Never pass raw dataset text in
 * `payload` — only structured metadata (ids, counts, labels). */
export function useTelemetry(workspaceId: string | undefined) {
  return React.useCallback(
    (eventType: string, payload: Record<string, unknown> = {}) => {
      if (!workspaceId) return;
      apiPost("/api/events", { workspaceId, eventType, payload }).catch(() => {
        // Telemetry is best-effort; never surface a failure to the user.
      });
    },
    [workspaceId],
  );
}
