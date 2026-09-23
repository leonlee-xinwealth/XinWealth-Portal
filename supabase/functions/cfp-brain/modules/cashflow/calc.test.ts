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
  // P2a: the fixture's mortgage (monthly_payment: 1500) is auto-derived into
  // expenses on top of the manual 6,000/mo household spend.
  assertEquals(d.monthly_expenses, 7500);
  assertEquals(d.monthly_surplus, 3500);
  assertEquals(d.savings_ratio, Number((42000 / 132000).toFixed(4)));
  assertEquals(d.income_breakdown.length, 2); // salary + bonus
  assertEquals(d.income_breakdown[0].category, "salary");
  assertEquals(d.income_breakdown[0].monthly_amount, 10000);
  // household (6,000) is now the larger of two categories, not the only one —
  // the derived mortgage_installment (1,500) takes the other 20%.
  assertEquals(d.expense_breakdown[0].share, 0.8);
});

Deno.test("emergency fund verdict: partial when between 3 and 6 months", () => {
  // P2a: essential spend is now 7,500/mo (6,000 manual + 1,500 derived
  // mortgage installment), so the 3x/6x thresholds are 22,500 / 45,000.
  const d = det(); // 50k actual vs 22.5k low / 45k high → sufficient
  assertEquals(d.emergency_fund.status, "sufficient");
  assertEquals(d.emergency_fund.shortfall, 0);
  assertEquals(d.emergency_fund.months_covered, 6.7);

  const partial = det({
    assets: [{ asset_type: "savings", current_value: 30000, cost_value: null, ownership_type: null }],
  });
  assertEquals(partial.emergency_fund.status, "partial");
  assertEquals(partial.emergency_fund.shortfall, 15000);

  const insufficient = det({
    assets: [{ asset_type: "savings", current_value: 5000, cost_value: null, ownership_type: null }],
  });
  assertEquals(insufficient.emergency_fund.status, "insufficient");
});

Deno.test("no recurring income flags insufficient_data without throwing", () => {
  const d = det({ cashflow: [] });
  assert(d.insufficient_data);
  assertEquals(d.monthly_income, 0);
  // P2a: the fixture's mortgage still derives its 1,500/mo installment even
  // with no cashflow rows at all — essential spend is never truly zero when a
  // liability with a payment exists (决策 5).
  assertEquals(d.emergency_fund.months_covered, 33.3);
});

Deno.test("asset transfers surface separately, never inside expense breakdown", () => {
  const d = det({
    cashflow: [
      { direction: "inflow", amount: 10000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
      { direction: "outflow", amount: 6000, frequency: "monthly", category: "household", period_month: "2026-06-01" },
      { direction: "outflow", amount: 2000, frequency: "monthly", category: "unit_trust_contribution", period_month: "2026-06-01" },
    ],
  });
  // P2a: + the fixture's derived mortgage installment (1,500/mo).
  assertEquals(d.monthly_expenses, 7500);
  assertEquals(d.asset_transfers_monthly, 2000);
  assertEquals(d.expense_breakdown.some((e) => e.category === "unit_trust_contribution"), false);
});

Deno.test("the expense breakdown adds up to the total even when months hold different items", () => {
  const d = det({
    cashflow: [
      { direction: "inflow", amount: 5000, frequency: "monthly", category: "salary_basic", period_month: "2026-06-01" },
      { direction: "outflow", amount: 1000, frequency: "monthly", category: "groceries", period_month: "2026-06-01" },
      { direction: "outflow", amount: 200, frequency: "monthly", category: "utilities", period_month: "2026-07-01" },
    ],
  });
  const sum = d.expense_breakdown.reduce((s, e) => s + e.monthly_amount, 0);
  assertEquals(sum, d.monthly_expenses);
  const shares = d.expense_breakdown.reduce((s, e) => s + (e.share ?? 0), 0);
  assert(shares <= 1.0001, `shares add to ${shares}`);
});

// ---------------------------------------------------------------------------
// P2a — the module's expense_breakdown merges derived installments/premiums
// in by category (决策 3), using the same monthly total as the denominator
// (baseline.test.ts pins the underlying totals for this same 乙 shape).
// ---------------------------------------------------------------------------

Deno.test("P2a: expense breakdown includes derived installments/premium; shares stay ≤ 100%", () => {
  const d = det({
    cashflow: [
      { direction: "inflow", amount: 2577, frequency: "monthly", category: "salary_basic", period_month: "2026-06-01" },
      { direction: "outflow", amount: 1548, frequency: "monthly", category: "groceries", period_month: "2026-06-01" },
    ],
    liabilities: [
      { liability_type: "car_loan", outstanding_balance: 10000, interest_rate: 3, monthly_payment: 420, rate_type: "flat", end_date: null },
      { liability_type: "personal_loan", outstanding_balance: 130000, interest_rate: 12, monthly_payment: 1000, end_date: null },
    ],
    policies: [
      { policy_type: "investment_linked", premium: 10000, premium_frequency: "annual" },
    ],
  });

  const categories = d.expense_breakdown.map((e) => e.category);
  assert(categories.includes("personal_loan_installment"), categories.join(", "));
  assert(categories.includes("savings_plan_premium"), categories.join(", "));

  const shares = d.expense_breakdown.reduce((s, e) => s + (e.share ?? 0), 0);
  assert(shares <= 1.0001, `shares add to ${shares}`);
});
