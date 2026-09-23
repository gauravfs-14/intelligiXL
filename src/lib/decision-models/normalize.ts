/** Deterministic whitespace/missing-value handling (AIR-004). */
export function normalizeSourceText(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).replace(/\s+/g, " ").trim();
}

/** Deterministically combines selected source columns into one state string
 * (FR-006, e.g. `Title + Article Text`), and flags when every value is
 * missing so the caller can short-circuit before hitting the provider
 * (AIR-005 — no meaningless blank requests). */
export function buildSourceState(
  row: Record<string, unknown>,
  sourceColumns: string[],
): { text: string; isEmpty: boolean } {
  const parts = sourceColumns.map((col) => ({ col, value: normalizeSourceText(row[col]) }));
  const isEmpty = parts.every((p) => p.value.length === 0);
  const text = parts.map((p) => `${p.col}: ${p.value}`).join("\n\n");
  return { text, isEmpty };
}
