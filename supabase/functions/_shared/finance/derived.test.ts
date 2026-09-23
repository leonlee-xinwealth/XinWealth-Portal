import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  deriveLoanItems,
  derivePremiumItems,
  isSuperseded,
  planCashflow,
  premiumCategoryOf,
  type LiabilityRow,
  type PolicyRow,
} from "./derived.ts";
import type { PeriodRow } from "../cashflow/periods.ts";

const TODAY = new Date("2026-06-01T00:00:00Z");

// ---------------------------------------------------------------------------
// premiumCategoryOf — every policy_type mapping.
// ---------------------------------------------------------------------------

Deno.test("premiumCategoryOf maps every policy_type per spec 决策 3", () => {
  assertEquals(premiumCategoryOf("life"), "life_takaful");
  assertEquals(premiumCategoryOf("investment_linked"), "savings_plan_premium");
  assertEquals(premiumCategoryOf("medical"), "medical_card");
  assertEquals(premiumCategoryOf("critical_illness"), "critical_illness");
  assertEquals(premiumCategoryOf("accident"), "personal_accident");
  assertEquals(premiumCategoryOf("property"), "home_insurance");
  assertEquals(premiumCategoryOf("disability"), "protection_other");
  assertEquals(premiumCategoryOf("other"), "protection_other");
  assertEquals(premiumCategoryOf("totally_unknown"), "protection_other");
});

// ---------------------------------------------------------------------------
// derivePremiumItems: single_premium → 0 → skip; expired → skip.
// ---------------------------------------------------------------------------

Deno.test("derivePremiumItems skips single_premium (annualises to 0)", () => {
  const items = derivePremiumItems(
    [{ policy_type: "life", premium: 50000, premium_frequency: "single_premium" }],
    TODAY,
  );
  assertEquals(items.length, 0);
});

Deno.test("derivePremiumItems skips a policy whose end_date has passed", () => {
  const items = derivePremiumItems(
    [{ policy_type: "medical", premium: 100, premium_frequency: "monthly", end_date: "2026-01-01" }],
    TODAY,
  );
  assertEquals(items.length, 0);
});

Deno.test("derivePremiumItems keeps a policy ending in the future", () => {
  const items = derivePremiumItems(
    [{ policy_type: "medical", premium: 100, premium_frequency: "monthly", end_date: "2030-01-01" }],
    TODAY,
  );
  assertEquals(items.length, 1);
  assertAlmostEquals(items[0].monthly_amount, 100, 0.01);
  assertEquals(items[0].category, "medical_card");
});

Deno.test("derivePremiumItems annualises quarterly/semi_annual/annual correctly", () => {
  const [q] = derivePremiumItems([{ policy_type: "life", premium: 300, premium_frequency: "quarterly" }], TODAY);
  assertAlmostEquals(q.monthly_amount, 100, 0.01); // 300*4/12

  const [s] = derivePremiumItems([{ policy_type: "life", premium: 600, premium_frequency: "semi_annual" }], TODAY);
  assertAlmostEquals(s.monthly_amount, 100, 0.01); // 600*2/12

  const [a] = derivePremiumItems([{ policy_type: "life", premium: 1200, premium_frequency: "annual" }], TODAY);
  assertAlmostEquals(a.monthly_amount, 100, 0.01); // 1200*1/12
});

// ---------------------------------------------------------------------------
// deriveLoanItems: category overrides + policy_loan produces nothing.
// ---------------------------------------------------------------------------

Deno.test("deriveLoanItems: policy_loan produces no item", () => {
  const items = deriveLoanItems([{ liability_type: "policy_loan", outstanding_balance: 20000 }], TODAY);
  assertEquals(items.length, 0);
});

Deno.test("deriveLoanItems: credit card records interest only under finance_charges", () => {
  const [item] = deriveLoanItems([{ liability_type: "credit_card", outstanding_balance: 5000 }], TODAY);
  assertEquals(item.category, "finance_charges");
  assertAlmostEquals(item.monthly_amount, item.interest_monthly, 0.01);
  assert(item.monthly_amount < 250); // less than the full minimum payment (5% of 5000)
});

Deno.test("deriveLoanItems: overdraft records interest only under its own category", () => {
  const [item] = deriveLoanItems([{ liability_type: "overdraft", outstanding_balance: 20000 }], TODAY);
  assertEquals(item.category, "finance_charges");
  assertAlmostEquals(item.monthly_amount, item.interest_monthly, 0.01);
});

Deno.test("deriveLoanItems: mortgage records the FULL installment (not just interest)", () => {
  const [item] = deriveLoanItems(
    [{ liability_type: "mortgage", outstanding_balance: 300000, interest_rate: 4.2, remaining_months: 300 }],
    TODAY,
  );
  assertEquals(item.category, "mortgage_installment");
  // Each field is independently rounded to 2dp, so allow a cent or two of slack.
  assertAlmostEquals(item.monthly_amount, item.principal_monthly + item.interest_monthly, 0.02);
});

// ---------------------------------------------------------------------------
// Dedupe shapes (决策 4) — 甲/NG/丙.
// ---------------------------------------------------------------------------

Deno.test("dedupe (甲 shape): manual car_installment is superseded by a matching car_loan", () => {
  const row: PeriodRow = { direction: "outflow", amount: 1200, frequency: "monthly", period_month: "2026-06-01", category: "car_installment" };
  const liabilities: LiabilityRow[] = [{ liability_type: "car_loan", outstanding_balance: 10000 }];
  assert(isSuperseded(row, liabilities, []));
});

Deno.test("dedupe (NG shape): manual debt_other is superseded by ANY liability that produces an installment", () => {
  const row: PeriodRow = { direction: "outflow", amount: 600, frequency: "monthly", period_month: "2026-06-01", category: "debt_other" };
  const liabilities: LiabilityRow[] = [
    { liability_type: "mortgage", outstanding_balance: 200000 },
    { liability_type: "study_loan", outstanding_balance: 15000 },
  ];
  assert(isSuperseded(row, liabilities, []));
});

Deno.test("dedupe (丙 shape): manual bnpl_payment is kept when no matching liability exists", () => {
  const row: PeriodRow = { direction: "outflow", amount: 390, frequency: "monthly", period_month: "2026-06-01", category: "bnpl_payment" };
  const liabilities: LiabilityRow[] = [
    { liability_type: "mortgage", outstanding_balance: 200000 },
    { liability_type: "study_loan", outstanding_balance: 15000 },
  ];
  assert(!isSuperseded(row, liabilities, []));
});

Deno.test("dedupe: O3 protection_other superseded by any policy; specific category by a matching one", () => {
  const genericRow: PeriodRow = { direction: "outflow", amount: 200, frequency: "monthly", period_month: "2026-06-01", category: "protection_other" };
  const specificRow: PeriodRow = { direction: "outflow", amount: 300, frequency: "monthly", period_month: "2026-06-01", category: "life_takaful" };
  const unmatchedRow: PeriodRow = { direction: "outflow", amount: 150, frequency: "monthly", period_month: "2026-06-01", category: "medical_card" };
  const policies: PolicyRow[] = [{ policy_type: "life", premium: 1200, premium_frequency: "annual" }];

  assert(isSuperseded(genericRow, [], policies));
  assert(isSuperseded(specificRow, [], policies));
  assert(!isSuperseded(unmatchedRow, [], policies));
});

Deno.test("dedupe: non-O2/O3 categories are never superseded", () => {
  const row: PeriodRow = { direction: "outflow", amount: 500, frequency: "monthly", period_month: "2026-06-01", category: "groceries" };
  assert(!isSuperseded(row, [{ liability_type: "mortgage", outstanding_balance: 1 }], [{ policy_type: "life" }]));
});

// ---------------------------------------------------------------------------
// planCashflow: totals = retained manual rows + derived × 12.
// ---------------------------------------------------------------------------

Deno.test("planCashflow: superseded row is excluded from totals; derived item is included", () => {
  const rows: PeriodRow[] = [
    { direction: "outflow", amount: 1200, frequency: "monthly", period_month: "2026-06-01", category: "car_installment" },
    { direction: "outflow", amount: 300, frequency: "monthly", period_month: "2026-06-01", category: "groceries" },
  ];
  const liabilities: LiabilityRow[] = [
    { liability_type: "car_loan", outstanding_balance: 10000, interest_rate: 3, monthly_payment: 420, rate_type: "flat" },
  ];
  const result = planCashflow({ rows, liabilities, policies: [], basis: { year: 2026, from_month: 6, to_month: 6 }, today: TODAY });

  assertEquals(result.superseded.length, 1);
  assertEquals(result.superseded[0].category, "car_installment");
  // manual groceries (300) + derived car installment (420), NOT the manual 1200.
  assertAlmostEquals(result.totals.monthly_expenses, 720, 0.01);
  assertEquals(result.derived.length, 1);
  assertAlmostEquals(result.monthly_debt_service, 420, 0.01);
});

// ---------------------------------------------------------------------------
// The paper-drill client 乙: two loan installments and an ILP premium, none
// of which were in her manually-keyed cash flow, turn a reported surplus into
// the real deficit (spec 为什么 section).
// ---------------------------------------------------------------------------

Deno.test("乙: salary 2,577 minus manual 1,548 minus derived installments/premium ≈ -1,224.33", () => {
  const rows: PeriodRow[] = [
    { direction: "inflow", amount: 2577, frequency: "monthly", period_month: "2026-06-01", category: "salary_basic" },
    { direction: "outflow", amount: 1548, frequency: "monthly", period_month: "2026-06-01", category: "groceries" },
  ];
  const liabilities: LiabilityRow[] = [
    { liability_type: "car_loan", outstanding_balance: 10000, interest_rate: 3, monthly_payment: 420, rate_type: "flat" },
    { liability_type: "personal_loan", outstanding_balance: 130000, interest_rate: 12, monthly_payment: 1000 },
  ];
  const policies: PolicyRow[] = [
    { policy_type: "investment_linked", premium: 10000, premium_frequency: "annual" },
  ];

  const result = planCashflow({
    rows,
    liabilities,
    policies,
    basis: { year: 2026, from_month: 6, to_month: 6 },
    today: TODAY,
  });

  const surplus = result.totals.monthly_income - result.totals.monthly_expenses;
  assertAlmostEquals(surplus, -1224.33, 0.01);

  // The personal_loan must carry the "payment doesn't cover interest" warning.
  const personalLoanItem = result.derived.find((d) => d.category === "personal_loan_installment");
  assert(personalLoanItem);
  assert(personalLoanItem!.warnings.includes("月供不足以支付当期利息，余额或利率可能有误"));

  // monthly_debt_service = 420 + 1000 (policy_loan excluded — there is none here).
  assertAlmostEquals(result.monthly_debt_service, 1420, 0.01);
  assertAlmostEquals(result.monthly_premiums, 833.33, 0.01);
});
