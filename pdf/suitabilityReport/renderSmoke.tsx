// Dev harness for the Investor Suitability PDF. Renders a worst-case fixture —
// the longest Chinese profile copy, every red flag firing, and long CJK answer
// strings — so overflow and wrap bugs surface before an advisor sees one.
//
// Usage: npx tsx pdf/suitabilityReport/renderSmoke.tsx [zh|en] [outPath]
import fs from "node:fs";
import { scoreSuitability } from "../../lib/suitability/scoring";
import { renderSuitabilityPdf } from "./renderNode";
import type { SuitabilityReportData } from "./model";

const lang = (process.argv[2] === "en" ? "en" : "zh") as "en" | "zh";
const out = process.argv[3] || `pdf/suitabilityReport/smoke-${lang}.pdf`;

// Maxed appetite + 1-year horizon + >12% target: forces STABLE via the MIN rule,
// fires RF01 + RF03, applies the equity cap, and requires advisor review.
const answers = {
  investment_objective: "capital_growth",
  investment_horizon: "lt_1y",
  liquidity_backup: "gte_12m",
  income_stability: "very_stable",
  capital_concentration: "lt_10",
  investment_experience_years: "gt_10y",
  investment_products: ["cash", "fd", "bond", "unit_trust", "etf", "equity", "reit", "private_credit", "alternative", "private_equity"],
  market_drawdown_experience: "over_20",
  drawdown_reaction: "bought_more",
  loss_3_percent_reaction: "acceptable",
  loss_10_percent_reaction: "hold",
  loss_20_percent_reaction: "add",
  principal_preference: "large_loss",
  return_expectation: "gt_12",
  investment_preference: "self_directed",
};

const r = scoreSuitability(answers);

const data: SuitabilityReportData = {
  prospectName: lang === "zh" ? "陈美玲（测试用最长姓名示例）" : "Chan Mei Ling",
  advisorName: "Leon Lee",
  submittedAt: "2026-08-12",
  generatedDate: "2026-08-12",
  language: lang,
  ruleVersion: r.ruleVersion,
  finalProfile: r.profile,
  finalBand: r.finalBand,
  horizonCeilingBand: r.horizon.ceilingBand,
  capacityScore: r.capacity.score,
  capacityBand: r.capacity.band,
  toleranceScore: r.tolerance.score,
  toleranceBand: r.tolerance.band,
  experienceYearsBand: r.experience.yearsBand,
  productLevel: r.experience.productLevel,
  behaviourConfidence: r.behaviourConfidence,
  expectationGap: r.expectationGap,
  targetReturnPct: r.targetReturnPct,
  redFlags: r.redFlags,
  requiresAdvisorReview: r.requiresAdvisorReview,
  configSnapshot: r.configSnapshot,
  answers,
};

const buf = await renderSuitabilityPdf(data);
fs.writeFileSync(out, buf);
console.log(
  `wrote ${out} (${buf.length} bytes) profile=${r.profile} flags=${r.redFlags.map((f) => f.code).join(",")} cap=${r.allocation.capApplied}`,
);
