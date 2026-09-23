"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, AlertTriangle, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineSpinner } from "@/components/ui/states";
import { useConfirmDataset, useUploadDataset, type UploadPreview } from "@/hooks/use-datasets";
import { useDatasetContext } from "@/components/workspace/dataset-context";
import { cn } from "@/lib/utils";

export function UploadModal({ workspaceId, open, onOpenChange }: { workspaceId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const upload = useUploadDataset();
  const confirm = useConfirmDataset();
  const { setDatasetId } = useDatasetContext();
  const [preview, setPreview] = React.useState<UploadPreview | null>(null);
  const [sourceOverrides, setSourceOverrides] = React.useState<Record<string, boolean>>({});
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setPreview(null);
    setSourceOverrides({});
    upload.reset();
    confirm.reset();
  }

  async function handleFile(file: File) {
    try {
      const result = await upload.mutateAsync({ workspaceId, file });
      setPreview(result);
      setSourceOverrides(Object.fromEntries(result.columns.map((c) => [c.name, true])));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.", {
        description: (err as { details?: string[] })?.details?.join(" "),
      });
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    try {
      const { dataset } = await confirm.mutateAsync({
        workspaceId,
        storageKey: preview.storageKey,
        filename: preview.filename,
        format: preview.format,
        columns: preview.columns.map((c) => ({ ...c, isSource: sourceOverrides[c.name] ?? true })),
      });
      toast.success(`"${preview.filename}" imported — ${preview.rowCount.toLocaleString()} rows.`);
      setDatasetId(dataset.id);
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title={preview ? "Confirm import" : "Upload a dataset"}
      description={preview ? undefined : "CSV, XLSX, JSON, or JSONL — up to 10,000 rows and 100 columns."}
      size="lg"
      preventClose={upload.isPending || confirm.isPending}
    >
      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-16 text-center transition-colors",
                dragActive ? "border-accent bg-accent-muted" : "border-border",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              {upload.isPending ? (
                <>
                  <InlineSpinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Validating and parsing…</p>
                </>
              ) : (
                <>
                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Drag a file here, or</p>
                  <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                    Browse files
                  </Button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,.json,.jsonl,.ndjson"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="preview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border border-border-strong bg-background px-3 py-2">
              <FileSpreadsheet className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">{preview.filename}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {preview.rowCount.toLocaleString()} rows · {preview.columnCount} columns
              </span>
            </div>

            {preview.warning && (
              <div className="flex items-start gap-2 border border-warning bg-warning-muted px-3 py-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {preview.warning}
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Columns — uncheck any you don&apos;t want to use as Smart Column source text
              </p>
              <div className="max-h-32 overflow-y-auto border border-border">
                {preview.columns.map((c) => (
                  <label key={c.name} className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-sm last:border-b-0">
                    <Checkbox
                      checked={sourceOverrides[c.name] ?? true}
                      onCheckedChange={(v) => setSourceOverrides((s) => ({ ...s, [c.name]: Boolean(v) }))}
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{c.dataType}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sample</p>
              <div className="max-h-52 overflow-auto border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface">
                    <tr>
                      {preview.columns.map((c) => (
                        <th key={c.name} className="border-b border-r border-border px-2 py-1 text-left font-semibold last:border-r-0">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.slice(0, 8).map((row, i) => (
                      <tr key={i}>
                        {preview.columns.map((c) => (
                          <td key={c.name} className="max-w-[10rem] truncate border-b border-r border-border px-2 py-1 last:border-r-0">
                            {String(row[c.name] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={reset}>
                Choose a different file
              </Button>
              <Button onClick={handleConfirm} loading={confirm.isPending}>
                <Check className="h-4 w-4" /> Import {preview.rowCount.toLocaleString()} rows
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
