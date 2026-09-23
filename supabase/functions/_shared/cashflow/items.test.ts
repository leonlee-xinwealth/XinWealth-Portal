import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  activeItems,
  annualizeItems,
  annualizeItemsByCategory,
  endItem,
  isActiveAt,
  itemMonthlyAmount,
  itemsFromMonthRows,
  monthStart,
  reviseItem,
  type MonthRow,
  type StandingItem,
} from "./items.ts";
import { annualizeCashflow, defaultBasis, type PeriodRow } from "./periods.ts";

// ---------------------------------------------------------------------------
// monthStart — 决策 2
// ---------------------------------------------------------------------------

Deno.test("monthStart: a 'YYYY-MM-DD' string never shifts across timezones", () => {
  assertEquals(monthStart("2026-04-15"), "2026-04-01");
  assertEquals(monthStart("2026-04-01"), "2026-04-01");
  assertEquals(monthStart("2026-12-31"), "2026-12-01");
});

Deno.test("monthStart: a Date is read in UTC", () => {
  assertEquals(monthStart(new Date(Date.UTC(2026, 3, 15))), "2026-04-01");
  assertEquals(monthStart(new Date(Date.UTC(2026, 0, 1))), "2026-01-01");
});

// ---------------------------------------------------------------------------
// isActiveAt / activeItems — 决策 2
// ---------------------------------------------------------------------------

Deno.test("isActiveAt: from ≤ month(asOf) ≤ (to ?? ∞)", () => {
  const openEnded = { effective_from: "2026-04-01", effective_to: null };
  assert(!isActiveAt(openEnded, "2026-03-01"));
  assert(isActiveAt(openEnded, "2026-04-01"));
  assert(isActiveAt(openEnded, "2026-04-15"));
  assert(isActiveAt(openEnded, "2030-01-01"));

  const closed = { effective_from: "2026-04-01", effective_to: "2026-06-01" };
  assert(!isActiveAt(closed, "2026-03-01"));
  assert(isActiveAt(closed, "2026-04-01"));
  assert(isActiveAt(closed, "2026-06-01"));
  assert(!isActiveAt(closed, "2026-07-01"));
});

Deno.test("activeItems filters a mixed list down to what's in force", () => {
  const items = [
    { id: "a", effective_from: "2026-01-01", effective_to: "2026-03-01" },
    { id: "b", effective_from: "2026-04-01", effective_to: null },
  ];
  assertEquals(activeItems(items, "2026-04-01").map((i) => i.id), ["b"]);
  assertEquals(activeItems(items, "2026-02-01").map((i) => i.id), ["a"]);
});

// ---------------------------------------------------------------------------
// itemMonthlyAmount — 决策 4
// ---------------------------------------------------------------------------

Deno.test("itemMonthlyAmount: every ANNUAL_OCCURRENCES frequency", () => {
  assertAlmostEquals(itemMonthlyAmount({ amount: 1000, frequency: "weekly" }), (1000 * 52) / 12);
  assertAlmostEquals(itemMonthlyAmount({ amount: 1000, frequency: "monthly" }), 1000);
  assertAlmostEquals(itemMonthlyAmount({ amount: 1000, frequency: "quarterly" }), (1000 * 4) / 12);
  assertAlmostEquals(itemMonthlyAmount({ amount: 1200, frequency: "semi_annual" }), (1200 * 2) / 12);
  assertAlmostEquals(itemMonthlyAmount({ amount: 12000, frequency: "annual" }), 1000);
  assertEquals(itemMonthlyAmount({ amount: 5000, frequency: "one_off" }), 0);
});

Deno.test("itemMonthlyAmount: an unrecognised frequency falls back to 12/yr, same as periods.ts", () => {
  assertAlmostEquals(itemMonthlyAmount({ amount: 1000, frequency: "fortnightly" }), 1000);
});

// ---------------------------------------------------------------------------
// annualizeItems — 决策 4
// ---------------------------------------------------------------------------

const ASOF = "2026-06-01";

Deno.test("annualizeItems: a simple monthly salary and expense", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
    { direction: "outflow", category: "groceries", amount: 1000, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  const got = annualizeItems(items, ASOF);
  assertEquals(got.monthly_income, 8000);
  assertEquals(got.monthly_expenses, 1000);
  assertEquals(got.annual_income, 96000);
  assertEquals(got.annual_expenses, 12000);
  assertEquals(got.basis_months, 12);
  assertEquals(got.months_with_data, []);
});

Deno.test("annualizeItems: a transfer item is excluded from every total (小会计口径)", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
    { direction: "outflow", category: "unit_trust_contribution", amount: 500, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  const got = annualizeItems(items, ASOF);
  assertEquals(got.monthly_expenses, 0);
  assertEquals(got.annual_expenses, 0);
});

Deno.test("annualizeItems: a non-monthly recurring item lands in annual_items, not monthly", () => {
  const items: StandingItem[] = [
    { direction: "outflow", category: "road_tax", amount: 90, frequency: "annual", effective_from: "2026-01-01" },
    { direction: "outflow", category: "motor_insurance", amount: 400, frequency: "semi_annual", effective_from: "2026-01-01" },
  ];
  const got = annualizeItems(items, ASOF);
  assertAlmostEquals(got.annual_items_expenses, 90 + 400 * 2, 0.01);
  assertAlmostEquals(got.annual_expenses, 90 + 800, 0.01);
  // monthly_expenses is still the overall run-rate (annual_expenses / 12,
  // exactly like periods.ts) — it is not "only literally-monthly items".
  assertAlmostEquals(got.monthly_expenses, (90 + 800) / 12, 0.01);
});

Deno.test("annualizeItems: an inactive item (ended, or not yet started) contributes nothing", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 5000, frequency: "monthly", effective_from: "2026-01-01", effective_to: "2026-03-01" },
    { direction: "inflow", category: "side_income", amount: 1000, frequency: "monthly", effective_from: "2026-09-01" },
  ];
  const got = annualizeItems(items, ASOF);
  assertEquals(got.monthly_income, 0);
});

Deno.test("annualizeItems: one_off items never enter recurring totals, but list within [asOf-11, asOf+12] months", () => {
  const items: StandingItem[] = [
    { direction: "outflow", category: "asset_purchase", amount: 5000, frequency: "one_off", effective_from: "2026-06-01", effective_to: "2026-06-01" },
    { direction: "outflow", category: "travel", amount: 8000, frequency: "one_off", effective_from: "2025-07-01", effective_to: "2025-07-01" }, // exactly 11 months before
    { direction: "outflow", category: "travel", amount: 3000, frequency: "one_off", effective_from: "2027-06-01", effective_to: "2027-06-01" }, // exactly 12 months after
    { direction: "outflow", category: "travel", amount: 1000, frequency: "one_off", effective_from: "2025-06-01", effective_to: "2025-06-01" }, // 12 months before: OUT of window
    { direction: "outflow", category: "travel", amount: 999, frequency: "one_off", effective_from: "2027-07-01", effective_to: "2027-07-01" }, // 13 months after: OUT of window
  ];
  const got = annualizeItems(items, ASOF);
  assertEquals(got.monthly_expenses, 0);
  assertEquals(got.annual_expenses, 0);
  assertEquals(got.one_off_items.length, 3);
  assertEquals(
    got.one_off_items.map((i) => i.effective_from).sort(),
    ["2025-07-01", "2026-06-01", "2027-06-01"],
  );
});

// ---------------------------------------------------------------------------
// annualizeItemsByCategory — the by-category view of the same plan
// ---------------------------------------------------------------------------

Deno.test("annualizeItemsByCategory: splits active items by category, matching annualizeItems' totals", () => {
  const items: StandingItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01" },
    { direction: "outflow", category: "groceries", amount: 1000, frequency: "monthly", effective_from: "2026-01-01" },
    { direction: "outflow", category: "groceries", amount: 200, frequency: "monthly", effective_from: "2026-01-01" },
    { direction: "outflow", category: "road_tax", amount: 90, frequency: "annual", effective_from: "2026-01-01" },
  ];
  const byCategory = annualizeItemsByCategory(items, ASOF);
  const totals = annualizeItems(items, ASOF);

  const groceries = byCategory.find((c) => c.category === "groceries")!;
  assertEquals(groceries.monthly_expenses, 1200);
  const roadTax = byCategory.find((c) => c.category === "road_tax")!;
  assertAlmostEquals(roadTax.annual_expenses, 90, 0.01);

  assertAlmostEquals(
    byCategory.reduce((s, c) => s + c.annual_income, 0),
    totals.annual_income,
    0.01,
  );
  assertAlmostEquals(
    byCategory.reduce((s, c) => s + c.annual_expenses, 0),
    totals.annual_expenses,
    0.01,
  );
});

Deno.test("annualizeItemsByCategory: excludes transfers unless includeTransfers is set", () => {
  const items: StandingItem[] = [
    { direction: "outflow", category: "epf_employee", amount: 880, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  assertEquals(annualizeItemsByCategory(items, ASOF).length, 0);
  const withTransfers = annualizeItemsByCategory(items, ASOF, { includeTransfers: true });
  assertEquals(withTransfers.length, 1);
  assertEquals(withTransfers[0].monthly_expenses, 880);
});

Deno.test("annualizeItemsByCategory: one_off and inactive items never appear", () => {
  const items: StandingItem[] = [
    { direction: "outflow", category: "asset_purchase", amount: 5000, frequency: "one_off", effective_from: "2026-06-01", effective_to: "2026-06-01" },
    { direction: "inflow", category: "side_income", amount: 1000, frequency: "monthly", effective_from: "2026-09-01" },
  ];
  assertEquals(annualizeItemsByCategory(items, ASOF, { includeTransfers: true }).length, 0);
});

// ---------------------------------------------------------------------------
// reviseItem / endItem — 决策 3
// ---------------------------------------------------------------------------

Deno.test("reviseItem: fromMonth at or before effective_from is always a correction", () => {
  const item: StandingItem = { id: "i1", direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-04-01" };
  const atStart = reviseItem(item, { amount: 8200 }, "2026-04-01");
  assertEquals(atStart, { mode: "correct", update: { amount: 8200 } });

  const beforeStart = reviseItem(item, { amount: 8200 }, "2026-02-01");
  assertEquals(beforeStart.mode, "correct");
});

Deno.test("reviseItem: a real change from a later month opens a new version", () => {
  const item: StandingItem = { id: "i1", direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-04-01", effective_to: null };
  const got = reviseItem(item, { amount: 9000 }, "2026-07-01");
  assertEquals(got.mode, "version");
  if (got.mode !== "version") throw new Error("unreachable");
  assertEquals(got.close, { id: "i1", effective_to: "2026-06-01" });
  assertEquals(got.insert.amount, 9000);
  assertEquals(got.insert.effective_from, "2026-07-01");
  assertEquals(got.insert.effective_to, null);
  assertEquals(got.insert.previous_id, "i1");
  assertEquals((got.insert as { id?: string }).id, undefined, "the new row has no id — the DB assigns one");
});

Deno.test("reviseItem: versioning preserves the OLD effective_to on the new row", () => {
  const item: StandingItem = { id: "i1", direction: "outflow", category: "rent", amount: 1500, frequency: "monthly", effective_from: "2026-01-01", effective_to: "2026-12-01" };
  const got = reviseItem(item, { amount: 1600 }, "2026-06-01");
  assertEquals(got.mode, "version");
  if (got.mode !== "version") throw new Error("unreachable");
  assertEquals(got.insert.effective_to, "2026-12-01");
});

Deno.test("reviseItem: a one_off item is always corrected, never versioned", () => {
  const item: StandingItem = { id: "i1", direction: "outflow", category: "travel", amount: 5000, frequency: "one_off", effective_from: "2026-06-01", effective_to: "2026-06-01" };
  const got = reviseItem(item, { effective_from: "2026-07-01" }, "2026-07-01");
  assertEquals(got.mode, "correct");
  if (got.mode !== "correct") throw new Error("unreachable");
  assertEquals(got.update.effective_from, "2026-07-01");
  assertEquals(got.update.effective_to, "2026-07-01", "one_off keeps effective_to = effective_from");
});

Deno.test("endItem writes effective_to, clamped so it never precedes effective_from", () => {
  const item: StandingItem = { id: "i1", direction: "outflow", category: "rent", amount: 1500, frequency: "monthly", effective_from: "2026-04-01" };
  assertEquals(endItem(item, "2026-08-01"), { id: "i1", effective_to: "2026-08-01" });
  assertEquals(endItem(item, "2026-01-01"), { id: "i1", effective_to: "2026-04-01" }, "clamped, not backdated before it started");
});

// ---------------------------------------------------------------------------
// itemsFromMonthRows — 决策 5 REVISED: take the group's LATEST month, never
// an average. Live data showed multi-month clients are usually one financial
// position split across months (Jane: salary only in Jul, BNPL only in Aug;
// 乙: the phone bill alone in Jul) — averaging those months would quietly
// halve a real salary. See items.ts's own doc comment for the full story.
// ---------------------------------------------------------------------------

function row(over: Partial<MonthRow> & Pick<MonthRow, "id" | "direction" | "category" | "amount" | "frequency" | "period_month">): MonthRow {
  return { source_note: null, linked_asset_id: null, linked_liability_id: null, needs_review: false, review_reason: null, ...over };
}

// (i) single-month client: nothing to correct, so the migrated plan must
// equal annualizeCashflow's own figures exactly.
Deno.test("itemsFromMonthRows (i): a single-month client's migrated totals equal annualizeCashflow(rows, defaultBasis(rows))", () => {
  const rows: MonthRow[] = [
    row({ id: "s1", direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", period_month: "2026-04-01" }),
    row({ id: "s2", direction: "outflow", category: "groceries", amount: 500, frequency: "monthly", period_month: "2026-04-01" }),
    row({ id: "s3", direction: "inflow", category: "bonus", amount: 12000, frequency: "annual", period_month: "2026-04-01" }),
  ];
  const items = itemsFromMonthRows(rows);
  const basis = defaultBasis(rows as unknown as PeriodRow[]);
  const got = annualizeItems(items, "2026-04-01");
  const want = annualizeCashflow(rows as unknown as PeriodRow[], basis);

  assertAlmostEquals(got.annual_income, want.annual_income, 0.01);
  assertAlmostEquals(got.annual_expenses, want.annual_expenses, 0.01);
  assertAlmostEquals(got.monthly_income, want.monthly_income, 0.01);
  assertAlmostEquals(got.monthly_expenses, want.monthly_expenses, 0.01);
});

// (ii) complementary months: Jane's salary only in Jul, BNPL only in Aug —
// each keeps its full value, neither is halved by the other month existing.
Deno.test("itemsFromMonthRows (ii): complementary months (Jane shape) — full sums, salary is NOT halved", () => {
  const rows: MonthRow[] = [
    row({ id: "j1", direction: "inflow", category: "salary_basic", amount: 9600, frequency: "monthly", period_month: "2026-07-01" }),
    row({ id: "j2", direction: "outflow", category: "bnpl_payment", amount: 390, frequency: "monthly", period_month: "2026-08-01" }),
  ];
  const items = itemsFromMonthRows(rows);
  assertEquals(items.length, 2);

  const salary = items.find((i) => i.category === "salary_basic")!;
  const bnpl = items.find((i) => i.category === "bnpl_payment")!;
  assertEquals(salary.amount, 9600, "not (9600+0)/2 = 4800 — the old averaging bug this revision fixes");
  assertEquals(salary.effective_from, "2026-07-01");
  assertEquals(bnpl.amount, 390);
  assertEquals(bnpl.effective_from, "2026-08-01");
});

// (iii) the same recurring line in two months: latest value wins, earliest
// month still sets effective_from.
Deno.test("itemsFromMonthRows (iii): same note, Jul 1,000 then Aug 1,100 -> one item, amount 1,100, effective from Jul", () => {
  const rows: MonthRow[] = [
    row({ id: "k1", direction: "outflow", category: "telco", amount: 1000, frequency: "monthly", period_month: "2026-07-01", source_note: "Unifi" }),
    row({ id: "k2", direction: "outflow", category: "telco", amount: 1100, frequency: "monthly", period_month: "2026-08-01", source_note: "Unifi" }),
  ];
  const items = itemsFromMonthRows(rows);
  assertEquals(items.length, 1);
  assertEquals(items[0].amount, 1100, "the LATEST month's value, not the average of 1,000 and 1,100");
  assertEquals(items[0].effective_from, "2026-07-01", "earliest month the position was reported");
  assertEquals(items[0].effective_to, null);
  assertEquals(items[0].source_ids.slice().sort(), ["k1", "k2"], "both rows kept for provenance");
  assertEquals(items[0].amount_ids, ["k2"], "only the latest month feeds the amount");
});

// (iv) an annual bonus and a monthly salary in different months both
// migrate, each keeping its own frequency and effective_from.
Deno.test("itemsFromMonthRows (iv): an annual bonus in Mar + a monthly salary in Apr both migrate independently", () => {
  const rows: MonthRow[] = [
    row({ id: "m1", direction: "inflow", category: "bonus", amount: 18400, frequency: "annual", period_month: "2026-03-01" }),
    row({ id: "m2", direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", period_month: "2026-04-01" }),
  ];
  const items = itemsFromMonthRows(rows);
  assertEquals(items.length, 2);

  const bonus = items.find((i) => i.category === "bonus")!;
  assertEquals(bonus.amount, 18400);
  assertEquals(bonus.frequency, "annual");
  assertEquals(bonus.effective_from, "2026-03-01");
  assertEquals(bonus.source, "migrated");

  const salary = items.find((i) => i.category === "salary_basic")!;
  assertEquals(salary.amount, 8000);
  assertEquals(salary.effective_from, "2026-04-01");
});

// (v) earlier years are never migrated — only the client's latest year with
// data is in scope.
Deno.test("itemsFromMonthRows (v): only the latest year with data migrates; earlier years stay actuals", () => {
  const rows: MonthRow[] = [
    row({ id: "n1", direction: "inflow", category: "salary_basic", amount: 7000, frequency: "monthly", period_month: "2025-06-01" }),
    row({ id: "n2", direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", period_month: "2026-04-01" }),
  ];
  const items = itemsFromMonthRows(rows);
  assertEquals(items.length, 1);
  assertEquals(items[0].amount, 8000);
  assertEquals(items[0].source_ids, ["n2"]);
});

Deno.test("itemsFromMonthRows: needs_review/review_reason look at the WHOLE group, even a month that didn't win the amount", () => {
  const rows: MonthRow[] = [
    row({ id: "p1", direction: "outflow", category: "groceries", amount: 400, frequency: "monthly", period_month: "2026-04-01", needs_review: false, review_reason: null }),
    row({ id: "p2", direction: "outflow", category: "groceries", amount: 450, frequency: "monthly", period_month: "2026-05-01", needs_review: true, review_reason: "确认类别" }),
  ];
  const items = itemsFromMonthRows(rows);
  assertEquals(items.length, 1);
  assertEquals(items[0].amount, 450, "the latest month's value");
  assertEquals(items[0].needs_review, true);
  assertEquals(items[0].review_reason, "确认类别");
  assertEquals(items[0].source_ids.slice().sort(), ["p1", "p2"]);
  assertEquals(items[0].amount_ids, ["p2"]);
});

Deno.test("itemsFromMonthRows: a one_off row becomes a one_off item with effective_to = effective_from", () => {
  const rows: MonthRow[] = [
    row({ id: "q1", direction: "outflow", category: "asset_purchase", amount: 5000, frequency: "one_off", period_month: "2026-06-01" }),
  ];
  const items = itemsFromMonthRows(rows);
  assertEquals(items.length, 1);
  assertEquals(items[0].effective_from, "2026-06-01");
  assertEquals(items[0].effective_to, "2026-06-01");
  assertEquals(items[0].amount, 5000);
});

Deno.test("itemsFromMonthRows: a `basis` argument is accepted but no longer affects the result (backward compatibility)", () => {
  const rows: MonthRow[] = [
    row({ id: "z1", direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", period_month: "2026-04-01" }),
  ];
  const withoutBasis = itemsFromMonthRows(rows);
  const withIrrelevantBasis = itemsFromMonthRows(rows, { year: 2020, from_month: 1, to_month: 1 });
  const withNullBasis = itemsFromMonthRows(rows, null);
  assertEquals(withoutBasis, withIrrelevantBasis);
  assertEquals(withoutBasis, withNullBasis);
});

Deno.test("itemsFromMonthRows: an empty rows list produces nothing rather than throwing", () => {
  assertEquals(itemsFromMonthRows([]), []);
});
