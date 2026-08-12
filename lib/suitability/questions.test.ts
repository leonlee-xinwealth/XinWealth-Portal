// Structural drift guard. The scoring engine's band cut-points (0-2 / 3-5 / 6-7
// / 8-9) are only correct if the questions can actually produce 0..9 in each
// dimension. If someone adds an option worth 4 points, or moves a question
// between dimensions, this fails here rather than silently mis-profiling
// clients in production.
import { describe, expect, it } from "vitest";
import { QUESTION_BY_ID, QUESTION_IDS, SUITABILITY_QUESTIONS, optionOf } from "./questions";
import type { QuestionId } from "./types";

const EXPECTED_ORDER: QuestionId[] = [
  "investment_objective",
  "investment_horizon",
  "liquidity_backup",
  "income_stability",
  "capital_concentration",
  "investment_experience_years",
  "investment_products",
  "market_drawdown_experience",
  "drawdown_reaction",
  "loss_3_percent_reaction",
  "loss_10_percent_reaction",
  "loss_20_percent_reaction",
  "principal_preference",
  "return_expectation",
  "investment_preference",
];

const maxPoints = (id: QuestionId) =>
  Math.max(...QUESTION_BY_ID[id].options.map((o) => o.points ?? 0));

describe("question set structure", () => {
  it("has exactly the 15 spec questions in order", () => {
    expect(SUITABILITY_QUESTIONS).toHaveLength(15);
    expect(QUESTION_IDS).toEqual(EXPECTED_ORDER);
    expect(SUITABILITY_QUESTIONS.map((q) => q.order)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
  });

  it("has bilingual copy and unique option codes everywhere", () => {
    for (const q of SUITABILITY_QUESTIONS) {
      expect(q.titleEn.trim(), `${q.id} titleEn`).not.toBe("");
      expect(q.titleZh.trim(), `${q.id} titleZh`).not.toBe("");
      expect(q.options.length, `${q.id} needs options`).toBeGreaterThan(1);

      const codes = q.options.map((o) => o.value);
      expect(new Set(codes).size, `${q.id} has duplicate option codes`).toBe(codes.length);

      for (const o of q.options) {
        expect(o.en.trim(), `${q.id}/${o.value} en`).not.toBe("");
        expect(o.zh.trim(), `${q.id}/${o.value} zh`).not.toBe("");
      }
    }
  });

  it("has exactly one multi-select question", () => {
    const multi = SUITABILITY_QUESTIONS.filter((q) => q.control === "multi");
    expect(multi.map((q) => q.id)).toEqual(["investment_products"]);
  });
});

describe("dimension maxima match the band cut-points in rules.ts", () => {
  it("capacity is exactly Q03-Q05, each 0-3, summing to 9", () => {
    const capacity = SUITABILITY_QUESTIONS.filter((q) => q.dimension === "capacity");
    expect(capacity.map((q) => q.id)).toEqual([
      "liquidity_backup",
      "income_stability",
      "capital_concentration",
    ]);

    for (const q of capacity) {
      const pts = q.options.map((o) => o.points ?? 0).sort((a, b) => a - b);
      expect(pts, `${q.id} must offer exactly 0,1,2,3`).toEqual([0, 1, 2, 3]);
    }

    const maxCapacity = capacity.reduce((s, q) => s + maxPoints(q.id), 0);
    expect(maxCapacity).toBe(9);
  });

  it("tolerance is exactly Q10-Q13 with maxima 1,2,3,3 summing to 9", () => {
    const tolerance = SUITABILITY_QUESTIONS.filter((q) => q.dimension === "tolerance");
    expect(tolerance.map((q) => q.id)).toEqual([
      "loss_3_percent_reaction",
      "loss_10_percent_reaction",
      "loss_20_percent_reaction",
      "principal_preference",
    ]);

    expect(tolerance.map((q) => maxPoints(q.id))).toEqual([1, 2, 3, 3]);

    // Each must also start at 0 so the floor is reachable.
    for (const q of tolerance) {
      expect(Math.min(...q.options.map((o) => o.points ?? 0)), `${q.id} floor`).toBe(0);
    }

    const maxTolerance = tolerance.reduce((s, q) => s + maxPoints(q.id), 0);
    expect(maxTolerance).toBe(9);
  });

  it("no unscored question carries points", () => {
    for (const q of SUITABILITY_QUESTIONS) {
      if (q.dimension !== null) continue;
      for (const o of q.options) {
        expect(o.points, `${q.id}/${o.value} must not be scored`).toBeUndefined();
      }
    }
  });
});

describe("required per-option metadata", () => {
  it("every horizon option declares a ceiling", () => {
    for (const o of QUESTION_BY_ID.investment_horizon.options) {
      expect(o.meta?.horizonCeiling, `horizon/${o.value}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("every experience option declares a years band", () => {
    for (const o of QUESTION_BY_ID.investment_experience_years.options) {
      expect(o.meta?.experienceYearsBand, `experience/${o.value}`).toBeTypeOf("number");
    }
  });

  it("every product option declares a level", () => {
    for (const o of QUESTION_BY_ID.investment_products.options) {
      expect(o.meta?.productLevel, `products/${o.value}`).toBeTruthy();
    }
  });

  it("every return-expectation option declares a target", () => {
    for (const o of QUESTION_BY_ID.return_expectation.options) {
      expect(o.meta?.targetReturnPct, `expectation/${o.value}`).toBeTypeOf("number");
    }
  });

  it("declares the behaviour flags the confidence rule reads", () => {
    const dd = QUESTION_BY_ID.market_drawdown_experience.options;
    expect(dd.some((o) => o.meta?.drawdownOver20 === true)).toBe(true);
    expect(dd.some((o) => o.meta?.drawdownOver20 === false)).toBe(true);

    const dr = QUESTION_BY_ID.drawdown_reaction.options;
    expect(dr.some((o) => o.meta?.panicSold === true)).toBe(true);
    expect(dr.some((o) => o.meta?.panicSold === false)).toBe(true);

    expect(
      QUESTION_BY_ID.capital_concentration.options.some((o) => o.meta?.concentrationOver50 === true),
    ).toBe(true);
  });
});

describe("optionOf", () => {
  it("resolves a known code and rejects an unknown one", () => {
    expect(optionOf("investment_horizon", "gt_10y")?.meta?.horizonCeiling).toBe(4);
    expect(optionOf("investment_horizon", "nope")).toBeUndefined();
  });
});
