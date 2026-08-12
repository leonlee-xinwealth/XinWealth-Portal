// The suitability model under test. The two assertions that matter most are
// "the MIN rule dominates" and "experience never upgrades" — those are the whole
// reason this is a rule engine and not a total-score calculator.
import { describe, expect, it } from "vitest";
import { scoreSuitability, validateAnswers } from "./scoring";
import type { SuitabilityAnswers } from "./types";

/** A middle-of-the-road, fully-answered baseline. Override per test. */
function answers(over: Partial<SuitabilityAnswers> = {}): SuitabilityAnswers {
  return {
    investment_objective: "balanced_growth",
    investment_horizon: "5_10y", // ceiling 4
    liquidity_backup: "6_12m", // 2
    income_stability: "stable", // 2
    capital_concentration: "10_25", // 2  -> capacity 6 -> band 3
    investment_experience_years: "3_5y", // band 2
    investment_products: ["unit_trust"],
    market_drawdown_experience: "small_decline",
    drawdown_reaction: "held",
    loss_3_percent_reaction: "acceptable", // 1
    loss_10_percent_reaction: "hold", // 2
    loss_20_percent_reaction: "hold", // 2
    principal_preference: "moderate_loss", // 2  -> tolerance 7 -> band 3
    return_expectation: "8_10",
    investment_preference: "collaborative",
    ...over,
  };
}

/** Maxes out capacity (9) and tolerance (9). */
const MAXED: Partial<SuitabilityAnswers> = {
  liquidity_backup: "gte_12m",
  income_stability: "very_stable",
  capital_concentration: "lt_10",
  loss_3_percent_reaction: "acceptable",
  loss_10_percent_reaction: "hold",
  loss_20_percent_reaction: "add",
  principal_preference: "large_loss",
};

describe("the MIN rule", () => {
  it("lets a short horizon override maximum capacity AND maximum tolerance", () => {
    const r = scoreSuitability(answers({ ...MAXED, investment_horizon: "lt_1y" }));

    expect(r.capacity.score).toBe(9);
    expect(r.capacity.band).toBe(4);
    expect(r.tolerance.score).toBe(9);
    expect(r.tolerance.band).toBe(4);
    expect(r.horizon.ceilingBand).toBe(1);

    // The binding constraint wins.
    expect(r.finalBand).toBe(1);
    expect(r.profile).toBe("STABLE");
  });

  it("lets low capacity override high tolerance and a long horizon", () => {
    const r = scoreSuitability(
      answers({
        ...MAXED,
        investment_horizon: "gt_10y",
        liquidity_backup: "lt_3m",
        income_stability: "unstable",
        capital_concentration: "gt_50",
      }),
    );
    expect(r.capacity.score).toBe(0);
    expect(r.capacity.level).toBe("LOW");
    expect(r.tolerance.band).toBe(4);
    expect(r.finalBand).toBe(1);
    expect(r.profile).toBe("STABLE");
  });

  it("reaches AGGRESSIVE_GROWTH only when all three dimensions allow it", () => {
    const r = scoreSuitability(answers({ ...MAXED, investment_horizon: "gt_10y" }));
    expect(r.profile).toBe("AGGRESSIVE_GROWTH");
    expect(r.finalBand).toBe(4);
  });
});

describe("THE HARD RULE — experience never upgrades the profile", () => {
  it("a 10-year veteran in private equity with low capacity is not upgraded", () => {
    const base: Partial<SuitabilityAnswers> = {
      investment_horizon: "gt_10y",
      liquidity_backup: "lt_3m",
      income_stability: "unstable",
      capital_concentration: "25_50", // capacity 1 -> band 1
      loss_3_percent_reaction: "acceptable",
      loss_10_percent_reaction: "hold",
      loss_20_percent_reaction: "add",
      principal_preference: "large_loss", // tolerance 9 -> band 4
    };

    const novice = scoreSuitability(
      answers({
        ...base,
        investment_experience_years: "none",
        investment_products: [],
        market_drawdown_experience: "never_invested",
      }),
    );
    const veteran = scoreSuitability(
      answers({
        ...base,
        investment_experience_years: "gt_10y",
        investment_products: ["private_equity", "unit_trust"],
        market_drawdown_experience: "over_20",
        drawdown_reaction: "bought_more",
      }),
    );

    // Same profile. Only the confidence signal differs.
    expect(novice.finalBand).toBe(1);
    expect(veteran.finalBand).toBe(1);
    expect(veteran.profile).toBe(novice.profile);

    expect(novice.behaviourConfidence).toBe("LOW");
    expect(veteran.behaviourConfidence).toBe("HIGH");
    expect(veteran.experience).toEqual({ yearsBand: 4, productLevel: "ADVANCED" });
  });

  it("takes the highest product level held, ignoring order", () => {
    const r = scoreSuitability(
      answers({ investment_products: ["cash", "private_credit", "fd", "etf"] }),
    );
    expect(r.experience.productLevel).toBe("ADVANCED");

    const basic = scoreSuitability(answers({ investment_products: ["cash", "fd"] }));
    expect(basic.experience.productLevel).toBe("BASIC");

    const none = scoreSuitability(answers({ investment_products: [] }));
    expect(none.experience.productLevel).toBe("NONE");
  });
});

describe("band cut-points", () => {
  // liquidity/income/concentration each contribute 0-3; pick combos per score.
  const capacityCombos: [number, string, string, string][] = [
    [0, "lt_3m", "unstable", "gt_50"],
    [2, "3_6m", "variable", "gt_50"],
    [3, "3_6m", "variable", "25_50"],
    [5, "6_12m", "variable", "10_25"],
    [6, "6_12m", "stable", "10_25"],
    [7, "gte_12m", "stable", "10_25"],
    [8, "gte_12m", "very_stable", "10_25"],
    [9, "gte_12m", "very_stable", "lt_10"],
  ];
  const expectedBand = (s: number) => (s <= 2 ? 1 : s <= 5 ? 2 : s <= 7 ? 3 : 4);

  it.each(capacityCombos)(
    "capacity score %i maps to the right band",
    (score, liquidity_backup, income_stability, capital_concentration) => {
      const r = scoreSuitability(
        answers({ liquidity_backup, income_stability, capital_concentration }),
      );
      expect(r.capacity.score).toBe(score);
      expect(r.capacity.band).toBe(expectedBand(score));
    },
  );

  const toleranceCombos: [number, string, string, string, string][] = [
    [0, "uncomfortable", "exit", "exit_all", "no_loss"],
    [2, "uncomfortable", "hold", "exit_all", "no_loss"],
    [3, "acceptable", "hold", "exit_all", "no_loss"],
    [5, "acceptable", "hold", "hold", "no_loss"],
    [6, "acceptable", "hold", "hold", "small_loss"],
    [7, "acceptable", "hold", "hold", "moderate_loss"],
    [8, "acceptable", "hold", "hold", "large_loss"],
    [9, "acceptable", "hold", "add", "large_loss"],
  ];

  it.each(toleranceCombos)(
    "tolerance score %i maps to the right band",
    (
      score,
      loss_3_percent_reaction,
      loss_10_percent_reaction,
      loss_20_percent_reaction,
      principal_preference,
    ) => {
      const r = scoreSuitability(
        answers({
          loss_3_percent_reaction,
          loss_10_percent_reaction,
          loss_20_percent_reaction,
          principal_preference,
        }),
      );
      expect(r.tolerance.score).toBe(score);
      expect(r.tolerance.band).toBe(expectedBand(score));
    },
  );
});

describe("behaviour confidence", () => {
  it("is LOW for no experience, no drawdown lived through, and high tolerance", () => {
    const r = scoreSuitability(
      answers({
        ...MAXED,
        investment_experience_years: "none",
        investment_products: [],
        market_drawdown_experience: "never_invested",
      }),
    );
    expect(r.tolerance.band).toBeGreaterThanOrEqual(3);
    expect(r.behaviourConfidence).toBe("LOW");
  });

  it("is HIGH for a >20% drawdown held without selling and 5+ years", () => {
    const r = scoreSuitability(
      answers({
        investment_experience_years: "5_10y",
        market_drawdown_experience: "over_20",
        drawdown_reaction: "held",
      }),
    );
    expect(r.behaviourConfidence).toBe("HIGH");
  });

  it("is MEDIUM when they lived through a drawdown but sold out", () => {
    const r = scoreSuitability(
      answers({
        investment_experience_years: "gt_10y",
        market_drawdown_experience: "over_20",
        drawdown_reaction: "sold_all",
      }),
    );
    expect(r.behaviourConfidence).toBe("MEDIUM");
  });
});

describe("expectation gap", () => {
  // Baseline lands on GROWTH (capacity 6 / tolerance 7 / ceiling 4), range 8-12.
  it("is ALIGNED when the target equals the profile ceiling", () => {
    const r = scoreSuitability(answers({ return_expectation: "10_12" }));
    expect(r.profile).toBe("GROWTH");
    expect(r.returnRange).toEqual({ min: 8, max: 12 });
    expect(r.targetReturnPct).toBe(12);
    expect(r.expectationGap).toBe("ALIGNED");
  });

  it("is MODERATE_GAP at exactly +2pp over the ceiling", () => {
    // BALANCED (max 10) with a 10-12% target -> target 12, excess exactly 2.
    const r = scoreSuitability(
      answers({ investment_horizon: "3_5y", return_expectation: "10_12" }),
    );
    expect(r.profile).toBe("BALANCED");
    expect(r.targetReturnPct! - r.returnRange.max!).toBe(2);
    expect(r.expectationGap).toBe("MODERATE_GAP");
  });

  it("is SIGNIFICANT_GAP beyond +2pp", () => {
    const r = scoreSuitability(
      answers({ investment_horizon: "3_5y", return_expectation: "gt_12" }),
    );
    expect(r.profile).toBe("BALANCED");
    expect(r.expectationGap).toBe("SIGNIFICANT_GAP");
  });

  it("is always ALIGNED for the open-ended profile, which has no ceiling", () => {
    const r = scoreSuitability(
      answers({ ...MAXED, investment_horizon: "gt_10y", return_expectation: "gt_12" }),
    );
    expect(r.profile).toBe("AGGRESSIVE_GROWTH");
    expect(r.returnRange.max).toBeNull();
    expect(r.expectationGap).toBe("ALIGNED");
  });
});

describe("red flags", () => {
  const codes = (a: SuitabilityAnswers) => scoreSuitability(a).redFlags.map((f) => f.code);

  it("RF01 fires on a sub-3-year horizon with high tolerance", () => {
    const c = codes(answers({ ...MAXED, investment_horizon: "1_3y" }));
    expect(c).toContain("RF01");
  });

  it("RF02 fires on low capacity with high tolerance", () => {
    const c = codes(
      answers({
        ...MAXED,
        investment_horizon: "gt_10y",
        liquidity_backup: "lt_3m",
        income_stability: "unstable",
        capital_concentration: "25_50",
      }),
    );
    expect(c).toContain("RF02");
  });

  it("RF03 fires with, and only with, a significant expectation gap", () => {
    expect(codes(answers({ investment_horizon: "3_5y", return_expectation: "gt_12" }))).toContain(
      "RF03",
    );
    expect(codes(answers({ return_expectation: "8_10" }))).not.toContain("RF03");
  });

  it("RF04 fires on >50% concentration into a growth-or-higher profile", () => {
    // >50% concentration costs 3 capacity points, so pad the other two to keep
    // the final band at 3.
    const c = codes(
      answers({
        investment_horizon: "gt_10y",
        liquidity_backup: "gte_12m",
        income_stability: "very_stable",
        capital_concentration: "gt_50", // capacity 6 -> band 3
      }),
    );
    expect(c).toContain("RF04");
  });

  it("RF04 does not fire when the same concentration lands on a lower profile", () => {
    const c = codes(answers({ investment_horizon: "1_3y", capital_concentration: "gt_50" }));
    expect(c).not.toContain("RF04");
  });

  it("RF05 fires on an inexperienced client reaching the top profile", () => {
    const c = codes(
      answers({
        ...MAXED,
        investment_horizon: "gt_10y",
        investment_experience_years: "lt_3y",
        investment_products: [],
      }),
    );
    expect(c).toContain("RF05");
  });

  it("a clean moderate profile raises nothing", () => {
    expect(codes(answers())).toEqual([]);
  });
});

describe("requires advisor review", () => {
  it("is false for a clean profile with aligned expectations", () => {
    const r = scoreSuitability(answers());
    expect(r.redFlags).toEqual([]);
    expect(r.requiresAdvisorReview).toBe(false);
  });

  it("is true on any HIGH red flag", () => {
    const r = scoreSuitability(answers({ ...MAXED, investment_horizon: "1_3y" }));
    expect(r.redFlags.some((f) => f.severity === "HIGH")).toBe(true);
    expect(r.requiresAdvisorReview).toBe(true);
  });

  it("is true on a significant expectation gap alone", () => {
    const r = scoreSuitability(
      answers({ investment_horizon: "3_5y", return_expectation: "gt_12" }),
    );
    expect(r.expectationGap).toBe("SIGNIFICANT_GAP");
    expect(r.requiresAdvisorReview).toBe(true);
  });

  it("is true on low behaviour confidence alone", () => {
    const r = scoreSuitability(
      answers({
        ...MAXED,
        investment_horizon: "gt_10y",
        investment_experience_years: "none",
        investment_products: [],
        market_drawdown_experience: "never_invested",
      }),
    );
    expect(r.behaviourConfidence).toBe("LOW");
    expect(r.requiresAdvisorReview).toBe(true);
  });

  it("is true when capacity and tolerance diverge by 2+ bands", () => {
    const r = scoreSuitability(
      answers({
        investment_horizon: "gt_10y",
        liquidity_backup: "gte_12m",
        income_stability: "very_stable",
        capital_concentration: "lt_10", // capacity 9 -> band 4
        loss_3_percent_reaction: "uncomfortable",
        loss_10_percent_reaction: "exit",
        loss_20_percent_reaction: "exit_all",
        principal_preference: "small_loss", // tolerance 1 -> band 1
      }),
    );
    expect(Math.abs(r.capacity.band - r.tolerance.band)).toBeGreaterThanOrEqual(2);
    expect(r.requiresAdvisorReview).toBe(true);
  });
});

describe("allocation and the time-horizon equity cap", () => {
  it("clips STABLE growth to 10% under a 3-year horizon", () => {
    const r = scoreSuitability(answers({ investment_horizon: "1_3y" }));
    expect(r.profile).toBe("STABLE");
    expect(r.allocation.equityCapPct).toBe(10);
    expect(r.allocation.capApplied).toBe(true);
    expect(r.allocation.growth).toEqual({ min: 0, max: 10 });
    // Defensive and diversifier are untouched, and 100% is still reachable.
    expect(r.allocation.defensive).toEqual({ min: 70, max: 90 });
    expect(r.allocation.defensive.max + r.allocation.growth.max! + r.allocation.diversifier.max!)
      .toBeGreaterThanOrEqual(100);
  });

  it("clips BALANCED growth to 40% on a 3-5 year horizon", () => {
    const r = scoreSuitability(answers({ investment_horizon: "3_5y" }));
    expect(r.profile).toBe("BALANCED");
    expect(r.allocation.capApplied).toBe(true);
    expect(r.allocation.growth).toEqual({ min: 30, max: 40 });
    expect(r.allocation.defensive.max + r.allocation.growth.max! + r.allocation.diversifier.max!)
      .toBeGreaterThanOrEqual(100);
  });

  it("applies no cap at 5 years or more", () => {
    const r = scoreSuitability(answers());
    expect(r.allocation.equityCapPct).toBeNull();
    expect(r.allocation.capApplied).toBe(false);
    expect(r.allocation.growth).toEqual({ min: 50, max: 70 });
  });
});

describe("config snapshot", () => {
  it("carries the resolved profile copy and rule version", () => {
    const r = scoreSuitability(answers());
    expect(r.configSnapshot.ruleVersion).toBe(r.ruleVersion);
    expect(r.configSnapshot.profile).toBe("GROWTH");
    expect(r.configSnapshot.profileNameZh).toBe("成长型投资者");
    expect(r.configSnapshot.returnRange).toEqual({ min: 8, max: 12 });
    expect(r.configSnapshot.descriptionEn.length).toBeGreaterThan(40);
    expect(r.configSnapshot.descriptionZh.length).toBeGreaterThan(20);
  });

  it("is a deep clone — mutating it cannot poison the module constants", () => {
    const first = scoreSuitability(answers());
    first.configSnapshot.returnRange.max = 999;
    first.configSnapshot.allocation.growth.min = 999;

    const second = scoreSuitability(answers());
    expect(second.configSnapshot.returnRange.max).toBe(12);
    expect(second.configSnapshot.allocation.growth.min).toBe(50);
  });
});

describe("validateAnswers", () => {
  it("accepts a complete payload", () => {
    const v = validateAnswers(answers());
    expect(v.ok).toBe(true);
  });

  it("rejects a missing question", () => {
    const bad = answers();
    delete bad.principal_preference;
    const v = validateAnswers(bad);
    expect(v).toEqual({ ok: false, questionId: "principal_preference", reason: "MISSING" });
  });

  it("rejects an unknown option code", () => {
    const v = validateAnswers(answers({ loss_20_percent_reaction: "panic" }));
    expect(v).toEqual({ ok: false, questionId: "loss_20_percent_reaction", reason: "UNKNOWN_OPTION" });
  });

  it("rejects a bare string for the multi-select question", () => {
    const v = validateAnswers({ ...answers(), investment_products: "etf" });
    expect(v).toEqual({ ok: false, questionId: "investment_products", reason: "WRONG_SHAPE" });
  });

  it("accepts an empty product list and dedupes repeats", () => {
    expect(validateAnswers(answers({ investment_products: [] })).ok).toBe(true);
    const v = validateAnswers(answers({ investment_products: ["etf", "etf", "cash"] }));
    expect(v.ok && v.answers.investment_products).toEqual(["etf", "cash"]);
  });

  it("rejects a non-object payload", () => {
    expect(validateAnswers(null)).toEqual({ ok: false, questionId: null, reason: "WRONG_SHAPE" });
    expect(validateAnswers([])).toEqual({ ok: false, questionId: null, reason: "WRONG_SHAPE" });
  });
});
