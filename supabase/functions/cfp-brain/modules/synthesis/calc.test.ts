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

Deno.test("passive income is the I2 group, excluding transfers", () => {
  const f = makeCfpData({
    cashflow: [
      { direction: "inflow", amount: 10000, frequency: "monthly", category: "salary_basic", period_month: "2026-06-01" },
      { direction: "inflow", amount: 1200, frequency: "monthly", category: "rental_income", period_month: "2026-06-01" },
      // a legacy code still resolves: dividend → dividend_company (I2)
      { direction: "inflow", amount: 6000, frequency: "annual", category: "dividend", period_month: "2026-06-01" },
      { direction: "inflow", amount: 500, frequency: "monthly", category: "interest_income", period_month: "2026-06-01" },
      // drawing on savings is a transfer, never passive income
      { direction: "inflow", amount: 900, frequency: "monthly", category: "savings_withdrawal", period_month: "2026-06-01" },
      { direction: "outflow", amount: 6000, frequency: "monthly", category: "household", period_month: "2026-06-01" },
    ],
  });
  // 1200 + 500 + 500(=6000/12) = 2200
  assertEquals(passiveIncomeMonthly(f), 2200);
});

// ---------------------------------------------------------------------------
// headlines — the cross-module figures the SWOT page argues from.
//
// The contract that matters is that this is a SELECTION. If it ever starts
// recomputing, the SWOT page can contradict the page that owns the figure, and
// the client is reading two different numbers for the same thing.
// ---------------------------------------------------------------------------

const B = () => computeBaseline(makeCfpData(), {}, NOW);

Deno.test("headlines copy each figure from the module that owns it", () => {
  const b = B();
  const prior = makePrior({
    cashflow_planning: { emergency_fund: { months_covered: 8.3, shortfall: 0 } },
    legacy_planning: {
      distribution: { will_status: "no_will" },
      estate_liquidity: { shortfall: 120_000 },
    },
    goals_planning: {
      total_required_monthly: 1500,
      goals: [{ on_track: false }, { on_track: true }, { on_track: false }],
    },
  });
  const h = computeSynthesis(makeCfpData(), b, prior).headlines;

  assertEquals(h.life_gap, 750_000);
  assertEquals(h.ci_gap, 0);
  assertEquals(h.medical_covered, true);
  assertEquals(h.emergency_months_covered, 8.3);
  assertEquals(h.goals_off_track_count, 2);
  assertEquals(h.goals_shortfall_monthly, 1500);
  assertEquals(h.has_will, false);
  assertEquals(h.estate_liquidity_shortfall, 120_000);
  // Straight from the baseline, so the ratio page and the SWOT page can never
  // print different numbers for the same ratio.
  assertEquals(h.savings_ratio, b.savings_ratio);
  assertEquals(h.solvency_ratio, b.solvency_ratio);
  assertEquals(h.net_worth, b.net_worth);
});

Deno.test("a section that has not been generated yields null, not zero", () => {
  // Zero would read as "no gap" on the SWOT board — the model would write
  // "protection is fully covered" about a client whose insurance was never run.
  const h = computeSynthesis(makeCfpData(), B(), {}).headlines;
  assertEquals(h.life_gap, null);
  assertEquals(h.ci_gap, null);
  assertEquals(h.medical_covered, null);
  assertEquals(h.has_will, null);
  assertEquals(h.depletion_age, null);
  assertEquals(h.retirement_on_track, null);
});

Deno.test("liquid-to-net-worth declines to divide by a negative net worth", () => {
  const f = makeCfpData({
    assets: [{ asset_type: "savings", current_value: 10_000, cost_value: null, ownership_type: null }],
    liabilities: [{
      liability_type: "mortgage", outstanding_balance: 500_000,
      interest_rate: 0.04, monthly_payment: 2000, end_date: null,
    }],
  });
  const h = computeSynthesis(f, computeBaseline(f, {}, NOW), makePrior()).headlines;
  assert(h.net_worth < 0);
  assertEquals(h.liquid_to_net_worth, null);
});

Deno.test("headlines survive a module that returned only part of its output", () => {
  // Synthesis is the one section that must always render; a summary field is
  // not allowed to be the thing that breaks it.
  const h = computeSynthesis(
    makeCfpData(), B(),
    { insurance_planning: {}, cashflow_planning: {}, legacy_planning: {} } as ModuleOutputs,
  ).headlines;
  assertEquals(h.life_gap, null);
  assertEquals(h.emergency_months_covered, null);
  assertEquals(h.estate_liquidity_shortfall, 0);
});
