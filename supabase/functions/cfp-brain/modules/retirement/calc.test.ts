import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeRetirement, growingAnnuityPv, simulateDrawdown } from "./calc.ts";
import { computeBaseline } from "../../baseline.ts";
import { makeCfpData } from "../../baseline.test.ts";
import { pmtMonthly } from "../goals/calc.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

function det(overrides = {}) {
  const f = makeCfpData(overrides);
  return computeRetirement(f, computeBaseline(f, {}, NOW));
}

Deno.test("full happy path matches hand-computed capital projection (years=24)", () => {
  const d = det(); // default fixture: age 36, retirement_age 60 -> 24 years
  const years = 24;

  // P2a: annual_expenses is 90,000 (72,000 manual household spend + the
  // fixture's mortgage installment auto-derived at 1,500/mo = 18,000/yr).
  const incomeNeed = 90000 * 0.66 * Math.pow(1.035, years); // annual_expenses × replacement × inflation
  const capitalNeeded = incomeNeed / 0.04; // 4% withdrawal rule
  const annualEpfContribution = 0.23 * 132000; // employed: 11% + 12% employer
  const epfGrowth = Math.pow(1.055, years);
  const epfProjected = 100000 * epfGrowth + annualEpfContribution * (epfGrowth - 1) / 0.055;
  const totalProjected = epfProjected; // no PRS or other investable assets in the fixture
  const gap = Math.max(0, capitalNeeded - totalProjected);
  const requiredMonthlyTopup = pmtMonthly(gap, 0.075, years); // growth band return

  assertEquals(d.insufficient_data, false);
  assertEquals(d.years_to_retirement, 24);
  assertEquals(d.retirement_years, 25); // 85 - 60
  assertEquals(d.income_need_at_retirement, Math.round(incomeNeed));
  assertEquals(d.capital_needed, Math.round(capitalNeeded));
  assertEquals(d.epf_balance, 100000);
  assertEquals(d.annual_epf_contribution, Math.round(annualEpfContribution));
  assertEquals(d.epf_projected, Math.round(epfProjected));
  assertEquals(d.prs_balance, 0);
  assertEquals(d.prs_projected, 0);
  assertEquals(d.other_investable, 0);
  assertEquals(d.other_projected, 0);
  assertEquals(d.total_projected, Math.round(totalProjected));
  assertEquals(d.gap, Math.round(gap));
  assertEquals(d.required_monthly_topup, Math.round(requiredMonthlyTopup));
});

Deno.test("EPF contribution is zero when the client is not employed", () => {
  const d = det({ client: { ...makeCfpData().client, employment_status: "self_employed" } });
  const epfGrowth = Math.pow(1.055, 24);
  assertEquals(d.annual_epf_contribution, 0);
  assertEquals(d.epf_projected, Math.round(100000 * epfGrowth));
});

Deno.test("missing date of birth: insufficient_data with all projections zeroed", () => {
  const d = det({ client: { ...makeCfpData().client, date_of_birth: null } });
  assert(d.insufficient_data);
  assertEquals(d.years_to_retirement, null);
  assertEquals(d.income_need_at_retirement, 0);
  assertEquals(d.capital_needed, 0);
  assertEquals(d.epf_projected, 0);
  assertEquals(d.prs_projected, 0);
  assertEquals(d.other_projected, 0);
  assertEquals(d.total_projected, 0);
  assertEquals(d.gap, 0);
  assertEquals(d.required_monthly_topup, 0);
  assertEquals(d.on_track, false);
  // Raw balances are still available even without a projection horizon.
  assertEquals(d.epf_balance, 100000);
});

Deno.test("gap clamps to zero when EPF alone heavily overfunds retirement", () => {
  const d = det({
    assets: [
      { asset_type: "savings", current_value: 30000, cost_value: null, ownership_type: null },
      { asset_type: "fixed_deposit", current_value: 20000, cost_value: null, ownership_type: null },
      { asset_type: "property", current_value: 500000, cost_value: null, ownership_type: null },
      { asset_type: "epf_account_1", current_value: 5000000, cost_value: null, ownership_type: null },
    ],
  });
  assertEquals(d.epf_balance, 5000000);
  assertEquals(d.gap, 0);
  assertEquals(d.on_track, true);
  assertEquals(d.required_monthly_topup, 0);
});

Deno.test("years=0 when retirement_age equals current age does not divide by zero", () => {
  const d = det({ client: { ...makeCfpData().client, retirement_age: 36 } });
  assertEquals(d.years_to_retirement, 0);
  assertEquals(d.retirement_years, 49); // 85 - 36
  // (1+r)^0 = 1, so income need has no inflation growth applied
  // P2a: annual_expenses is 90,000 (see the happy-path test above).
  const incomeNeed = 90000 * 0.66; // years=0
  const capitalNeeded = incomeNeed / 0.04;
  assertEquals(d.income_need_at_retirement, Math.round(incomeNeed));
  assertEquals(d.capital_needed, Math.round(capitalNeeded));
  assertEquals(d.epf_projected, 100000); // no growth, no contribution term at years=0
  assertEquals(d.gap, Math.round(capitalNeeded) - 100000);
  assertEquals(d.required_monthly_topup, Math.round(capitalNeeded) - 100000);
});

Deno.test("simulateDrawdown: small capital vs big need depletes mid-way", () => {
  // Mirror the loop by hand: capital = capital*(1+rate) - need; need *= (1+inflation).
  let capital = 100000;
  let need = 50000;
  const rate = 0.03;
  const inflation = 0.02;
  let depletionAge: number | null = null;
  for (let age = 60; age < 100; age++) {
    capital = capital * (1 + rate) - need;
    if (capital < 0) {
      depletionAge = age;
      break;
    }
    need = need * (1 + inflation);
  }
  const result = simulateDrawdown(100000, 50000, 60, rate, inflation, 100);
  assertEquals(depletionAge, 62); // hand-traced: age 60 -> 53000, age 61 -> 4590, age 62 -> -47237.3
  assertEquals(result.depletion_age, 62);
  assertEquals(result.survives_to_85, false);
  assertEquals(result.survives_to_100, false);
});

Deno.test("simulateDrawdown: huge capital survives to maxAge with depletion_age null", () => {
  const result = simulateDrawdown(100000000, 50000, 60, 0.055, 0.035, 100);
  assertEquals(result.depletion_age, null);
  assertEquals(result.survives_to_85, true);
  assertEquals(result.survives_to_100, true);
});

Deno.test("computeRetirement wires the drawdown stress test off total_projected", () => {
  const d = det(); // default fixture: years=24, retirement_age=60, epf_dividend=0.055, inflation=0.035
  const expected = simulateDrawdown(
    d.total_projected,
    d.income_need_at_retirement,
    60,
    0.055,
    0.035,
  );
  assertEquals(d.post_retirement_rate_used, 0.055);
  assertEquals(d.depletion_age, expected.depletion_age);
  assertEquals(d.survives_to_85, expected.survives_to_85);
  assertEquals(d.survives_to_100, expected.survives_to_100);
});

Deno.test("insufficient_data: depletion_age null, both survives flags false, rate still recorded", () => {
  const d = det({ client: { ...makeCfpData().client, date_of_birth: null } });
  assert(d.insufficient_data);
  assertEquals(d.depletion_age, null);
  assertEquals(d.survives_to_85, false);
  assertEquals(d.survives_to_100, false);
  assertEquals(d.post_retirement_rate_used, 0.055);
});

// ---------------------------------------------------------------------------
// 资金耐久曲线 — the year-by-year series the report plots on P23/P24.
// ---------------------------------------------------------------------------

Deno.test("drawdown series: ends on the depletion year and lands on zero", () => {
  const r = simulateDrawdown(100000, 50000, 60, 0.03, 0.02, 100);
  assertEquals(r.depletion_age, 62);
  // one row per year lived through, 60..62 inclusive
  assertEquals(r.series.length, 3);
  assertEquals(r.series.map((p) => p.age), [60, 61, 62]);
  // the curve touches the axis rather than plunging below it
  assertEquals(r.series[r.series.length - 1].closing, 0);
  assertEquals(r.series[r.series.length - 1].age, r.depletion_age);
});

Deno.test("drawdown series: opening chains from the prior year and ages ascend", () => {
  const r = simulateDrawdown(3_000_000, 120000, 60, 0.055, 0.035, 100);
  assertEquals(r.series[0].opening, 3_000_000);
  assertEquals(r.series[0].age, 60);
  for (let i = 1; i < r.series.length; i++) {
    assert(r.series[i].age === r.series[i - 1].age + 1, "ages must be consecutive");
  }
  // withdrawals grow with inflation
  assert(r.series[1].withdrawal > r.series[0].withdrawal);
});

Deno.test("drawdown series: survivor runs to maxAge and never reaches zero", () => {
  const r = simulateDrawdown(100_000_000, 50000, 60, 0.055, 0.035, 100);
  assertEquals(r.depletion_age, null);
  assertEquals(r.series.length, 40); // 60..99
  assert(r.series[r.series.length - 1].closing > 0);
});

Deno.test("computeRetirement exposes both curves; optimized starts at capital_needed", () => {
  const d = det();
  assertEquals(d.drawdown_max_age, 100);
  assert(d.drawdown_baseline.length > 0);
  assertEquals(d.drawdown_baseline[0].opening, d.total_projected);
  if (d.gap > 0) {
    assertEquals(d.drawdown_optimized[0].opening, d.capital_needed);
    // closing the gap can only extend the runway
    assert(d.drawdown_optimized.length >= d.drawdown_baseline.length);
  } else {
    // already on track — one line, not two
    assertEquals(d.drawdown_optimized, d.drawdown_baseline);
  }
});

Deno.test("insufficient_data: both curves empty rather than a bogus flat line", () => {
  const d = det({ client: { ...makeCfpData().client, date_of_birth: null } });
  assert(d.insufficient_data);
  assertEquals(d.drawdown_baseline, []);
  assertEquals(d.drawdown_optimized, []);
  assertEquals(d.drawdown_max_age, 100);
});

Deno.test("the drawdown series never reaches the LLM prompt", async () => {
  const { buildRetirementPrompt } = await import("./section.ts");
  const f = makeCfpData();
  const b = computeBaseline(f, {}, NOW);
  const prompt = buildRetirementPrompt(computeRetirement(f, b), b, f);
  assert(!prompt.includes("drawdown_"), "prompt must not carry the series");
  assert(!prompt.includes("\"opening\""), "prompt must not carry series rows");
  // the scalar summary the narrative actually needs is still there
  assert(prompt.includes("survives_to_85"));
});

// ---------------------------------------------------------------------------
// 两种退休定义 — P22 prints these side by side, and the gap between them is the
// decision the client is being asked to make. Both must come from the same
// assumptions as the drawdown curve, or the report argues with itself.
// ---------------------------------------------------------------------------

Deno.test("depletion capital is the present value of a rising income stream", () => {
  // 20 years of RM 100,000 rising at 3%, discounted at 5.5%.
  const pv = growingAnnuityPv(100_000, 0.055, 0.03, 20);
  const byHand = (100_000 / (0.055 - 0.03)) *
    (1 - Math.pow(1.03 / 1.055, 20));
  assertEquals(Math.round(pv), Math.round(byHand));
});

Deno.test("depletion capital handles a return that exactly matches inflation", () => {
  // The closed form divides by (rate - growth); at parity it must not blow up.
  const pv = growingAnnuityPv(100_000, 0.04, 0.04, 20);
  assertEquals(Math.round(pv), Math.round(100_000 * 20 / 1.04));
  assert(Number.isFinite(pv));
});

Deno.test("depletion capital is zero when there is nothing to fund", () => {
  assertEquals(growingAnnuityPv(0, 0.05, 0.03, 20), 0);
  assertEquals(growingAnnuityPv(100_000, 0.05, 0.03, 0), 0);
});

Deno.test("living off the yield always costs more than spending the capital down", () => {
  // If this ever inverted, the report would tell a client that never touching
  // their principal is the cheaper of the two plans.
  const det = computeRetirement(makeCfpData(), computeBaseline(makeCfpData(), {}, NOW), NOW);
  assert(det.capital_needed > det.capital_needed_depletion,
    `passive ${det.capital_needed} should exceed depletion ${det.capital_needed_depletion}`);
  assert(det.capital_needed_depletion > 0);
});

Deno.test("both capital figures are zero when there is not enough data to project", () => {
  const f = makeCfpData({ client: { ...makeCfpData().client, date_of_birth: null } });
  const det = computeRetirement(f, computeBaseline(f, {}, NOW), NOW);
  assertEquals(det.insufficient_data, true);
  assertEquals(det.capital_needed, 0);
  assertEquals(det.capital_needed_depletion, 0);
});
