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

// ---------------------------------------------------------------------------
// P2b 决策 1/6 — on the items path, the breakdown reads active,
// non-superseded standing items (+ derived, incl. statutory) instead of
// cashflow_entries actuals. epf_employee (a transfer) never reaches the
// expense breakdown but does count in asset_transfers_monthly; socso_eis (a
// real O9 expense) reaches the expense breakdown.
// ---------------------------------------------------------------------------

Deno.test("P2b: items-path breakdown comes from standing items + statutory; epf_employee excluded from expenses, socso_eis included", () => {
  const d = det({
    client: { ...makeCfpData().client, has_epf: true },
    cashflow: [],
    liabilities: [],
    policies: [],
    items: [
      { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
      { direction: "outflow", category: "groceries", amount: 1000, frequency: "monthly", effective_from: "2026-01-01" },
    ],
  });

  assertEquals(d.income_breakdown.find((c) => c.category === "salary_basic")?.monthly_amount, 8000);
  assertEquals(d.expense_breakdown.find((c) => c.category === "groceries")?.monthly_amount, 1000);
  // SOCSO/EIS (P2b followup band-midpoint formula: wage 8,000 caps at the
  // top band's midpoint 5,950 -> 41.65/mo) is a real expense.
  assertEquals(d.expense_breakdown.find((c) => c.category === "socso_eis")?.monthly_amount, 42); // round()'d in the breakdown
  // epf_employee (880/mo) is a transfer — never in the expense breakdown,
  // but it does count toward asset_transfers_monthly.
  assertEquals(d.expense_breakdown.find((c) => c.category === "epf_employee"), undefined);
  assertEquals(d.asset_transfers_monthly, 880);

  const shares2 = d.expense_breakdown.reduce((s, e) => s + (e.share ?? 0), 0);
  assert(shares2 <= 1.0001, `shares add to ${shares2}`);
});

Deno.test("P2b: computeCashflow surfaces one_off_items verbatim from the baseline", () => {
  const withOneOff = det({
    cashflow: [],
    liabilities: [],
    policies: [],
    items: [
      { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
      { direction: "outflow", category: "travel", amount: 5000, frequency: "one_off", effective_from: "2026-06-01", effective_to: "2026-06-01" },
    ],
  });
  assertEquals(withOneOff.one_off_items.length, 1);
  assertEquals(withOneOff.one_off_items[0].category, "travel");

  const actuals = det();
  assertEquals(actuals.one_off_items, []);
});

// ---------------------------------------------------------------------------
// Follow-up fix — the advisor renderer (CashflowRenderer.tsx) only ever sees
// this section's `content`, never `financial_reports.baseline` itself. These
// plan facts must therefore ride along on the section content, copied
// verbatim from the baseline (no recomputation), exactly like the PDF's
// pdf/cfpReport/select/cashflow.ts reads them straight off the baseline.
// ---------------------------------------------------------------------------

Deno.test("plan facts (cashflow_source, statutory EPF/SOCSO, disposable surplus, derived_items) are copied verbatim from the baseline — actuals path", () => {
  const f = makeCfpData();
  const b = computeBaseline(f, {}, NOW);
  const d = computeCashflow(f, b);

  assertEquals(d.cashflow_source, b.cashflow_source);
  assertEquals(d.cashflow_source, "actuals");
  assertEquals(d.items_as_of, b.items_as_of);
  assertEquals(d.items_as_of, null);
  assertEquals(d.monthly_employee_epf, b.monthly_employee_epf);
  assertEquals(d.monthly_employer_epf, b.monthly_employer_epf);
  assertEquals(d.monthly_socso_eis, b.monthly_socso_eis);
  assertEquals(d.annual_disposable_surplus, b.annual_disposable_surplus);
  assertEquals(d.monthly_principal, b.monthly_principal);
  assertEquals(d.derived_items, b.derived_items);
  // On the actuals path there's no statutory EPF, so disposable surplus
  // equals the plain annual surplus.
  assertEquals(d.annual_disposable_surplus, d.annual_surplus);
});

Deno.test("plan facts are copied verbatim from the baseline — items path with statutory EPF/SOCSO", () => {
  const f = makeCfpData({
    client: { ...makeCfpData().client, has_epf: true },
    cashflow: [],
    liabilities: [],
    policies: [],
    items: [
      { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
      { direction: "outflow", category: "groceries", amount: 1000, frequency: "monthly", effective_from: "2026-01-01" },
    ],
  });
  const b = computeBaseline(f, {}, NOW);
  const d = computeCashflow(f, b);

  assertEquals(d.cashflow_source, "items");
  assertEquals(d.items_as_of, b.items_as_of);
  assert(d.items_as_of !== null);
  // 8,000 wage: employee EPF 880/mo (11%), employer EPF ~910/mo (per the
  // statutory table), SOCSO/EIS 41.65/mo (P2b followup band-midpoint formula
  // — same figures baseline.test.ts pins).
  assertEquals(d.monthly_employee_epf, 880);
  assertEquals(d.monthly_employee_epf, b.monthly_employee_epf);
  assertEquals(d.monthly_employer_epf, b.monthly_employer_epf);
  assert(d.monthly_employer_epf > 0);
  assertEquals(d.monthly_socso_eis, 41.65);
  assertEquals(d.monthly_socso_eis, b.monthly_socso_eis);
  // Disposable surplus = annual surplus minus the forced-savings employee EPF.
  assertEquals(d.annual_disposable_surplus, b.annual_disposable_surplus);
  assertEquals(d.annual_disposable_surplus, d.annual_surplus - 12 * d.monthly_employee_epf);
  assertEquals(d.monthly_principal, b.monthly_principal);
  assertEquals(d.derived_items, b.derived_items);
  assert(d.derived_items.some((it) => it.category === "epf_employee"));
  assert(d.derived_items.some((it) => it.category === "socso_eis"));
});
