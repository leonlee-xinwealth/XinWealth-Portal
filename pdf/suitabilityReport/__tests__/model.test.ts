// Compliance guard on the suitability PDF's view model.
//
// The risk this pins down: a well-meaning edit turns a return RANGE into a
// single number, or introduces guarantee/forecast language into the report's own
// copy. Both are regulatory problems, and neither is visible in a screenshot
// review of a happy-path fixture.
import { describe, expect, it } from "vitest";
import { scoreSuitability } from "../../../lib/suitability/scoring";
import { PROFILE_RULES } from "../../../lib/suitability/rules";
import type { ProfileKey, SuitabilityAnswers } from "../../../lib/suitability/types";
import { DISCLAIMER, GAP_TEXT, L, buildAnswerRows, fmtRange, fmtTarget } from "../model";

/**
 * Return-forecast language. Deliberately NOT a bare /预测/: Q04 asks whether the
 * client's income is 可预测 ("predictable"), which is unrelated to forecasting
 * returns. We scope the Chinese terms to promises about outcomes.
 */
const BANNED = /guarantee|guaranteed|we promise|promised return|forecast|保证|承诺|回报预测|收益预测/i;

/** Every string the REPORT itself authors (not the client's own answers). */
function reportCopy(): string[] {
  return [
    ...Object.values(L.en),
    ...Object.values(L.zh),
    ...Object.values(GAP_TEXT).flatMap((g) => [g.en, g.zh]),
    DISCLAIMER.en,
    DISCLAIMER.zh,
  ];
}

describe("return figures are always ranges", () => {
  const profiles = Object.keys(PROFILE_RULES) as ProfileKey[];

  it.each(profiles)("%s renders a range, never a bare single figure", (p) => {
    for (const lang of ["en", "zh"] as const) {
      const s = fmtRange(PROFILE_RULES[p].returnRange, lang);
      expect(s, `${p}/${lang}`).toMatch(/%/);
      // Either an explicit span (4–6%) or an open-ended band (12%+).
      expect(s, `${p}/${lang} must be a range`).toMatch(/(\d+–\d+%)|(\d+%\+)/);
    }
  });

  it("renders the open-ended top profile as 12%+, not 12%", () => {
    expect(fmtRange(PROFILE_RULES.AGGRESSIVE_GROWTH.returnRange, "en")).toContain("12%+");
    expect(fmtRange(PROFILE_RULES.AGGRESSIVE_GROWTH.returnRange, "zh")).toContain("12%+");
    // A capped profile must NOT pick up the open-ended marker.
    expect(fmtRange(PROFILE_RULES.BALANCED.returnRange, "en")).not.toContain("+");
  });

  it("renders the client's stated target as a band too", () => {
    expect(fmtTarget(10, "en")).toBe("8–10% p.a.");
    expect(fmtTarget(10, "zh")).toBe("每年 8–10%");
    // 15 is the sentinel for the open-ended ">12%" option.
    expect(fmtTarget(15, "en")).toBe("12%+ p.a.");
    expect(fmtTarget(null, "en")).toBe("—");
  });

  it("labels the range as a historical reference in both languages", () => {
    expect(L.en.returnRef.toLowerCase()).toContain("historical");
    expect(L.zh.returnRef).toContain("历史");
    expect(L.en.returnRef.toLowerCase()).toContain("range");
    expect(L.zh.returnRef).toContain("区间");
  });
});

describe("compliance language", () => {
  it("uses no guarantee or forecast language in the report's own copy", () => {
    for (const s of reportCopy()) {
      expect(s, `banned phrasing in: ${s.slice(0, 60)}`).not.toMatch(BANNED);
    }
  });

  it("explicitly disclaims advice, guarantees and repetition of past returns", () => {
    expect(DISCLAIMER.en).toMatch(/not personalised investment advice/i);
    expect(DISCLAIMER.en).toMatch(/may not repeat/i);
    expect(DISCLAIMER.en).toMatch(/fall as well as rise/i);
    expect(DISCLAIMER.zh).toContain("并非个人化投资建议");
    expect(DISCLAIMER.zh).toContain("未必重现");
    expect(DISCLAIMER.zh).toContain("可升可跌");
  });

  it("frames a significant gap as a discussion, not a rejection", () => {
    expect(GAP_TEXT.SIGNIFICANT_GAP.en).toMatch(/discuss/i);
    expect(GAP_TEXT.SIGNIFICANT_GAP.zh).toContain("讨论");
  });
});

describe("answer rows", () => {
  const answers: SuitabilityAnswers = {
    investment_objective: "capital_growth",
    investment_horizon: "lt_1y",
    liquidity_backup: "gte_12m",
    income_stability: "very_stable",
    capital_concentration: "lt_10",
    investment_experience_years: "gt_10y",
    investment_products: [],
    market_drawdown_experience: "over_20",
    drawdown_reaction: "bought_more",
    loss_3_percent_reaction: "acceptable",
    loss_10_percent_reaction: "hold",
    loss_20_percent_reaction: "add",
    principal_preference: "large_loss",
    return_expectation: "gt_12",
    investment_preference: "self_directed",
  };

  it("renders all 15 questions with resolved bilingual option text", () => {
    const zh = buildAnswerRows(answers, "zh");
    expect(zh).toHaveLength(15);
    expect(zh.map((r) => r.order)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    for (const r of zh) {
      expect(r.question.trim()).not.toBe("");
      expect(r.answer.trim()).not.toBe("");
      // raw option codes must never leak into a client-facing document
      expect(r.answer).not.toMatch(/^[a-z0-9_]+$/);
    }
  });

  it("renders an empty multi-select as 'None' rather than blank", () => {
    expect(buildAnswerRows(answers, "en").find((r) => r.order === 7)?.answer).toBe(L.en.none);
    expect(buildAnswerRows(answers, "zh").find((r) => r.order === 7)?.answer).toBe(L.zh.none);
  });

  it("joins multi-select answers with the locale's list separator", () => {
    const multi = { ...answers, investment_products: ["cash", "etf"] };
    expect(buildAnswerRows(multi, "zh").find((r) => r.order === 7)?.answer).toContain("、");
    expect(buildAnswerRows(multi, "en").find((r) => r.order === 7)?.answer).toContain(", ");
  });
});

describe("the snapshot drives the document, not the live rules", () => {
  it("carries profile copy and ranges that survive a later rules edit", () => {
    const r = scoreSuitability({
      investment_objective: "balanced_growth",
      investment_horizon: "gt_10y",
      liquidity_backup: "gte_12m",
      income_stability: "very_stable",
      capital_concentration: "lt_10",
      investment_experience_years: "gt_10y",
      investment_products: ["etf"],
      market_drawdown_experience: "over_20",
      drawdown_reaction: "held",
      loss_3_percent_reaction: "acceptable",
      loss_10_percent_reaction: "hold",
      loss_20_percent_reaction: "add",
      principal_preference: "large_loss",
      return_expectation: "gt_12",
      investment_preference: "collaborative",
    });
    const cs = r.configSnapshot;
    expect(cs.profile).toBe("AGGRESSIVE_GROWTH");
    expect(fmtRange(cs.returnRange, "en")).toContain("12%+");
    expect(cs.profileNameZh).toBeTruthy();
    expect(cs.descriptionZh).toBeTruthy();
    expect(cs.allocation.growth.max).toBe(80);
  });
});
