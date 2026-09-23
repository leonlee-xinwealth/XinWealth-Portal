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
import type { StandingItem } from "../cashflow/items.ts";

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

// ---------------------------------------------------------------------------
// derivePremiumItems: P5 决策 3 — status filtering (paid_up carries cover but
// no premium; lapsed/surrendered/matured carry neither).
// ---------------------------------------------------------------------------

Deno.test("derivePremiumItems: an unset status behaves exactly like in_force (pre-P5 rows)", () => {
  const items = derivePremiumItems(
    [{ policy_type: "life", premium: 100, premium_frequency: "monthly" }],
    TODAY,
  );
  assertEquals(items.length, 1);
});

Deno.test("derivePremiumItems: in_force keeps producing a premium item", () => {
  const items = derivePremiumItems(
    [{ policy_type: "life", premium: 100, premium_frequency: "monthly", status: "in_force" }],
    TODAY,
  );
  assertEquals(items.length, 1);
});

Deno.test("derivePremiumItems: paid_up is skipped — no further premium is owed", () => {
  const items = derivePremiumItems(
    [{ policy_type: "life", premium: 100, premium_frequency: "monthly", status: "paid_up" }],
    TODAY,
  );
  assertEquals(items.length, 0);
});

Deno.test("derivePremiumItems: lapsed/surrendered/matured are all skipped", () => {
  for (const status of ["lapsed", "surrendered", "matured"]) {
    const items = derivePremiumItems(
      [{ policy_type: "medical", premium: 100, premium_frequency: "monthly", status }],
      TODAY,
    );
    assertEquals(items.length, 0, `status=${status} must produce no premium item`);
  }
});

Deno.test("derivePremiumItems: a mixed book only derives items for the active policies", () => {
  const items = derivePremiumItems(
    [
      { policy_type: "life", premium: 100, premium_frequency: "monthly", status: "in_force" },
      { policy_type: "medical", premium: 200, premium_frequency: "monthly", status: "paid_up" },
      { policy_type: "critical_illness", premium: 50, premium_frequency: "monthly", status: "lapsed" },
    ],
    TODAY,
  );
  assertEquals(items.length, 1);
  assertEquals(items[0].category, "life_takaful");
});

Deno.test("isSuperseded (O3, P5 决策 3): a lapsed policy does not supersede a manual protection row — nothing derives its premium any more", () => {
  const row: PeriodRow = { direction: "outflow", amount: 100, frequency: "monthly", period_month: "2026-06-01", category: "life_takaful" };
  const lapsedOnly: PolicyRow[] = [{ policy_type: "life", premium: 100, premium_frequency: "monthly", status: "lapsed" }];
  assert(!isSuperseded(row, [], lapsedOnly));

  const genericRow: PeriodRow = { direction: "outflow", amount: 100, frequency: "monthly", period_month: "2026-06-01", category: "protection_other" };
  assert(!isSuperseded(genericRow, [], lapsedOnly));
});

Deno.test("isSuperseded (O3): an in_force policy among lapsed ones still supersedes its own category", () => {
  const row: PeriodRow = { direction: "outflow", amount: 100, frequency: "monthly", period_month: "2026-06-01", category: "life_takaful" };
  const mixed: PolicyRow[] = [
    { policy_type: "life", premium: 100, premium_frequency: "monthly", status: "in_force" },
    { policy_type: "medical", premium: 200, premium_frequency: "monthly", status: "lapsed" },
  ];
  assert(isSuperseded(row, [], mixed));
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

// ---------------------------------------------------------------------------
// planCashflow: two paths (P2b 决策 1) — actuals (unchanged) vs items.
// ---------------------------------------------------------------------------

Deno.test("planCashflow: no items (or an empty array) stays on the actuals path, P2b fields zeroed", () => {
  const rows: PeriodRow[] = [
    { direction: "inflow", amount: 2577, frequency: "monthly", period_month: "2026-06-01", category: "salary_basic" },
  ];
  const noItems = planCashflow({ rows, liabilities: [], policies: [], basis: { year: 2026, from_month: 6, to_month: 6 }, today: TODAY });
  const emptyItems = planCashflow({ rows, liabilities: [], policies: [], basis: { year: 2026, from_month: 6, to_month: 6 }, items: [], today: TODAY });

  for (const result of [noItems, emptyItems]) {
    assertEquals(result.source, "actuals");
    assertEquals(result.monthly_employee_epf, 0);
    assertEquals(result.monthly_employer_epf, 0);
    assertEquals(result.monthly_socso_eis, 0);
    assertEquals(result.one_off_items, []);
    assertEquals(result.totals.monthly_income, 2577);
  }
});

Deno.test("planCashflow: a non-empty `items` array switches to the items path", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
    { direction: "outflow", category: "groceries", amount: 1000, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  const result = planCashflow({ rows: [], liabilities: [], policies: [], basis: null, items, today: TODAY });
  assertEquals(result.source, "items");
  assertEquals(result.totals.monthly_income, 8000);
  assertEquals(result.totals.monthly_expenses, 1000);
});

Deno.test("planCashflow (items path) 决策 8: a manual car_installment item is superseded by a matching liability, same as an actuals row would be", () => {
  const items: StandingItem[] = [
    { id: "it1", direction: "outflow", category: "car_installment", amount: 1200, frequency: "monthly", effective_from: "2026-01-01" },
    { id: "it2", direction: "outflow", category: "groceries", amount: 300, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  const liabilities: LiabilityRow[] = [
    { liability_type: "car_loan", outstanding_balance: 10000, interest_rate: 3, monthly_payment: 420, rate_type: "flat" },
  ];
  const result = planCashflow({ rows: [], liabilities, policies: [], basis: null, items, today: TODAY });

  assertEquals(result.superseded.length, 1);
  assertEquals((result.superseded[0] as StandingItem).category, "car_installment");
  // manual groceries (300) + derived car installment (420), NOT the manual 1200.
  assertAlmostEquals(result.totals.monthly_expenses, 720, 0.01);
  assertEquals(result.derived.length, 1);
});

Deno.test("planCashflow (items path) 决策 6: EPF/SOCSO/EIS derived from standing salary items; employee EPF (a transfer) never touches monthly_expenses", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  const client = { has_epf: true, date_of_birth: null as string | null };
  const result = planCashflow({ rows: [], liabilities: [], policies: [], basis: null, items, client, today: TODAY });

  assertEquals(result.monthly_employee_epf, 880);
  assertEquals(result.monthly_employer_epf, 960);
  assertAlmostEquals(result.monthly_socso_eis, 42, 0.01);

  const epfDerived = result.derived.find((d) => d.category === "epf_employee");
  const socsoDerived = result.derived.find((d) => d.category === "socso_eis");
  assert(epfDerived, "epf_employee must appear in `derived` (it is still a cash-flow item)");
  assert(socsoDerived);
  assertEquals(epfDerived!.source_type, "statutory");

  // Only socso_eis (an expense) reaches monthly_expenses; epf_employee (O1,
  // a transfer) is excluded exactly like periods.ts excludes any transfer.
  assertAlmostEquals(result.totals.monthly_expenses, 42, 0.01);
});

Deno.test("planCashflow: no client (or has_epf not true) on the items path derives no statutory items", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  const result = planCashflow({ rows: [], liabilities: [], policies: [], basis: null, items, today: TODAY });
  assertEquals(result.monthly_employee_epf, 0);
  assertEquals(result.monthly_employer_epf, 0);
  assertEquals(result.monthly_socso_eis, 0);
  assertEquals(result.derived.find((d) => d.source_type === "statutory"), undefined);
});

// ---------------------------------------------------------------------------
// planCashflow `clients` (household 决策 6): SOCSO/EIS's wage ceiling and
// EPF's employer-rate threshold are PER EMPLOYEE — a joint plan must derive
// each spouse's statutory deductions from their OWN wage, never a pooled one.
// ---------------------------------------------------------------------------

Deno.test("planCashflow `clients`: two earners each get their own statutory calc, not a pooled one", () => {
  const items: StandingItem[] = [
    { client_id: "c-1", direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
    { client_id: "c-2", direction: "inflow", category: "salary_basic", amount: 4000, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  const clients = {
    "c-1": { has_epf: true, date_of_birth: null as string | null },
    "c-2": { has_epf: true, date_of_birth: null as string | null },
  };
  const result = planCashflow({ rows: [], liabilities: [], policies: [], basis: null, items, clients, today: TODAY });

  // c-1 alone: 8000 * 11% = 880 employee, 8000 > 5000 so 12% employer = 960,
  // SOCSO/EIS wage capped at 6000 -> 0.7% * 6000 = 42.
  // c-2 alone: 4000 * 11% = 440 employee, 4000 <= 5000 so 13% employer = 520,
  // SOCSO/EIS wage 4000 (under the cap) -> 0.7% * 4000 = 28.
  assertEquals(result.monthly_employee_epf, 880 + 440);
  assertEquals(result.monthly_employer_epf, 960 + 520);
  assertAlmostEquals(result.monthly_socso_eis, 42 + 28, 0.01);

  // Pooling both salaries into one 12,000 wage base would cap SOCSO/EIS at
  // 6,000 once (42 total) instead of twice (70) — the exact bug `clients`
  // exists to prevent.
  assert(result.monthly_socso_eis > 42, "must not be computed off a single pooled wage base");

  const statutoryItems = result.derived.filter((d) => d.source_type === "statutory");
  assertEquals(statutoryItems.length, 4); // epf_employee + socso_eis, per person
  // Keys are unique per person so a joint report's two epf_employee items
  // never collide.
  const keys = new Set(statutoryItems.map((d) => d.key));
  assertEquals(keys.size, 4);
  assert([...keys].some((k) => k.endsWith(":c-1")));
  assert([...keys].some((k) => k.endsWith(":c-2")));
});

Deno.test("planCashflow `clients`: absent falls back to the single-client `client` behaviour unchanged", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  const client = { has_epf: true, date_of_birth: null as string | null };
  const result = planCashflow({ rows: [], liabilities: [], policies: [], basis: null, items, client, today: TODAY });
  assertEquals(result.monthly_employee_epf, 880);
  assertEquals(result.monthly_employer_epf, 960);
});

Deno.test("planCashflow (items path): a one_off item outside the active-at-today window still surfaces, as long as it's within annualizeItems' ±11/+12-month window", () => {
  // TODAY = 2026-06-01. A one_off item 3 months ago (2026-03) and one 5
  // months ahead (2026-11) are both well inside annualizeItems' ±11/+12
  // surfacing window, but NEITHER is "active at today" (isActiveAt requires
  // effective_from ≤ month(today) ≤ effective_to, and a one_off's
  // effective_to === effective_from). Filtering by activeItems() before
  // scanning for one_off items (the bug this pins) would silently drop both.
  const items: StandingItem[] = [
    { direction: "outflow", category: "car_repair", amount: 2000, frequency: "one_off", effective_from: "2026-03-01", effective_to: "2026-03-01" },
    { direction: "outflow", category: "travel", amount: 3000, frequency: "one_off", effective_from: "2026-11-01", effective_to: "2026-11-01" },
  ];
  const result = planCashflow({ rows: [], liabilities: [], policies: [], basis: null, items, today: TODAY });

  assertEquals(result.one_off_items.length, 2);
  assertEquals(
    result.one_off_items.map((i) => i.effective_from).sort(),
    ["2026-03-01", "2026-11-01"],
  );
  // Neither one_off item is recurring, so totals stay untouched.
  assertEquals(result.totals.monthly_expenses, 0);
  assertEquals(result.totals.annual_expenses, 0);
});

Deno.test("planCashflow (items path): one_off items are surfaced; the actuals path always returns an empty list", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
    { direction: "outflow", category: "travel", amount: 5000, frequency: "one_off", effective_from: "2026-06-01", effective_to: "2026-06-01" },
  ];
  const itemsResult = planCashflow({ rows: [], liabilities: [], policies: [], basis: null, items, today: TODAY });
  assertEquals(itemsResult.one_off_items.length, 1);
  assertEquals(itemsResult.one_off_items[0].category, "travel");

  const actualsResult = planCashflow({ rows: [], liabilities: [], policies: [], basis: null, today: TODAY });
  assertEquals(actualsResult.one_off_items, []);
});
