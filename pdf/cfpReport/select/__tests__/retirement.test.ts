import { describe, it, expect } from "vitest";
import { selectRetirementCurves, simulateDrawdownLocal, curvesPeak } from "../retirement";
import type { CfpReportData } from "../../types";

function payload(content: Record<string, unknown> | null, retirementAge: number | null = 60): CfpReportData {
  return {
    clientName: "Test",
    advisorName: "Advisor",
    period: "2026",
    generatedDate: "2026-08-18",
    language: "zh",
    hasUnapproved: false,
    client: {},
    baseline: retirementAge == null ? null : { retirement_age: retirementAge },
    sections: content ? [{ section_type: "retirement_planning", status: "approved", content }] : [],
    assets: [],
    liabilities: [],
  };
}

/**
 * The assumption set cfp-brain records on every generated retirement section.
 * These are the real figures from computeRetirement() against the standard
 * baseline.test.ts fixture — not invented — so the reconstruction test below is
 * a genuine cross-check of the two implementations rather than a tautology.
 */
const LEGACY = {
  insufficient_data: false,
  total_projected: 1_804_713,
  capital_needed: 2_712_594,
  income_need_at_retirement: 108_504,
  post_retirement_rate_used: 0.055,
  inflation_used: 0.035,
  gap: 907_882,
  depletion_age: 81,
};

describe("server-provided curves are used as-is", () => {
  const series = [
    { age: 60, opening: 1000, withdrawal: 400, closing: 660 },
    { age: 61, opening: 660, withdrawal: 414, closing: 282 },
    { age: 62, opening: 282, withdrawal: 428, closing: 0 },
  ];

  it("prefers drawdown_baseline over reconstructing", () => {
    const c = selectRetirementCurves(payload({ ...LEGACY, drawdown_baseline: series, drawdown_optimized: series }));
    expect(c.fromServer).toBe(true);
    expect(c.hasCurve).toBe(true);
    expect(c.baseline).toEqual(series);
  });

  it("falls back to one line when only the baseline curve is present", () => {
    const c = selectRetirementCurves(payload({ ...LEGACY, drawdown_baseline: series }));
    expect(c.optimized).toEqual(series);
  });

  it("derives the optimized depletion age from its own series", () => {
    const survives = [{ age: 60, opening: 9e9, withdrawal: 1, closing: 9e9 }];
    const c = selectRetirementCurves(
      payload({ ...LEGACY, drawdown_baseline: series, drawdown_optimized: survives }),
    );
    expect(c.optimizedDepletionAge).toBeNull();
  });
});

describe("fallback reconstruction for pre-deploy reports", () => {
  it("rebuilds both curves from the recorded assumptions", () => {
    const c = selectRetirementCurves(payload(LEGACY));
    expect(c.fromServer).toBe(false);
    expect(c.hasCurve).toBe(true);
    expect(c.baseline[0].opening).toBe(LEGACY.total_projected);
    expect(c.optimized[0].opening).toBe(LEGACY.capital_needed);
    expect(c.baseline[0].age).toBe(60);
  });

  it("reproduces the depletion age cfp-brain already recorded", () => {
    // This is the guard against the two implementations drifting apart: the
    // scalar came from the edge function, the curve was rebuilt here.
    const { depletionAge } = simulateDrawdownLocal(
      LEGACY.total_projected, LEGACY.income_need_at_retirement, 60,
      LEGACY.post_retirement_rate_used, LEGACY.inflation_used, 100,
    );
    expect(depletionAge).toBe(LEGACY.depletion_age);
  });

  it("closing the gap extends the runway", () => {
    const c = selectRetirementCurves(payload(LEGACY));
    expect(c.optimized.length).toBeGreaterThan(c.baseline.length);
    expect(c.optimizedDepletionAge!).toBeGreaterThan(c.depletionAge!);
  });

  it("draws a single line when the client is already on track", () => {
    const c = selectRetirementCurves(payload({ ...LEGACY, gap: 0 }));
    expect(c.optimized).toEqual(c.baseline);
  });
});

describe("the curve lands on the axis, never below it", () => {
  it("floors the final closing balance at zero", () => {
    const c = selectRetirementCurves(payload(LEGACY));
    for (const p of c.baseline) expect(p.closing).toBeGreaterThanOrEqual(0);
    expect(c.baseline[c.baseline.length - 1].closing).toBe(0);
  });

  it("a survivor runs to maxAge with money left", () => {
    const { series, depletionAge } = simulateDrawdownLocal(1e8, 50000, 60, 0.055, 0.035, 100);
    expect(depletionAge).toBeNull();
    expect(series).toHaveLength(40);
    expect(series[series.length - 1].closing).toBeGreaterThan(0);
  });
});

describe("not enough data to draw", () => {
  const noCurve = (c: ReturnType<typeof selectRetirementCurves>) => {
    expect(c.hasCurve).toBe(false);
    expect(c.baseline).toEqual([]);
    expect(c.optimized).toEqual([]);
  };

  it("no retirement section at all", () => noCurve(selectRetirementCurves(payload(null))));

  it("insufficient_data section", () =>
    noCurve(selectRetirementCurves(payload({ ...LEGACY, insufficient_data: true }))));

  it("missing retirement age", () => noCurve(selectRetirementCurves(payload(LEGACY, null))));

  it("zero projected capital", () =>
    noCurve(selectRetirementCurves(payload({ ...LEGACY, total_projected: 0 }))));

  it("zero income need would never deplete, so there is no story to plot", () =>
    noCurve(selectRetirementCurves(payload({ ...LEGACY, income_need_at_retirement: 0 }))));

  it("still surfaces the recorded depletion age for the prose", () => {
    const c = selectRetirementCurves(payload({ ...LEGACY, insufficient_data: true }));
    expect(c.depletionAge).toBe(81);
  });
});

describe("chart geometry", () => {
  it("peak spans both curves so they share one y-axis", () => {
    const c = selectRetirementCurves(payload(LEGACY));
    expect(curvesPeak(c)).toBeGreaterThanOrEqual(LEGACY.capital_needed);
  });

  it("peak of an empty curve set is zero rather than -Infinity", () => {
    expect(curvesPeak(selectRetirementCurves(payload(null)))).toBe(0);
  });
});
