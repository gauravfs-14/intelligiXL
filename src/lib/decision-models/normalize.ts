/** Deterministic whitespace/missing-value handling (AIR-004). */
export function normalizeSourceText(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).replace(/\s+/g, " ").trim();
}

/** Deterministically combines selected source columns (FR-006, e.g.
 * `Title + Article Text`) and flags when every value is missing so the
 * caller can short-circuit before hitting the provider (AIR-005 — no
 * meaningless blank requests).
 *
 * Returns both a `fields` object — sent to Jev as-is, since named JSON
 * fields let the model tell "Title" apart from "Article Text" instead of
 * having to re-infer structure from a flattened block of text — and a
 * `text` rendering of the same data for human-readable previews (the
 * Smart Column Builder's preview step, the Review Queue). */
export function buildSourceState(
  row: Record<string, unknown>,
  sourceColumns: string[],
): { fields: Record<string, string>; text: string; isEmpty: boolean } {
  const parts = sourceColumns.map((col) => ({ col, value: normalizeSourceText(row[col]) }));
  const isEmpty = parts.every((p) => p.value.length === 0);
  const fields = Object.fromEntries(parts.map((p) => [p.col, p.value]));
  const text = parts.map((p) => `${p.col}: ${p.value}`).join("\n\n");
  return { fields, text, isEmpty };
}
