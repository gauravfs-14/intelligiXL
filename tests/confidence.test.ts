import { describe, expect, it } from "vitest";
import { concentrationConfidence } from "@/lib/decision-models/system-one";
import { isLowConfidence, resolveSettings } from "@/lib/decision-models/catalog";

describe("review confidence", () => {
  it("treats uniform outputs as zero confidence and one-hot outputs as one", () => {
    expect(concentrationConfidence({ yes: 0.5, no: 0.5 })).toBe(0);
    expect(concentrationConfidence({ a: 1, b: 0, c: 0 })).toBe(1);
    expect(concentrationConfidence({ yes: 0.7, no: 0.3 })).toBeCloseTo(0.4);
  });

  it("flags values below the column threshold only when flagging is enabled", () => {
    const settings = resolveSettings({ confidenceThreshold: 0.7, lowConfidenceAction: "flag" });
    expect(isLowConfidence(0.69, settings)).toBe(true);
    expect(isLowConfidence(0.7, settings)).toBe(false);
    expect(isLowConfidence(0.1, { ...settings, lowConfidenceAction: "none" })).toBe(false);
  });
});
