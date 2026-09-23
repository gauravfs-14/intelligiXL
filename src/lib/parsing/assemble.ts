/** Deduplicates raw header cells (e.g. two columns both named "Notes"),
 * suffixing collisions so no data is silently dropped — one of the
 * documented failure scenarios (§14) rather than a hard rejection. */
export function dedupeHeaders(raw: unknown[]): { headers: string[]; warning?: string } {
  const seen = new Map<string, number>();
  const collided = new Set<string>();
  const headers = raw.map((cell, i) => {
    const base = String(cell ?? "").trim() || `Column ${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (count === 0) return base;
    collided.add(base);
    return `${base} (${count + 1})`;
  });
  return {
    headers,
    warning: collided.size > 0 ? `Duplicate column name(s) renamed: ${[...collided].join(", ")}` : undefined,
  };
}

export function assembleRows(headers: string[], dataRows: unknown[][]): Record<string, unknown>[] {
  return dataRows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? null;
    });
    return obj;
  });
}
