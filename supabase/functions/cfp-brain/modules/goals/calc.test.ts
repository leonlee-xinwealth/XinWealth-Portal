import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeGoals, fvMonthly, pmtMonthly } from "./calc.ts";
import { computeBaseline } from "../../baseline.ts";
import { makeCfpData } from "../../baseline.test.ts";
import type { ClientGoalRow } from "../../types.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

const eduGoal: ClientGoalRow = {
  id: "g-1",
  goal_type: "education",
  name: "Kids university",
  target_amount: 100000,
  target_year: 2036, // 10 years out
  current_saved: 20000,
  monthly_contribution: 0,
  inflation_override: null,
  priority: 1,
};

function run(goals: ClientGoalRow[]) {
  const f = makeCfpData({ goals });
  return computeGoals(f, computeBaseline(f, {}, NOW));
}

Deno.test("education goal inflates at 4% and projects savings at the risk-band return", () => {
  const d = run([eduGoal]);
  const g = d.goals[0];
  assertEquals(g.years_to_target, 10);
  assertEquals(g.inflation_used, 0.04);
  assertEquals(g.future_cost, Math.round(100000 * Math.pow(1.04, 10))); // 148,024
  // growth band → 7.5%
  assertEquals(g.projected_savings, Math.round(20000 * Math.pow(1.075, 10)));
  assert(g.gap > 0);
  assert(g.required_monthly > 0);
  assertEquals(d.education_future_cost_total, g.future_cost);
});

Deno.test("monthly contributions compound; funded goal is on_track with zero required_monthly", () => {
  const funded: ClientGoalRow = {
    ...eduGoal,
    id: "g-2",
    goal_type: "house",
    current_saved: 200000,
    monthly_contribution: 500,
  };
  const d = run([funded]);
  const g = d.goals[0];
  assertEquals(g.inflation_used, 0.035); // non-education default
  assert(g.on_track);
  assertEquals(g.gap, 0);
  assertEquals(g.required_monthly, 0);
  assertEquals(d.education_future_cost_total, 0);
});

Deno.test("no goals → empty deterministic output, never throws", () => {
  const d = run([]);
  assert(d.no_goals);
  assertEquals(d.total_required_monthly, 0);
  assertEquals(d.education_future_cost_total, 0);
});

Deno.test("fv/pmt helpers: zero-rate and zero-target edge cases", () => {
  assertEquals(fvMonthly(100, 0, 2), 2400);
  assertEquals(pmtMonthly(0, 0.06, 5), 0);
  assertEquals(Math.round(pmtMonthly(12000, 0, 1)), 1000);
});

Deno.test("inflation_override wins over defaults", () => {
  const custom: ClientGoalRow = { ...eduGoal, inflation_override: 0.08 };
  const d = run([custom]);
  assertEquals(d.goals[0].inflation_used, 0.08);
});
