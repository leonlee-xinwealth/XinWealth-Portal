import { assert, assertAlmostEquals, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
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
      has_epf: false,
    },
    items: [],
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
  // P2a: the fixture's mortgage (monthly_payment: 1500) is now auto-derived
  // into expenses (+18,000/yr) on top of the manual 72,000 of household spend.
  assertEquals(b.annual_expenses, 90000);
  assertEquals(b.annual_surplus, 42000);
  assertEquals(b.monthly_essential_expenses, 7500);
});

Deno.test("emergency fund reserves 6 months before insurance deducts liquid assets", () => {
  const b = computeBaseline(makeCfpData(), {}, NOW);
  // P2a: essential spend is now 7,500/mo (household 6,000 + derived mortgage
  // installment 1,500), so the 3x/6x needs move with it.
  assertEquals(b.emergency_fund_need_low, 22500);
  assertEquals(b.emergency_fund_need_high, 45000);
  assertEquals(b.emergency_fund_actual, 50000); // savings + FD
  assertEquals(b.liquid_assets_total, 50000);
  assertEquals(b.liquid_assets_after_emergency, 5000); // 50k − 45k
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
  assertEquals(b.debt_service_ratio, 0.1364); // 1500 / 11000 — unchanged: monthly_payment is literal, not estimated
  // P2a: annual_expenses is now 90,000 (the derived mortgage installment is
  // literally the same 1,500/mo already in the fixture, so debt_service_ratio
  // above is untouched, but savings_ratio moves with the new expense total.
  assertEquals(b.savings_ratio, Number((42000 / 132000).toFixed(4)));
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

// ---------------------------------------------------------------------------
// P3 决策 1 — `assets` is the single source of truth. A holding whose account
// has been folded into an asset (asset_id set) must not ALSO count here.
// ---------------------------------------------------------------------------

Deno.test("a holding with no matching account is legacy and still counts (today's behaviour, pre-migration)", () => {
  const b = computeBaseline(
    makeCfpData({
      investment_accounts: [],
      holdings: [{ account_id: "acct-1", snapshot_month: "2026-07-01", instrument_code: "F1", market_value: 25000, cost_basis: 20000 }],
    }),
    {},
    NOW,
  );
  assertEquals(b.total_assets, 675000);
});

Deno.test("a holding whose account has an asset_id is excluded — already folded into assets", () => {
  const b = computeBaseline(
    makeCfpData({
      investment_accounts: [
        { id: "acct-1", asset_id: "asset-1", account_type: "unit_trust", prs_sub_account_a: null, prs_sub_account_b: null },
      ],
      holdings: [{ account_id: "acct-1", snapshot_month: "2026-07-01", instrument_code: "F1", market_value: 25000, cost_basis: 20000 }],
    }),
    {},
    NOW,
  );
  // 650,000 base (see "ratios, net worth and demographics" above) unchanged —
  // the holding would have added 25,000 pre-P3.
  assertEquals(b.total_assets, 650000);
});

Deno.test("mixed: only the holding backed by a migrated account is excluded, the other (legacy) still counts", () => {
  const b = computeBaseline(
    makeCfpData({
      investment_accounts: [
        { id: "acct-1", asset_id: "asset-1", account_type: "unit_trust", prs_sub_account_a: null, prs_sub_account_b: null },
        { id: "acct-2", asset_id: null, account_type: "prs", prs_sub_account_a: null, prs_sub_account_b: null },
      ],
      holdings: [
        { account_id: "acct-1", snapshot_month: "2026-07-01", instrument_code: "F1", market_value: 25000, cost_basis: 20000 },
        { account_id: "acct-2", snapshot_month: "2026-07-01", instrument_code: "F2", market_value: 9000, cost_basis: 9000 },
      ],
    }),
    {},
    NOW,
  );
  assertEquals(b.total_assets, 659000); // 650,000 + 9,000 legacy; the 25,000 migrated one is dropped
});

Deno.test("asset_quality is computed additively — quadrant reflects an asset's linked item/liability + value history", () => {
  const b = computeBaseline(
    makeCfpData({
      assets: [
        { id: "house-1", asset_type: "property", current_value: 500000, cost_value: null, ownership_type: null },
      ],
      liabilities: [],
      items: [],
    }),
    {},
    NOW,
  );
  assert(b.asset_quality);
  assertEquals(b.asset_quality!.assets.length, 1);
  assertEquals(b.asset_quality!.assets[0].asset_id, "house-1");
  // class D (property), no linked items/liabilities and no valuation history:
  // withheld from a quadrant entirely rather than defaulting to "productive"
  // on a net cash flow of 0 (prod incident fix — assetQuality.ts 决策 3).
  assertEquals(b.asset_quality!.assets[0].quadrant, null);
  assertEquals(b.asset_quality!.assets[0].unlinked, true);
  assert(b.asset_quality!.assets[0].notes.includes("缺少估值历史"));
  assert(
    b.asset_quality!.assets[0].notes.includes(
      "自用资产通常有持有成本（贷款、保险、保养、税费），请先关联相关贷款或收支",
    ),
  );
  assertEquals(b.asset_quality!.by_quadrant.unlinked, { count: 1, value: 500000 });
});

Deno.test("asset transfers are excluded from income and expenses (小会计口径)", () => {
  const b = computeBaseline(
    makeCfpData({
      cashflow: [
        { direction: "inflow", amount: 10000, frequency: "monthly", category: "salary", period_month: "2026-06-01" },
        { direction: "outflow", amount: 6000, frequency: "monthly", category: "household", period_month: "2026-06-01" },
        // saving into a fund — a transfer by category, not spending
        { direction: "outflow", amount: 2000, frequency: "monthly", category: "unit_trust_contribution", period_month: "2026-06-01" },
        // drawing on an FD — a transfer by category, not income
        { direction: "inflow", amount: 5000, frequency: "monthly", category: "savings_withdrawal", period_month: "2026-06-01" },
        // the mortgage installment is 'split' and still counts as spending (P1)
        { direction: "outflow", amount: 1500, frequency: "monthly", category: "mortgage_installment", linked_liability_id: "l-1", period_month: "2026-06-01" },
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
  // (1420 + 128) / 2 months of manual spend, PLUS the fixture's derived
  // mortgage installment (1,500/mo), which isn't month-gated (P2a 决策 5).
  assertEquals(b.monthly_essential_expenses, 2274);
});

Deno.test("the advisor can narrow the basis to the month that is complete", () => {
  // June holds five expense rows and July one. No formula can tell a lean month
  // from a half-entered one, so this is a decision, not a calculation.
  const b = computeBaseline(TWO_MONTHS, {
    cashflow_basis: { year: 2026, from_month: 6, to_month: 6 },
  }, NOW);
  // P2a: 1,420 manual + 1,500 derived mortgage installment.
  assertEquals(b.monthly_essential_expenses, 2920);
  assertEquals(b.annual_expenses, 35040);
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
  // P2a: same 774 manual average, plus the fixture's derived mortgage
  // installment (1,500/mo, unconditional — see the two tests above).
  assertEquals(b.monthly_essential_expenses, 2274);
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
  // P2a: derived items aren't cashflow-basis-gated — the fixture's mortgage
  // still contributes its 1,500/mo installment even with zero cashflow rows.
  assertEquals(b.annual_expenses, 18000);
  assert(b.baseline_notes.some((n) => n.includes("未录得任何月份")), b.baseline_notes.join(" | "));
});

// ---------------------------------------------------------------------------
// P2a — installments and premiums derived from their source (liabilities /
// policies) feed the same income/expense totals every ratio above is built
// on (决策 1, 5). The paper-drill client 乙 (see _shared/finance/derived.test.ts
// for the exact rows and the -1,224.33/mo derivation): her manually-keyed
// cashflow alone looks nearly break-even, but two loan installments and an
// ILP premium she never re-keyed turn it into a real ~RM1,225/mo deficit.
// ---------------------------------------------------------------------------

Deno.test("P2a: 乙's derived installments/premium turn a reported near-breakeven cashflow into a real deficit", () => {
  const f = makeCfpData({
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
  const b = computeBaseline(f, {}, NOW);

  // -1,224.33/mo x 12 ≈ -14,691.96, rounded.
  assertAlmostEquals(b.annual_surplus, -14692, 1);
  assert(b.debt_service_ratio! > 0.5, `debt_service_ratio was ${b.debt_service_ratio}`);
  // The personal_loan's 1,000/mo payment doesn't even cover its own interest
  // at 12% on a 130,000 balance — the D1 estimator's warning must reach the
  // advisor verbatim.
  assert(
    b.baseline_notes.some((n) => n.includes("月供不足以支付当期利息")),
    b.baseline_notes.join(" | "),
  );
});

// ---------------------------------------------------------------------------
// P2b — standing items (决策 1) and statutory EPF/SOCSO/EIS (决策 6). NOW =
// 2026-07-16, so items are evaluated "as of" 2026-07.
// ---------------------------------------------------------------------------

Deno.test("P2b: a standing salary item switches cashflow_source to 'items' and derives statutory deductions", () => {
  const f = makeCfpData({
    client: { ...makeCfpData().client, has_epf: true },
    cashflow: [],
    liabilities: [],
    policies: [],
    items: [
      { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
    ],
  });
  const b = computeBaseline(f, {}, NOW);

  assertEquals(b.cashflow_source, "items");
  assertEquals(b.items_as_of, "2026-07-01");
  assertEquals(b.annual_income, 96000);

  // wage 8,000: employee 11% = 880 (transfer, never in expenses), employer
  // 12% (>5,000 threshold) = 960. SOCSO/EIS uses the official band-midpoint
  // formula (P2b followup): wage 8,000 caps at the top band's midpoint
  // 5,950 -> 0.005*5,950 + 0.002*5,950 = 41.65 (was a flat 0.7% of the
  // 6,000-capped wage = 42.00).
  assertEquals(b.monthly_employee_epf, 880);
  assertEquals(b.monthly_employer_epf, 960);
  assertAlmostEquals(b.monthly_socso_eis, 41.65, 0.01);
  // P2b followup: a salary of 8,000/mo also owes real income tax, now
  // estimated automatically on the items path (taxable 96,000, reliefs
  // personal 9,000 + EPF 4,000 (capped) -> chargeable 83,000 -> annual tax
  // 6,170 -> 514.17/mo), folded into annual_expenses alongside SOCSO/EIS.
  assertAlmostEquals(b.annual_expenses, (41.65 + 514.17) * 12, 0.5);

  // annual_disposable_surplus = annual_surplus − 12 × employee EPF.
  assertEquals(b.annual_disposable_surplus, b.annual_surplus - 880 * 12);

  // P2b followup — the take-home / net-cash-flow waterfall: baseline.ts must
  // copy planCashflow's own figures verbatim (no recomputation), so these
  // assert the WIRING (each field's documented relationship to the others),
  // not a hand-derived tax number — the tax/statutory math itself is pinned
  // in _shared/finance/{incomeTax,statutory}.test.ts.
  assertAlmostEquals(b.monthly_income_tax, 514.17, 0.5);
  assertEquals(b.monthly_statutory, b.monthly_employee_epf + b.monthly_socso_eis);
  assertAlmostEquals(b.monthly_take_home, b.monthly_income - b.monthly_statutory - b.monthly_income_tax, 0.01);
  // No manually-keyed living costs in this fixture (only the salary item) —
  // monthly_expenses is entirely the derived SOCSO/EIS + estimated tax, both
  // stripped back out, so living lands on exactly 0.
  assertAlmostEquals(b.monthly_living, 0, 0.5);
  assertAlmostEquals(b.monthly_savable, b.monthly_take_home - b.monthly_living, 0.01);
  assertEquals(b.monthly_planned_savings, 0); // no transfer items in this fixture
  assertAlmostEquals(b.monthly_net_cash_flow, b.monthly_savable - b.monthly_planned_savings, 0.01);

  assert(b.baseline_notes.some((n) => n.includes("常设项目") && n.includes("2026-07")), b.baseline_notes.join(" | "));
  assert(b.baseline_notes.some((n) => n.includes("按法定比例估算")), b.baseline_notes.join(" | "));
  assertEquals(b.one_off_items, []);
});

Deno.test("P2b: no items stays on the actuals path — cashflow_source, statutory fields and disposable surplus are all unaffected", () => {
  const b = computeBaseline(makeCfpData(), {}, NOW);
  assertEquals(b.cashflow_source, "actuals");
  assertEquals(b.items_as_of, null);
  assertEquals(b.monthly_employee_epf, 0);
  assertEquals(b.monthly_employer_epf, 0);
  assertEquals(b.monthly_socso_eis, 0);
  assertEquals(b.annual_disposable_surplus, b.annual_surplus);
  assertEquals(b.one_off_items, []);

  // P2b followup: the actuals path never estimates tax/statutory — this
  // fixture has no manual income_tax row, so take-home collapses to plain
  // income minus living costs.
  assertEquals(b.monthly_income_tax, 0);
  assertEquals(b.monthly_statutory, 0);
  assertEquals(b.monthly_take_home, b.monthly_income);
  assertEquals(b.monthly_living, b.monthly_essential_expenses);
  assertEquals(b.monthly_savable, b.monthly_take_home - b.monthly_living);
  assertEquals(b.monthly_planned_savings, 0);
  assertEquals(b.monthly_net_cash_flow, b.monthly_savable);
});

Deno.test("P2b followup: a non-resident client's estimated tax uses the flat 30% (tax_residency wired through from db.ts)", () => {
  const f = makeCfpData({
    client: { ...makeCfpData().client, has_epf: false, tax_residency: "non_resident" },
    cashflow: [],
    liabilities: [],
    policies: [],
    items: [
      { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
    ],
  });
  const b = computeBaseline(f, {}, NOW);

  // 96,000 taxable income * 30% flat rate, no reliefs/rebate — see
  // estimateIncomeTax in _shared/finance/incomeTax.ts.
  assertEquals(b.monthly_income_tax, 2400);
  assertEquals(b.monthly_statutory, 0); // has_epf is false: no EPF/SOCSO/EIS
  assertEquals(b.monthly_take_home, b.monthly_income - 2400);
  assertEquals(b.monthly_living, 0); // no living costs in this fixture besides the estimated tax
  assertEquals(b.monthly_savable, b.monthly_take_home);
  assertEquals(b.monthly_net_cash_flow, b.monthly_savable);
});

Deno.test("P2b: has_epf true but no active salary items derives no statutory deductions", () => {
  const f = makeCfpData({
    client: { ...makeCfpData().client, has_epf: true },
    cashflow: [],
    liabilities: [],
    policies: [],
    items: [
      { direction: "outflow", category: "groceries", amount: 500, frequency: "monthly", effective_from: "2026-01-01" },
    ],
  });
  const b = computeBaseline(f, {}, NOW);
  assertEquals(b.monthly_employee_epf, 0);
  assertEquals(b.monthly_employer_epf, 0);
  assertEquals(b.monthly_socso_eis, 0);
});
