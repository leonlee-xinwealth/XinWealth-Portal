import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeBaseline } from "./baseline.ts";
import type { CfpData } from "./types.ts";

export function makeCfpData(overrides: Partial<CfpData> = {}): CfpData {
  return {
    client: {
      id: "c-1",
      date_of_birth: "1990-01-01",
      marital_status: "married",
      number_of_dependants: 2,
      employment_status: "employed",
      occupation: "Engineer",
      tax_residency: "resident",
      risk_profile: "growth",
      retirement_age: 60,
      has_epf_account: true,
      has_prs_account: false,
    },
    cashflow: [
      { direction: "inflow", amount: 10000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
      { direction: "inflow", amount: 12000, frequency: "annual", category: "bonus", period_month: "2026-06-01" },
      { direction: "outflow", amount: 6000, frequency: "monthly", category: "household", period_month: "2026-06-01" },
    ],
    assets: [
      { asset_type: "savings", current_value: 30000, cost_value: null, ownership_type: null },
      { asset_type: "fixed_deposit", current_value: 20000, cost_value: null, ownership_type: null },
      { asset_type: "property", current_value: 500000, cost_value: null, ownership_type: null },
      { asset_type: "epf_account_1", current_value: 100000, cost_value: null, ownership_type: null },
    ],
    liabilities: [
      {
        liability_type: "mortgage",
        outstanding_balance: 300000,
        interest_rate: 0.04,
        monthly_payment: 1500,
        end_date: null,
      },
    ],
    policies: [],
    investment_accounts: [],
    holdings: [],
    goals: [],
    ...overrides,
  };
}

const NOW = new Date("2026-07-16T00:00:00Z");

Deno.test("annualizes mixed-frequency income and expenses", () => {
  const b = computeBaseline(makeCfpData(), {}, NOW);
  assertEquals(b.annual_income, 10000 * 12 + 12000); // 132,000
  assertEquals(b.annual_expenses, 72000);
  assertEquals(b.annual_surplus, 60000);
  assertEquals(b.monthly_essential_expenses, 6000);
});

Deno.test("emergency fund reserves 6 months before insurance deducts liquid assets", () => {
  const b = computeBaseline(makeCfpData(), {}, NOW);
  assertEquals(b.emergency_fund_need_low, 18000);
  assertEquals(b.emergency_fund_need_high, 36000);
  assertEquals(b.emergency_fund_actual, 50000); // savings + FD
  assertEquals(b.liquid_assets_total, 50000);
  assertEquals(b.liquid_assets_after_emergency, 14000); // 50k − 36k
});

Deno.test("after-emergency liquid assets floor at zero", () => {
  const b = computeBaseline(
    makeCfpData({
      assets: [{ asset_type: "savings", current_value: 10000, cost_value: null, ownership_type: null }],
    }),
    {},
    NOW,
  );
  assertEquals(b.liquid_assets_after_emergency, 0);
});

Deno.test("ratios, net worth and demographics", () => {
  const b = computeBaseline(makeCfpData(), {}, NOW);
  assertEquals(b.total_assets, 650000);
  assertEquals(b.total_liabilities, 300000);
  assertEquals(b.net_worth, 350000);
  assertEquals(b.debt_service_ratio, 0.1364); // 1500 / 11000
  assertEquals(b.savings_ratio, Number((60000 / 132000).toFixed(4)));
  assertEquals(b.age, 36);
  assertEquals(b.years_to_retirement, 24);
});

Deno.test("risk band resolves client_investment_return; overrides win", () => {
  const b = computeBaseline(makeCfpData(), {}, NOW);
  assertEquals(b.assumptions.client_investment_return, 0.075); // growth
  const b2 = computeBaseline(
    makeCfpData({ client: { ...makeCfpData().client, risk_profile: null } }),
    {},
    NOW,
  );
  assertEquals(b2.assumptions.client_investment_return, 0.06); // default balanced
  const b3 = computeBaseline(
    makeCfpData(),
    { assumption_overrides: { client_investment_return: 0.05, inflation: 0.03 } },
    NOW,
  );
  assertEquals(b3.assumptions.client_investment_return, 0.05);
  assertEquals(b3.assumptions.inflation, 0.03);
});

Deno.test("client with no data produces zeros and null ratios, never throws", () => {
  const empty = makeCfpData({
    cashflow: [],
    assets: [],
    liabilities: [],
    client: { ...makeCfpData().client, date_of_birth: null, retirement_age: null },
  });
  const b = computeBaseline(empty, {}, NOW);
  assertEquals(b.annual_income, 0);
  assertEquals(b.debt_service_ratio, null);
  assertEquals(b.savings_ratio, null);
  assertEquals(b.solvency_ratio, null);
  assertEquals(b.age, null);
  assertEquals(b.years_to_retirement, null);
  assertEquals(b.retirement_age, 60);
  assert(b.baseline_notes.some((n) => n.includes("退休年龄")));
  assert(b.baseline_notes.some((n) => n.includes("经常性收入")));
});

Deno.test("holdings count toward total assets", () => {
  const b = computeBaseline(
    makeCfpData({
      holdings: [{ snapshot_month: "2026-07-01", instrument_code: "F1", market_value: 25000, cost_basis: 20000 }],
    }),
    {},
    NOW,
  );
  assertEquals(b.total_assets, 675000);
});

Deno.test("asset transfers are excluded from income and expenses (小会计口径)", () => {
  const b = computeBaseline(
    makeCfpData({
      cashflow: [
        { direction: "inflow", amount: 10000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
        { direction: "outflow", amount: 6000, frequency: "monthly", category: "household", period_month: "2026-06-01" },
        // transfer into own investment account — savings, not spending
        { direction: "outflow", amount: 2000, frequency: "monthly", category: "invest", linked_asset_id: "a-1", period_month: "2026-06-01" },
        // transfer from FD back to checking — not income
        { direction: "inflow", amount: 5000, frequency: "monthly", category: "fd_out", linked_asset_id: "a-2", period_month: "2026-06-01" },
        // loan repayment stays a true expense
        { direction: "outflow", amount: 1500, frequency: "monthly", category: "mortgage", linked_liability_id: "l-1", period_month: "2026-06-01" },
      ],
    }),
    {},
    NOW,
  );
  assertEquals(b.annual_income, 120000);
  assertEquals(b.annual_expenses, (6000 + 1500) * 12);
  assert(b.baseline_notes.some((n) => n.includes("资产转移")));
});

// ---------------------------------------------------------------------------
// 现金流基准 — which months of actuals the whole plan is annualised from.
//
// A row records ONE MONTH'S actual amount. Turning a set of months into an
// annual run-rate is the single assumption every ratio in the report rests on,
// so it is chosen explicitly and stated in the notes.
// ---------------------------------------------------------------------------

/** Lee Wei Qi as recorded: five expenses in June, one more added in July. */
const TWO_MONTHS = makeCfpData({
  cashflow: [
    { direction: "inflow", amount: 2577, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
    { direction: "outflow", amount: 580, frequency: "monthly", category: "personal", period_month: "2026-06-01" },
    { direction: "outflow", amount: 340, frequency: "monthly", category: "transportation", period_month: "2026-06-01" },
    { direction: "outflow", amount: 200, frequency: "monthly", category: "personal", period_month: "2026-06-01" },
    { direction: "outflow", amount: 200, frequency: "monthly", category: "miscellaneous", period_month: "2026-06-01" },
    { direction: "outflow", amount: 100, frequency: "monthly", category: "personal", period_month: "2026-06-01" },
    { direction: "outflow", amount: 128, frequency: "monthly", category: "household", period_month: "2026-07-01" },
  ],
});

Deno.test("no basis chosen: every recorded month of the latest year", () => {
  const b = computeBaseline(TWO_MONTHS, {}, NOW);
  assertEquals(b.cashflow_basis, { year: 2026, from_month: 6, to_month: 7 });
  // (1420 + 128) / 2 months
  assertEquals(b.monthly_essential_expenses, 774);
});

Deno.test("the advisor can narrow the basis to the month that is complete", () => {
  // June holds five expense rows and July one. No formula can tell a lean month
  // from a half-entered one, so this is a decision, not a calculation.
  const b = computeBaseline(TWO_MONTHS, {
    cashflow_basis: { year: 2026, from_month: 6, to_month: 6 },
  }, NOW);
  assertEquals(b.monthly_essential_expenses, 1420);
  assertEquals(b.annual_expenses, 17040);
  assertEquals(b.monthly_income, 2577);
});

Deno.test("the basis is stated in the notes, because every ratio rests on it", () => {
  const b = computeBaseline(TWO_MONTHS, {
    cashflow_basis: { year: 2026, from_month: 1, to_month: 12 },
  }, NOW);
  assert(b.baseline_notes.some((n) => n.includes("2026 年 1–12 月")), b.baseline_notes.join(" | "));
  // A twelve-month window holding two months of data is a gap in the record.
  // Saying so is the only honest option — dividing by twelve would report
  // RM 129 of monthly spending against a real RM 1,548 across two months.
  assert(
    b.baseline_notes.some((n) => n.includes("仅 2 个月有记录")),
    b.baseline_notes.join(" | "),
  );
  assertEquals(b.cashflow_basis_months, 12);
  assertEquals(b.cashflow_months_with_data, [6, 7]);
  assertEquals(b.monthly_essential_expenses, 774);
});

Deno.test("an annual bonus is counted once, not folded into the monthly average", () => {
  // Lim Wei Jian's RM 18,400 bonus sits in March with frequency 'annual'. It is
  // real 2026 income against a June–July basis, and averaging it into a month
  // then multiplying by twelve would invent RM 220,800.
  const f = makeCfpData({
    cashflow: [
      { direction: "inflow", amount: 18400, frequency: "annual", category: "bonus", period_month: "2026-03-01" },
      { direction: "inflow", amount: 6000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
      { direction: "inflow", amount: 4000, frequency: "monthly", category: "salary", period_month: "2026-07-01" },
    ],
  });
  const b = computeBaseline(f, { cashflow_basis: { year: 2026, from_month: 6, to_month: 7 } }, NOW);
  assertEquals(b.annual_income, 78400); // 5,000 avg x 12 + 18,400
});

Deno.test("a client with no cashflow at all says so rather than reporting zero silently", () => {
  const b = computeBaseline(makeCfpData({ cashflow: [] }), {}, NOW);
  assertEquals(b.cashflow_basis, null);
  assertEquals(b.annual_income, 0);
  assertEquals(b.annual_expenses, 0);
  assert(b.baseline_notes.some((n) => n.includes("未录得任何月份")), b.baseline_notes.join(" | "));
});
