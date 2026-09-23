"use client";

import * as React from "react";

interface DatasetContextValue {
  datasetId: string | null;
  setDatasetId: (id: string | null) => void;
}

const DatasetContext = React.createContext<DatasetContextValue | null>(null);

export function DatasetProvider({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  const storageKey = `intelligixl:${workspaceId}:dataset`;
  const [datasetId, setDatasetIdState] = React.useState<string | null>(null);

  // Deliberately an effect, not a lazy useState initializer: this component
  // renders on the server (where localStorage doesn't exist) before
  // hydrating on the client, so the first client render must also produce
  // null to match the server output. Reading localStorage here, after
  // mount, is what avoids a hydration mismatch.
  React.useEffect(() => {
    try {
      setDatasetIdState(localStorage.getItem(storageKey));
    } catch {
      // Private browsing / blocked storage — fall back to "no selection".
    }
  }, [storageKey]);

  const setDatasetId = React.useCallback(
    (id: string | null) => {
      setDatasetIdState(id);
      try {
        if (id) localStorage.setItem(storageKey, id);
        else localStorage.removeItem(storageKey);
      } catch {
        // Per-viewer convenience only — losing this is not an error state.
      }
    },
    [storageKey],
  );

  const value = React.useMemo(() => ({ datasetId, setDatasetId }), [datasetId, setDatasetId]);
  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDatasetContext(): DatasetContextValue {
  const ctx = React.useContext(DatasetContext);
  if (!ctx) throw new Error("useDatasetContext must be used within a DatasetProvider");
  return ctx;
}
