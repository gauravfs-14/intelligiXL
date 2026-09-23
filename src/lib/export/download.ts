import Papa from "papaparse";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  const csv = Papa.unparse(rows);
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

// Generated server-side (see /api/exports/xlsx) — the `xlsx` package does
// not bundle cleanly for the browser.
export async function downloadXlsx(rows: Record<string, unknown>[], filename: string) {
  const res = await fetch("/api/exports/xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, filename }),
  });
  if (!res.ok) throw new Error("Failed to generate the XLSX file.");
  triggerDownload(await res.blob(), filename);
}
