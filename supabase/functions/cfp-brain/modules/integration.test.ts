// End-to-end deterministic pipeline over the real registry: the coupling fixes
// must hold when modules run in SECTION_ORDER, not just in stub tests.

import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeAll } from "../orchestrator.ts";
import { ORDERED_MODULES } from "./registry.ts";
import { makeCfpData } from "../baseline.test.ts";
import type { InsuranceDet } from "./insurance/module.ts";
import type { GoalsDet } from "./goals/calc.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

Deno.test("insurance CNA consumes after-emergency liquid assets and real education goals", () => {
  const f = makeCfpData({
    goals: [{
      id: "g-1",
      goal_type: "education",
      name: "Kid uni fund",
      target_amount: 100000,
      target_year: 2036,
      current_saved: 0,
      monthly_contribution: 0,
      inflation_override: null,
      priority: 1,
    }],
  });
  const { baseline, det } = computeAll(ORDERED_MODULES, f, {}, NOW);

  const goals = det.goals_planning as GoalsDet;
  const insurance = det.insurance_planning as InsuranceDet;

  // Coupling #1: emergency fund reserved before the CNA deducts liquid assets.
  // 50k liquid − 36k (6-month reserve) = 14k, not the raw 50k.
  assertEquals(insurance.cna.resources.liquid_assets, 14000);

  // Coupling #2: education need comes from the real goal's future cost
  // (100k × 1.04^10 ≈ 148,024 → rounded to nearest 1,000 by the CNA).
  assertEquals(baseline.goal_education_need, goals.education_future_cost_total);
  assertEquals(
    insurance.cna.needs.education,
    Math.round(goals.education_future_cost_total / 1000) * 1000,
  );

  // Premium figures flow onward for the synthesis budget.
  assertEquals(baseline.annual_premium_current, 0); // fixture has no policies
  assert(insurance.premium_topup_estimate > 0);
});

Deno.test("without education goals the CNA falls back to the per-child constant", () => {
  const { det } = computeAll(ORDERED_MODULES, makeCfpData(), {}, NOW);
  const insurance = det.insurance_planning as InsuranceDet;
  // 2 dependants × 80k × 1.04^10, rounded to nearest 1,000
  assertEquals(
    insurance.cna.needs.education,
    Math.round(2 * 80000 * Math.pow(1.04, 10) / 1000) * 1000,
  );
});
