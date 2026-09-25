// Pure, client-side exploratory data analysis. Every profile is computed
// from the full workbench snapshot already in memory (<=10k rows per the
// SRS), so there's no server round-trip when the user toggles columns or
// switches how a column is analyzed.

export type EdaKind = "NUMBER" | "TEXT" | "CATEGORY" | "BOOLEAN" | "DATE" | "JSON";

export interface NumericSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  q1: number;
  q3: number;
  p5: number;
  p95: number;
}

export interface HistogramBin {
  label: string;
  start: number;
  end: number;
  count: number;
}

export interface ValueCount {
  value: string;
  count: number;
  pct: number;
}

interface BaseProfile {
  total: number;
  missing: number;
  present: number;
  unique: number;
  topValues: ValueCount[];
}

export interface NumberProfile extends BaseProfile {
  kind: "NUMBER";
  summary: NumericSummary | null;
  sum: number;
  variance: number;
  iqr: number;
  range: number;
  skewness: number;
  kurtosis: number;
  cv: number | null;
  zeros: number;
  negatives: number;
  integers: number;
  unparseable: number;
  outliersLow: number;
  outliersHigh: number;
  histogram: HistogramBin[];
}

export interface TextProfile extends BaseProfile {
  kind: "TEXT";
  empty: number;
  charLength: NumericSummary | null;
  wordCount: NumericSummary | null;
  sentenceCount: NumericSummary | null;
  wordLength: NumericSummary | null;
  totalWords: number;
  vocabularySize: number;
  lexicalDiversity: number;
  charHistogram: HistogramBin[];
  wordHistogram: HistogramBin[];
  topWords: ValueCount[];
  topBigrams: ValueCount[];
  patterns: { label: string; count: number }[];
  shortest: string | null;
  longest: string | null;
}

export interface CategoryProfile extends BaseProfile {
  kind: "CATEGORY";
  mode: string | null;
  modePct: number;
  entropy: number;
  normalizedEntropy: number;
  singletons: number;
  otherCount: number;
}

export interface BooleanProfile extends BaseProfile {
  kind: "BOOLEAN";
  trueCount: number;
  falseCount: number;
  invalid: number;
  trueRatio: number;
}

export interface DateProfile extends BaseProfile {
  kind: "DATE";
  min: string | null;
  max: string | null;
  spanDays: number;
  median: string | null;
  invalid: number;
  hasTime: boolean;
  weekendPct: number;
  timeline: { label: string; count: number }[];
  timelineGranularity: "day" | "month" | "year";
  byWeekday: { label: string; count: number }[];
  byMonth: { label: string; count: number }[];
  byHour: { label: string; count: number }[];
}

export interface JsonProfile extends BaseProfile {
  kind: "JSON";
  shapes: { label: string; count: number }[];
  keyFrequency: ValueCount[];
  arrayLength: NumericSummary | null;
  keyCount: NumericSummary | null;
  depth: NumericSummary | null;
  serializedLength: NumericSummary | null;
}

export type ColumnProfile = NumberProfile | TextProfile | CategoryProfile | BooleanProfile | DateProfile | JsonProfile;

// --- Shared helpers ---------------------------------------------------------

export function isMissing(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function summarize(values: number[]): NumericSummary | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    median: quantileSorted(sorted, 0.5),
    std: Math.sqrt(variance),
    q1: quantileSorted(sorted, 0.25),
    q3: quantileSorted(sorted, 0.75),
    p5: quantileSorted(sorted, 0.05),
    p95: quantileSorted(sorted, 0.95),
  };
}

function niceNumber(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  if (Number.isInteger(v)) return String(v);
  return abs >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/** Freedman–Diaconis bin width, clamped to a readable 5–30 bins. Integer data
 * with a small range gets one bin per value so bars line up with real values. */
export function histogram(values: number[], maxBins = 30): HistogramBin[] {
  if (values.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return [{ label: niceNumber(min), start: min, end: max, count: values.length }];

  const allInts = values.every(Number.isInteger);
  if (allInts && max - min + 1 <= maxBins) {
    const bins: HistogramBin[] = [];
    for (let v = min; v <= max; v++) bins.push({ label: String(v), start: v, end: v, count: 0 });
    for (const v of values) bins[v - min].count++;
    return bins;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const iqr = quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25);
  const fdWidth = iqr > 0 ? (2 * iqr) / Math.cbrt(values.length) : 0;
  let binCount = fdWidth > 0 ? Math.ceil((max - min) / fdWidth) : Math.ceil(Math.sqrt(values.length));
  binCount = Math.min(maxBins, Math.max(5, binCount));
  const width = (max - min) / binCount;
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => {
    const start = min + i * width;
    const end = i === binCount - 1 ? max : start + width;
    return { label: `${niceNumber(start)}–${niceNumber(end)}`, start, end, count: 0 };
  });
  for (const v of values) {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / width));
    bins[idx].count++;
  }
  return bins;
}

function countValues(values: string[], limit: number): { top: ValueCount[]; unique: number; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const total = values.length || 1;
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count, pct: count / total }));
  return { top, unique: counts.size, counts };
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function base(values: unknown[]): { present: unknown[]; base: Omit<BaseProfile, "topValues" | "unique"> } {
  const present = values.filter((v) => !isMissing(v));
  return { present, base: { total: values.length, missing: values.length - present.length, present: present.length } };
}

// --- Number -----------------------------------------------------------------

export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function profileNumber(values: unknown[]): NumberProfile {
  const { present, base: b } = base(values);
  const nums: number[] = [];
  let unparseable = 0;
  for (const v of present) {
    const n = toNumber(v);
    if (n === null) unparseable++;
    else nums.push(n);
  }
  const summary = summarize(nums);
  const { top, unique } = countValues(nums.map(String), 10);
  const n = nums.length;
  const mean = summary?.mean ?? 0;
  const std = summary?.std ?? 0;
  let m3 = 0;
  let m4 = 0;
  for (const v of nums) {
    const d = v - mean;
    m3 += d ** 3;
    m4 += d ** 4;
  }
  const popVar = n > 0 ? nums.reduce((s, v) => s + (v - mean) ** 2, 0) / n : 0;
  const skewness = popVar > 0 ? m3 / n / popVar ** 1.5 : 0;
  const kurtosis = popVar > 0 ? m4 / n / popVar ** 2 - 3 : 0;
  const iqr = summary ? summary.q3 - summary.q1 : 0;
  const lowFence = summary ? summary.q1 - 1.5 * iqr : 0;
  const highFence = summary ? summary.q3 + 1.5 * iqr : 0;

  return {
    kind: "NUMBER",
    ...b,
    unique,
    topValues: top,
    summary,
    sum: nums.reduce((s, v) => s + v, 0),
    variance: std ** 2,
    iqr,
    range: summary ? summary.max - summary.min : 0,
    skewness,
    kurtosis,
    cv: summary && mean !== 0 ? std / Math.abs(mean) : null,
    zeros: nums.filter((v) => v === 0).length,
    negatives: nums.filter((v) => v < 0).length,
    integers: nums.filter(Number.isInteger).length,
    unparseable,
    outliersLow: summary ? nums.filter((v) => v < lowFence).length : 0,
    outliersHigh: summary ? nums.filter((v) => v > highFence).length : 0,
    histogram: histogram(nums),
  };
}

// --- Text -------------------------------------------------------------------

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by for from has have he her his i if in into is it its me my no not of on or our she so " +
    "than that the their them then there these they this to too us was we were what when which who will with you your " +
    "do does did can could would should just about all also any more most other some such only own same very s t don"
  ).split(" "),
);

const WORD_RE = /[\p{L}\p{N}']+/gu;
const URL_RE = /https?:\/\/\S+|www\.\S+/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const DIGIT_RE = /\d/;
const EMOJI_RE = /\p{Extended_Pictographic}/u;

function sentenceCount(text: string): number {
  const parts = text.split(/[.!?]+(?:\s+|$)|\n+/).filter((p) => p.trim().length > 0);
  return Math.max(parts.length, text.trim() ? 1 : 0);
}

export function profileText(values: unknown[]): TextProfile {
  const { present, base: b } = base(values);
  const texts = present.map(stringify);
  const { top, unique } = countValues(texts, 10);

  const charLens: number[] = [];
  const wordCounts: number[] = [];
  const sentenceCounts: number[] = [];
  const wordLens: number[] = [];
  const wordFreq = new Map<string, number>();
  const bigramFreq = new Map<string, number>();
  const vocab = new Set<string>();
  const patterns = { url: 0, email: 0, digits: 0, upper: 0, emoji: 0, multiline: 0, leadingTrailing: 0 };
  let shortest: string | null = null;
  let longest: string | null = null;
  let totalWords = 0;

  for (const t of texts) {
    charLens.push(t.length);
    const words = t.match(WORD_RE) ?? [];
    wordCounts.push(words.length);
    sentenceCounts.push(sentenceCount(t));
    totalWords += words.length;
    let prev: string | null = null;
    for (const w of words) {
      const lw = w.toLowerCase();
      wordLens.push(w.length);
      vocab.add(lw);
      const content = !STOPWORDS.has(lw) && lw.length > 1 && !/^\d+$/.test(lw);
      if (content) wordFreq.set(lw, (wordFreq.get(lw) ?? 0) + 1);
      if (prev && content) {
        const bg = `${prev} ${lw}`;
        bigramFreq.set(bg, (bigramFreq.get(bg) ?? 0) + 1);
      }
      prev = content ? lw : null;
    }
    if (URL_RE.test(t)) patterns.url++;
    if (EMAIL_RE.test(t)) patterns.email++;
    if (DIGIT_RE.test(t)) patterns.digits++;
    if (/\p{L}/u.test(t) && t === t.toUpperCase()) patterns.upper++;
    if (EMOJI_RE.test(t)) patterns.emoji++;
    if (t.includes("\n")) patterns.multiline++;
    if (t !== t.trim()) patterns.leadingTrailing++;
    if (shortest === null || t.length < shortest.length) shortest = t;
    if (longest === null || t.length > longest.length) longest = t;
  }

  const rank = (m: Map<string, number>, total: number) =>
    [...m.entries()]
      .sort((a, x) => x[1] - a[1] || a[0].localeCompare(x[0]))
      .slice(0, 15)
      .map(([value, count]) => ({ value, count, pct: total ? count / total : 0 }));

  return {
    kind: "TEXT",
    ...b,
    unique,
    topValues: top,
    empty: values.filter((v) => typeof v === "string" && v.trim() === "").length,
    charLength: summarize(charLens),
    wordCount: summarize(wordCounts),
    sentenceCount: summarize(sentenceCounts),
    wordLength: summarize(wordLens),
    totalWords,
    vocabularySize: vocab.size,
    lexicalDiversity: totalWords ? vocab.size / totalWords : 0,
    charHistogram: histogram(charLens),
    wordHistogram: histogram(wordCounts),
    topWords: rank(wordFreq, totalWords),
    topBigrams: rank(bigramFreq, totalWords),
    patterns: [
      { label: "Contains digits", count: patterns.digits },
      { label: "Contains URL", count: patterns.url },
      { label: "Contains email", count: patterns.email },
      { label: "All uppercase", count: patterns.upper },
      { label: "Contains emoji", count: patterns.emoji },
      { label: "Multi-line", count: patterns.multiline },
      { label: "Leading/trailing space", count: patterns.leadingTrailing },
    ],
    shortest,
    longest,
  };
}

// --- Category ---------------------------------------------------------------

export function profileCategory(values: unknown[]): CategoryProfile {
  const { present, base: b } = base(values);
  const strs = present.map((v) => stringify(v).trim());
  const { top, unique, counts } = countValues(strs, 20);
  const n = strs.length;
  let entropy = 0;
  for (const c of counts.values()) {
    const p = c / n;
    entropy -= p * Math.log2(p);
  }
  const shown = top.reduce((s, t) => s + t.count, 0);
  return {
    kind: "CATEGORY",
    ...b,
    unique,
    topValues: top,
    mode: top[0]?.value ?? null,
    modePct: top[0]?.pct ?? 0,
    entropy,
    normalizedEntropy: unique > 1 ? entropy / Math.log2(unique) : 0,
    singletons: [...counts.values()].filter((c) => c === 1).length,
    otherCount: n - shown,
  };
}

// --- Boolean ----------------------------------------------------------------

const TRUE_STRINGS = new Set(["true", "yes", "y", "1", "t"]);
const FALSE_STRINGS = new Set(["false", "no", "n", "0", "f"]);

export function toBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1 ? true : v === 0 ? false : null;
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (TRUE_STRINGS.has(s)) return true;
  if (FALSE_STRINGS.has(s)) return false;
  return null;
}

export function profileBoolean(values: unknown[]): BooleanProfile {
  const { present, base: b } = base(values);
  let t = 0;
  let f = 0;
  let invalid = 0;
  for (const v of present) {
    const x = toBoolean(v);
    if (x === true) t++;
    else if (x === false) f++;
    else invalid++;
  }
  const valid = t + f;
  const topValues: ValueCount[] = [
    { value: "true", count: t, pct: valid ? t / valid : 0 },
    { value: "false", count: f, pct: valid ? f / valid : 0 },
  ];
  return {
    kind: "BOOLEAN",
    ...b,
    unique: (t > 0 ? 1 : 0) + (f > 0 ? 1 : 0),
    topValues,
    trueCount: t,
    falseCount: f,
    invalid,
    trueRatio: valid ? t / valid : 0,
  };
}

// --- Date -------------------------------------------------------------------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

export function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Heuristic: treat 10-digit numbers as unix seconds, 13-digit as ms.
    const ms = v < 1e11 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function profileDate(values: unknown[]): DateProfile {
  const { present, base: b } = base(values);
  const dates: Date[] = [];
  let invalid = 0;
  let hasTime = false;
  for (const v of present) {
    const d = toDate(v);
    if (!d) {
      invalid++;
      continue;
    }
    dates.push(d);
    if (d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds()) hasTime = true;
  }
  dates.sort((a, x) => a.getTime() - x.getTime());
  const { top, unique } = countValues(dates.map(isoDay), 10);

  const first = dates[0];
  const last = dates[dates.length - 1];
  const spanDays = first && last ? (last.getTime() - first.getTime()) / DAY_MS : 0;
  const granularity: DateProfile["timelineGranularity"] = spanDays <= 120 ? "day" : spanDays <= 365 * 6 ? "month" : "year";
  const bucket = (d: Date) => (granularity === "day" ? isoDay(d) : granularity === "month" ? d.toISOString().slice(0, 7) : String(d.getUTCFullYear()));

  // Fill gaps so the timeline shows real zero periods instead of skipping them.
  const timelineMap = new Map<string, number>();
  if (first && last) {
    const cursor = new Date(Date.UTC(first.getUTCFullYear(), granularity === "year" ? 0 : first.getUTCMonth(), granularity === "day" ? first.getUTCDate() : 1));
    let guard = 0;
    while (cursor.getTime() <= last.getTime() && guard++ < 2000) {
      timelineMap.set(bucket(cursor), 0);
      if (granularity === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
      else if (granularity === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    }
  }
  const weekday = new Array(7).fill(0);
  const month = new Array(12).fill(0);
  const hour = new Array(24).fill(0);
  for (const d of dates) {
    const key = bucket(d);
    timelineMap.set(key, (timelineMap.get(key) ?? 0) + 1);
    weekday[d.getUTCDay()]++;
    month[d.getUTCMonth()]++;
    hour[d.getUTCHours()]++;
  }
  const weekend = weekday[0] + weekday[6];

  return {
    kind: "DATE",
    ...b,
    unique,
    topValues: top,
    min: first ? first.toISOString() : null,
    max: last ? last.toISOString() : null,
    median: dates.length ? dates[Math.floor((dates.length - 1) / 2)].toISOString() : null,
    spanDays,
    invalid,
    hasTime,
    weekendPct: dates.length ? weekend / dates.length : 0,
    timeline: [...timelineMap.entries()].sort((a, x) => a[0].localeCompare(x[0])).map(([label, count]) => ({ label, count })),
    timelineGranularity: granularity,
    byWeekday: WEEKDAYS.map((label, i) => ({ label, count: weekday[i] })),
    byMonth: MONTHS.map((label, i) => ({ label, count: month[i] })),
    byHour: hour.map((count, i) => ({ label: String(i).padStart(2, "0"), count })),
  };
}

// --- JSON -------------------------------------------------------------------

function jsonDepth(v: unknown): number {
  if (v === null || typeof v !== "object") return 0;
  const children = Array.isArray(v) ? v : Object.values(v as Record<string, unknown>);
  let max = 0;
  for (const c of children) max = Math.max(max, jsonDepth(c));
  return 1 + max;
}

export function profileJson(values: unknown[]): JsonProfile {
  const { present, base: b } = base(values);
  const parsed = present.map((v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  });
  const shapes = { Object: 0, Array: 0, String: 0, Number: 0, Boolean: 0 };
  const keyFreq = new Map<string, number>();
  const arrLens: number[] = [];
  const keyCounts: number[] = [];
  const depths: number[] = [];
  const serialized: number[] = [];
  let objects = 0;
  for (const v of parsed) {
    depths.push(jsonDepth(v));
    serialized.push(stringify(v).length);
    if (Array.isArray(v)) {
      shapes.Array++;
      arrLens.push(v.length);
    } else if (v !== null && typeof v === "object") {
      shapes.Object++;
      objects++;
      const keys = Object.keys(v);
      keyCounts.push(keys.length);
      for (const k of keys) keyFreq.set(k, (keyFreq.get(k) ?? 0) + 1);
    } else if (typeof v === "number") shapes.Number++;
    else if (typeof v === "boolean") shapes.Boolean++;
    else shapes.String++;
  }
  const { top, unique } = countValues(parsed.map(stringify), 10);
  return {
    kind: "JSON",
    ...b,
    unique,
    topValues: top,
    shapes: Object.entries(shapes)
      .filter(([, c]) => c > 0)
      .map(([label, count]) => ({ label, count })),
    keyFrequency: [...keyFreq.entries()]
      .sort((a, x) => x[1] - a[1])
      .slice(0, 15)
      .map(([value, count]) => ({ value, count, pct: objects ? count / objects : 0 })),
    arrayLength: summarize(arrLens),
    keyCount: summarize(keyCounts),
    depth: summarize(depths),
    serializedLength: summarize(serialized),
  };
}

// --- Dispatch ---------------------------------------------------------------

export function profileColumn(values: unknown[], kind: EdaKind): ColumnProfile {
  switch (kind) {
    case "NUMBER":
      return profileNumber(values);
    case "TEXT":
      return profileText(values);
    case "CATEGORY":
      return profileCategory(values);
    case "BOOLEAN":
      return profileBoolean(values);
    case "DATE":
      return profileDate(values);
    case "JSON":
      return profileJson(values);
  }
}

/** Picks the most useful analysis for a column. A STRING column with few
 * distinct, short values reads better as categories than as free text. */
export function defaultKind(dataType: string, values: unknown[]): EdaKind {
  switch (dataType) {
    case "NUMBER":
      return "NUMBER";
    case "BOOLEAN":
      return "BOOLEAN";
    case "DATE":
      return "DATE";
    case "JSON":
      return "JSON";
  }
  const present = values.filter((v) => !isMissing(v)).map(stringify);
  if (present.length === 0) return "TEXT";
  const unique = new Set(present).size;
  const avgLen = present.reduce((s, v) => s + v.length, 0) / present.length;
  const looksCategorical = avgLen <= 40 && unique <= present.length / 2 && (unique <= 25 || unique / present.length <= 0.05);
  return looksCategorical ? "CATEGORY" : "TEXT";
}

// --- Cross-column -----------------------------------------------------------

/** Pairwise Pearson correlation over rows where both columns are numeric. */
export function correlationMatrix(columns: { name: string; values: unknown[] }[]): { names: string[]; matrix: (number | null)[][] } {
  const nums = columns.map((c) => c.values.map(toNumber));
  const matrix = columns.map((_, i) =>
    columns.map((__, j) => {
      if (i === j) return 1;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let r = 0; r < nums[i].length; r++) {
        const x = nums[i][r];
        const y = nums[j][r];
        if (x !== null && y !== null) {
          xs.push(x);
          ys.push(y);
        }
      }
      if (xs.length < 3) return null;
      const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
      const my = ys.reduce((s, v) => s + v, 0) / ys.length;
      let num = 0;
      let dx = 0;
      let dy = 0;
      for (let k = 0; k < xs.length; k++) {
        num += (xs[k] - mx) * (ys[k] - my);
        dx += (xs[k] - mx) ** 2;
        dy += (ys[k] - my) ** 2;
      }
      return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : null;
    }),
  );
  return { names: columns.map((c) => c.name), matrix };
}
