import { assertAlmostEquals, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeSnapshot, type SnapshotAsset, type SnapshotPolicy } from "./snapshot.ts";
import type { LiabilityRow } from "./derived.ts";
import type { StandingItem } from "../cashflow/items.ts";
import type { PeriodRow } from "../cashflow/periods.ts";

const ASOF = new Date("2026-06-01T00:00:00Z");

// ---------------------------------------------------------------------------
// net worth / totals — ownership_pct weighting (决策: assets counted at
// ownership_pct, default 100).
// ---------------------------------------------------------------------------

Deno.test("computeSnapshot: assets are weighted by ownership_pct (default 100 when absent)", () => {
  const assets: SnapshotAsset[] = [
    { id: "a1", asset_type: "savings", current_value: 10000 }, // no ownership_pct -> 100%
    { id: "a2", asset_type: "unit_trust", current_value: 20000, ownership_pct: 50 },
  ];
  const liabilities: LiabilityRow[] = [
    { id: "l1", liability_type: "mortgage", outstanding_balance: 100000, interest_rate: 4, monthly_payment: 2000 },
  ];
  const r = computeSnapshot({ assets, liabilities, policies: [], asOf: ASOF });

  assertEquals(r.total_assets, 10000 + 10000); // 10000 + 20000*0.5
  assertEquals(r.total_liabilities, 100000);
  assertEquals(r.net_worth, 20000 - 100000);
});

// ---------------------------------------------------------------------------
// basic_liquidity_ratio / emergency_fund_months — boundary at exactly 3
// months (the alerts.ts threshold is "< 3", so 3.0 itself must NOT read as
// short).
// ---------------------------------------------------------------------------

Deno.test("computeSnapshot: basic_liquidity_ratio / emergency_fund_months = liquid_assets / monthly_expenses", () => {
  const assets: SnapshotAsset[] = [{ id: "a1", asset_type: "savings", current_value: 6000 }];
  const items: StandingItem[] = [
    { direction: "outflow", category: "groceries", amount: 2000, frequency: "monthly", effective_from: "2026-01-01", effective_to: null },
  ];
  const r = computeSnapshot({ assets, liabilities: [], policies: [], items, asOf: ASOF });

  assertEquals(r.basic_liquidity_ratio, 3);
  assertEquals(r.emergency_fund_months, 3);
  assertEquals(r.basic_liquidity_ratio, r.emergency_fund_months);
});

Deno.test("computeSnapshot: basic_liquidity_ratio just under the 3-month line", () => {
  const assets: SnapshotAsset[] = [{ id: "a1", asset_type: "savings", current_value: 5999 }];
  const items: StandingItem[] = [
    { direction: "outflow", category: "groceries", amount: 2000, frequency: "monthly", effective_from: "2026-01-01", effective_to: null },
  ];
  const r = computeSnapshot({ assets, liabilities: [], policies: [], items, asOf: ASOF });
  assertAlmostEquals(r.basic_liquidity_ratio!, 2.9995, 0.0001);
});

Deno.test("computeSnapshot: basic_liquidity_ratio is null when there are no expenses", () => {
  const assets: SnapshotAsset[] = [{ id: "a1", asset_type: "savings", current_value: 5000 }];
  const r = computeSnapshot({ assets, liabilities: [], policies: [], asOf: ASOF });
  assertEquals(r.basic_liquidity_ratio, null);
  assertEquals(r.emergency_fund_months, null);
});

// ---------------------------------------------------------------------------
// debt_service_ratio / non_mortgage_dsr / savings_ratio — one fixture, three
// ratios: mortgage + car loan, single salary item.
// ---------------------------------------------------------------------------

Deno.test("computeSnapshot: debt_service_ratio, non_mortgage_dsr and savings_ratio", () => {
  const liabilities: LiabilityRow[] = [
    { id: "mtg", liability_type: "mortgage", outstanding_balance: 400000, interest_rate: 4, monthly_payment: 2000 },
    { id: "car", liability_type: "car_loan", outstanding_balance: 40000, interest_rate: 3, monthly_payment: 500 },
  ];
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 10000, frequency: "monthly", effective_from: "2026-01-01", effective_to: null },
  ];
  const r = computeSnapshot({ assets: [], liabilities, policies: [], items, asOf: ASOF });

  assertEquals(r.monthly_income, 10000);
  // monthly_debt_service = 2000 (mortgage) + 500 (car), both literal payments
  // — debt_service_ratio/non_mortgage_dsr are unaffected by the P2b followup
  // tax estimate below (they're built from monthly_debt_service directly).
  assertEquals(r.debt_service_ratio, 0.25); // 2500 / 10000
  assertEquals(r.non_mortgage_dsr, 0.05); // (2500 - 2000) / 10000
  // P2b followup: a salary of 10,000/mo owes real income tax, estimated
  // automatically on the items path regardless of has_epf/EPF status — this
  // now sits inside monthly_expenses alongside the debt service. Taxable
  // income 120,000, personal relief 9,000 (no EPF/policies here) -> chargeable
  // 111,000 -> progressiveTax(111,000) = 12,150/yr = 1,012.50/mo.
  assertEquals(r.savings_ratio, 0.6488); // (10000 - 2500 - 1012.5) / 10000
  assertEquals(r.monthly_surplus, 6488); // round0(10000 - 3512.5)
});

Deno.test("computeSnapshot: DSR-family ratios are null when there is no income", () => {
  const liabilities: LiabilityRow[] = [
    { id: "mtg", liability_type: "mortgage", outstanding_balance: 400000, interest_rate: 4, monthly_payment: 2000 },
  ];
  const r = computeSnapshot({ assets: [], liabilities, policies: [], asOf: ASOF });
  assertEquals(r.debt_service_ratio, null);
  assertEquals(r.non_mortgage_dsr, null);
  assertEquals(r.savings_ratio, null);
});

// ---------------------------------------------------------------------------
// solvency_ratio / liquid_asset_to_net_worth / invest_assets_to_net_worth —
// null exactly when net_worth (or total_assets) is non-positive.
// ---------------------------------------------------------------------------

Deno.test("computeSnapshot: solvency/liquid/invest ratios, and their null-on-non-positive-denominator guard", () => {
  const positive: SnapshotAsset[] = [
    { id: "a1", asset_type: "savings", current_value: 6000 },
    { id: "a2", asset_type: "unit_trust", current_value: 4000 },
  ];
  const r1 = computeSnapshot({ assets: positive, liabilities: [{ id: "l1", liability_type: "personal_loan", outstanding_balance: 2000 }], policies: [], asOf: ASOF });
  // total_assets=10000, total_liabilities=2000, net_worth=8000
  assertEquals(r1.solvency_ratio, 0.8); // 8000/10000
  assertEquals(r1.liquid_asset_to_net_worth, 0.75); // 6000/8000
  assertEquals(r1.invest_assets_to_net_worth, 0.5); // 4000/8000

  const negative: SnapshotAsset[] = [{ id: "a1", asset_type: "savings", current_value: 1000 }];
  const r2 = computeSnapshot({ assets: negative, liabilities: [{ id: "l1", liability_type: "personal_loan", outstanding_balance: 5000 }], policies: [], asOf: ASOF });
  // net_worth = 1000 - 5000 = -4000 <= 0
  assertEquals(r2.liquid_asset_to_net_worth, null);
  assertEquals(r2.invest_assets_to_net_worth, null);
  assertEquals(r2.solvency_ratio, -4); // total_assets (1000) > 0, so this one IS computed: -4000/1000
});

Deno.test("computeSnapshot: solvency_ratio is null when total_assets <= 0", () => {
  const r = computeSnapshot({ assets: [], liabilities: [{ id: "l1", liability_type: "personal_loan", outstanding_balance: 5000 }], policies: [], asOf: ASOF });
  assertEquals(r.solvency_ratio, null);
});

// ---------------------------------------------------------------------------
// life_insurance_coverage — active vs. expired policy.
// ---------------------------------------------------------------------------

Deno.test("computeSnapshot: life_insurance_coverage counts only active life/investment_linked policies", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 10000, frequency: "monthly", effective_from: "2026-01-01", effective_to: null },
  ];
  const policies: SnapshotPolicy[] = [
    { policy_type: "life", sum_assured: 600000, end_date: null },
    { policy_type: "life", sum_assured: 100000, end_date: "2020-01-01" }, // expired — excluded
    { policy_type: "medical", sum_assured: 999999, end_date: null }, // wrong type — excluded
  ];
  const r = computeSnapshot({ assets: [], liabilities: [], policies, items, asOf: ASOF });
  // annual_income = 10000*12 = 120000; active life sum assured = 600000
  assertEquals(r.life_insurance_coverage, 5);
});

// ---------------------------------------------------------------------------
// passive_income_coverage — items path and rows (actuals) fallback.
// ---------------------------------------------------------------------------

Deno.test("computeSnapshot: passive_income_coverage from standing items (I2 被动收入)", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "rental_income", amount: 1000, frequency: "monthly", effective_from: "2026-01-01", effective_to: null },
    { direction: "outflow", category: "utilities", amount: 2000, frequency: "monthly", effective_from: "2026-01-01", effective_to: null },
  ];
  const r = computeSnapshot({ assets: [], liabilities: [], policies: [], items, asOf: ASOF });
  assertEquals(r.passive_income_coverage, 0.5); // 1000 / 2000
});

Deno.test("computeSnapshot: passive_income_coverage falls back to cashflow_entries rows when there are no items", () => {
  const rows: PeriodRow[] = [
    { direction: "inflow", amount: 1000, frequency: "monthly", period_month: "2026-05-01", category: "rental_income" },
    { direction: "outflow", amount: 2000, frequency: "monthly", period_month: "2026-05-01", category: "utilities" },
  ];
  const r = computeSnapshot({ assets: [], liabilities: [], policies: [], rows, asOf: ASOF });
  assertEquals(r.passive_income_coverage, 0.5);
});

// ---------------------------------------------------------------------------
// raw_metrics carries the detail figures.
// ---------------------------------------------------------------------------

Deno.test("computeSnapshot: raw_metrics carries plan_source and the underlying totals", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 10000, frequency: "monthly", effective_from: "2026-01-01", effective_to: null },
  ];
  const r = computeSnapshot({ assets: [], liabilities: [], policies: [], items, asOf: ASOF });
  assertEquals(r.raw_metrics.plan_source, "items");
  assertEquals(typeof r.raw_metrics.liquid_assets_total, "number");
  assertEquals(Array.isArray((r.raw_metrics as { notes: string[] }).notes), true);
});
