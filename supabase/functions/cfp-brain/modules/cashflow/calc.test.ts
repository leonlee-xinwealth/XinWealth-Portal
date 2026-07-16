import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeCashflow } from "./calc.ts";
import { computeBaseline } from "../../baseline.ts";
import { makeCfpData } from "../../baseline.test.ts";

const NOW = new Date("2026-07-16T00:00:00Z");

function det(overrides = {}) {
  const f = makeCfpData(overrides);
  return computeCashflow(f, computeBaseline(f, {}, NOW));
}

Deno.test("cashflow totals and breakdowns mirror the baseline", () => {
  const d = det();
  assertEquals(d.monthly_income, 11000); // 10k monthly + 12k annual
  assertEquals(d.monthly_expenses, 6000);
  assertEquals(d.monthly_surplus, 5000);
  assertEquals(d.savings_ratio, Number((60000 / 132000).toFixed(4)));
  assertEquals(d.income_breakdown.length, 2); // salary + bonus
  assertEquals(d.income_breakdown[0].category, "salary");
  assertEquals(d.income_breakdown[0].monthly_amount, 10000);
  assertEquals(d.expense_breakdown[0].share, 1);
});

Deno.test("emergency fund verdict: partial when between 3 and 6 months", () => {
  const d = det(); // 50k actual vs 18k low / 36k high → sufficient
  assertEquals(d.emergency_fund.status, "sufficient");
  assertEquals(d.emergency_fund.shortfall, 0);
  assertEquals(d.emergency_fund.months_covered, 8.3);

  const partial = det({
    assets: [{ asset_type: "savings", current_value: 20000, cost_value: null, ownership_type: null }],
  });
  assertEquals(partial.emergency_fund.status, "partial");
  assertEquals(partial.emergency_fund.shortfall, 16000);

  const insufficient = det({
    assets: [{ asset_type: "savings", current_value: 5000, cost_value: null, ownership_type: null }],
  });
  assertEquals(insufficient.emergency_fund.status, "insufficient");
});

Deno.test("no recurring income flags insufficient_data without throwing", () => {
  const d = det({ cashflow: [] });
  assert(d.insufficient_data);
  assertEquals(d.monthly_income, 0);
  assertEquals(d.emergency_fund.months_covered, null);
});
