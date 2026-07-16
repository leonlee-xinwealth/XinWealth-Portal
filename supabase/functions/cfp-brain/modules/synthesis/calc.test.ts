import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeSynthesis, passiveIncomeMonthly, wealthFreedomStage } from "./calc.ts";
import { computeBaseline } from "../../baseline.ts";
import { makeCfpData } from "../../baseline.test.ts";
import type { ModuleOutputs } from "../../types.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

// makeCfpData default baseline: surplus 60,000/yr; emergency actual 50k vs
// need_high 36k (no shortfall); dsr 0.1364; savings_ratio 0.4545.
function makePrior(overrides: Partial<Record<string, unknown>> = {}): ModuleOutputs {
  return {
    cashflow_planning: {},
    insurance_planning: {
      premium_topup_estimate: 6000,
      cna: {
        gaps: [
          { key: "life", need: 1000000, covered: 250000, gap: 750000 },
          { key: "ci", need: 396000, covered: 396000, gap: 0 },
          { key: "medical", flag_only: true, has_cover: true },
        ],
      },
    },
    retirement_planning: {
      required_monthly_topup: 2000,
      capital_needed: 2000000,
      total_projected: 1000000,
      insufficient_data: false,
    },
    goals_planning: { total_required_monthly: 1500 },
    ...overrides,
  } as ModuleOutputs;
}

Deno.test("budget waterfall allocates by fixed priority and truncates when over budget", () => {
  const f = makeCfpData();
  const det = computeSynthesis(f, computeBaseline(f, {}, NOW), makePrior());
  const [protection, emergency, retirement, goals, wealth] = det.budget.lines;
  // required: 6000 + 0 (emergency covered) + 24000 + 18000 = 48000 ≤ 60000 surplus
  assertEquals(det.budget.over_budget, false);
  assertEquals(protection.allocated_annual, 6000);
  assertEquals(emergency.required_annual, 0);
  assertEquals(retirement.allocated_annual, 24000);
  assertEquals(goals.allocated_annual, 18000);
  assertEquals(wealth.allocated_annual, 60000 - 48000);

  // Shrink surplus: 10k income → surplus (10k−6k)×12=48k? No: use expenses to
  // force over-budget instead — raise retirement need.
  const overPrior = makePrior({
    retirement_planning: {
      required_monthly_topup: 5000,
      capital_needed: 2000000,
      total_projected: 100000,
      insufficient_data: false,
    },
  });
  const over = computeSynthesis(f, computeBaseline(f, {}, NOW), overPrior);
  // required: 6000 + 0 + 60000 + 18000 = 84000 > 60000
  assert(over.budget.over_budget);
  const [p2, , r2, g2, w2] = over.budget.lines;
  assertEquals(p2.allocated_annual, 6000); // protection first, fully funded
  assertEquals(r2.allocated_annual, 54000); // then retirement takes the rest
  assertEquals(r2.deferred_annual, 6000);
  assertEquals(g2.allocated_annual, 0); // goals fully deferred
  assertEquals(g2.deferred_annual, 18000);
  assertEquals(w2.allocated_annual, 0);
});

Deno.test("health score renormalises weights when components are missing", () => {
  const f = makeCfpData();
  const b = computeBaseline(f, {}, NOW);
  const full = computeSynthesis(f, b, makePrior());
  assert(full.health_score != null && full.health_score > 0);
  assertEquals(full.score_components.length, 5);

  // No insurance/retirement det → those components null, others renormalised.
  const partial = computeSynthesis(f, b, {});
  const nulls = partial.score_components.filter((c) => c.score == null);
  assertEquals(nulls.map((c) => c.key), ["protection", "retirement"]);
  assert(partial.health_score != null);
  assert(partial.missing_modules.includes("insurance_planning"));
});

Deno.test("wealth freedom stages and next-stage gap", () => {
  // 6k expenses: S1 <1.5k, S2 ≥1.5k, S3 ≥6k, S4 ≥12k
  assertEquals(wealthFreedomStage(0, 6000).stage, 1);
  assertEquals(wealthFreedomStage(0, 6000).next_stage_gap_monthly, 1500);
  assertEquals(wealthFreedomStage(2000, 6000).stage, 2);
  assertEquals(wealthFreedomStage(2000, 6000).next_stage_gap_monthly, 4000);
  assertEquals(wealthFreedomStage(7000, 6000).stage, 3);
  assertEquals(wealthFreedomStage(12000, 6000).stage, 4);
  assertEquals(wealthFreedomStage(12000, 6000).next_stage_gap_monthly, 0);
  assertEquals(wealthFreedomStage(1000, 0).stage, null);
});

Deno.test("passive income matches keyword categories, excluding transfers", () => {
  const f = makeCfpData({
    cashflow: [
      { direction: "inflow", amount: 10000, frequency: "monthly", category: "salary" },
      { direction: "inflow", amount: 1200, frequency: "monthly", category: "Rental - condo" },
      { direction: "inflow", amount: 6000, frequency: "annual", category: "dividend" },
      { direction: "inflow", amount: 500, frequency: "monthly", category: "利息收入" },
      { direction: "inflow", amount: 900, frequency: "monthly", category: "dividend sweep", linked_asset_id: "a-1" },
      { direction: "outflow", amount: 6000, frequency: "monthly", category: "household" },
    ],
  });
  // 1200 + 500 + 500(=6000/12) = 2200; transfer-linked row excluded
  assertEquals(passiveIncomeMonthly(f), 2200);
});
