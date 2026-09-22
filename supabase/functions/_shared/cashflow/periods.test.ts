import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  annualizeByCategory,
  annualizeCashflow,
  defaultBasis,
  formatBasis,
  monthlyBreakdown,
  recordedYears,
  TRANSFER_CATEGORIES_INLINE,
  yearToDateTotals,
  type CashflowBasis,
  type PeriodRow,
} from "./periods.ts";
import CASES from "./periods.cases.json" with { type: "json" };
import { TRANSFER_CATEGORY_CODES } from "../taxonomy/cashflow.ts";

// The Deno half of the dual-runtime check. components/advisor/__tests__/
// cashflowPeriods.test.ts runs the SAME periods.cases.json under vitest, so the
// browser and the edge function cannot drift on the 口径 that produces every
// figure in the report. Cases live in JSON precisely so neither runtime owns
// them.

// deno-lint-ignore no-explicit-any
function rowsOf(spec: any, all: any[]): PeriodRow[] {
  if (typeof spec === "string" && spec.startsWith("@case:")) {
    return rowsOf(all[Number(spec.slice(6))].rows, all);
  }
  return spec as PeriodRow[];
}

Deno.test("shared cases: annualizeCashflow", async (t) => {
  for (const [i, c] of CASES.cases.entries()) {
    await t.step(c.name, () => {
      const rows = rowsOf(c.rows, CASES.cases);
      const got = annualizeCashflow(rows, c.basis as CashflowBasis);
      const want = c.expect as Record<string, number | number[]>;

      for (const key of [
        "monthly_income", "monthly_expenses", "annual_income", "annual_expenses",
        "annual_items_income", "annual_items_expenses",
      ] as const) {
        assertAlmostEquals(
          got[key], want[key] as number, 1e-6,
          `case ${i} "${c.name}" — ${key}`,
        );
        assert(Number.isFinite(got[key]), `${key} must never be NaN`);
      }
      assertEquals(got.basis_months, want.basis_months, `case ${i} basis_months`);
      assertEquals(got.months_with_data, want.months_with_data, `case ${i} months_with_data`);
    });
  }
});

Deno.test("shared cases: yearToDateTotals", async (t) => {
  for (const c of CASES.cases) {
    if (!c.ytd) continue;
    await t.step(c.name, () => {
      const rows = rowsOf(c.rows, CASES.cases);
      assertEquals(yearToDateTotals(rows, c.ytd.year), c.ytd);
    });
  }
});

Deno.test("shared cases: defaultBasis", async (t) => {
  for (const c of CASES.defaultBasis) {
    await t.step(c.name, () => {
      assertEquals(defaultBasis(rowsOf(c.rows, CASES.cases)), c.expect);
    });
  }
});

// ---------------------------------------------------------------------------
// Behaviour that is easier to state than to encode as a fixture row
// ---------------------------------------------------------------------------

const LEE: PeriodRow[] = [
  { direction: "inflow", amount: 2577, frequency: "monthly", period_month: "2026-06-01" },
  { direction: "outflow", amount: 580, frequency: "monthly", period_month: "2026-06-01" },
  { direction: "outflow", amount: 340, frequency: "monthly", period_month: "2026-06-01" },
  { direction: "outflow", amount: 200, frequency: "monthly", period_month: "2026-06-01" },
  { direction: "outflow", amount: 200, frequency: "monthly", period_month: "2026-06-01" },
  { direction: "outflow", amount: 100, frequency: "monthly", period_month: "2026-06-01" },
  { direction: "outflow", amount: 128, frequency: "monthly", period_month: "2026-07-01" },
];

Deno.test("the per-month entry count is what exposes a half-entered month", () => {
  // No formula can tell a lean month from an incomplete one. Five rows against
  // one is something a person reads instantly, which is why the count is
  // surfaced rather than smoothed away.
  const months = monthlyBreakdown(LEE, 2026);
  assertEquals(months.map((m) => [m.month, m.entries]), [[6, 6], [7, 1]]);
  assertEquals(months[0].expenses, 1420);
  assertEquals(months[1].expenses, 128);
});

Deno.test("the annual run-rate and the year's actuals are different numbers", () => {
  // RM 6,000 in June plus RM 4,000 in July is RM 10,000 earned and a RM 60,000
  // run-rate. Swapping them would tell a client they earn RM 10,000 a year.
  const rows: PeriodRow[] = [
    { direction: "inflow", amount: 6000, frequency: "monthly", period_month: "2026-06-01" },
    { direction: "inflow", amount: 4000, frequency: "monthly", period_month: "2026-07-01" },
  ];
  const basis: CashflowBasis = { year: 2026, from_month: 6, to_month: 7 };
  assertEquals(yearToDateTotals(rows, 2026).income, 10_000);
  assertEquals(annualizeCashflow(rows, basis).annual_income, 60_000);
});

Deno.test("a basis outside the recorded years reports nothing rather than borrowing", () => {
  const got = annualizeCashflow(LEE, { year: 2025, from_month: 1, to_month: 12 });
  assertEquals(got.annual_expenses, 0);
  assertEquals(got.months_with_data, []);
});

Deno.test("a null basis is a whole-year window, not a crash", () => {
  const got = annualizeCashflow(LEE, null);
  assertEquals(got.basis_months, 12);
  assert(Number.isFinite(got.annual_expenses));
});

Deno.test("unusable period_month values are skipped, not counted as year zero", () => {
  const rows = [
    { direction: "inflow", amount: 500, frequency: "monthly", period_month: "" },
    { direction: "inflow", amount: 500, frequency: "monthly", period_month: "not-a-date" },
    { direction: "inflow", amount: 1000, frequency: "monthly", period_month: "2026-06-01" },
  ] as PeriodRow[];
  assertEquals(annualizeCashflow(rows, { year: 2026, from_month: 6, to_month: 6 }).annual_income, 12_000);
  assertEquals(recordedYears(rows), [2026]);
});

Deno.test("a non-numeric amount contributes zero rather than NaN", () => {
  const rows = [
    { direction: "inflow", amount: "oops", frequency: "monthly", period_month: "2026-06-01" },
    { direction: "inflow", amount: 1000, frequency: "monthly", period_month: "2026-06-01" },
  ] as unknown as PeriodRow[];
  assertEquals(annualizeCashflow(rows, { year: 2026, from_month: 6, to_month: 6 }).annual_income, 12_000);
});

Deno.test("an unknown frequency is treated as monthly rather than dropped", () => {
  // Dropping it would understate the client; the historical table defaulted to
  // 12 for the same reason.
  const rows = [
    { direction: "inflow", amount: 1000, frequency: "fortnightly", period_month: "2026-06-01" },
  ] as PeriodRow[];
  const got = annualizeCashflow(rows, { year: 2026, from_month: 6, to_month: 6 });
  assertEquals(got.annual_income, 12_000);
  assertEquals(got.annual_items_income, 12_000, "it is not a month actual, so it is a periodic item");
});

Deno.test("the basis reads back the way an advisor would say it", () => {
  assertEquals(formatBasis({ year: 2026, from_month: 6, to_month: 7 }), "2026 年 6–7 月");
  assertEquals(formatBasis({ year: 2026, from_month: 6, to_month: 6 }), "2026 年 6 月");
  assertEquals(formatBasis({ year: 2026, from_month: 6, to_month: 7 }, "en"), "Jun–Jul 2026");
  assertEquals(formatBasis(null), "无记录");
});

// ---------------------------------------------------------------------------
// Transfers by category, and per-category annualisation (spec 2026-09-22 §1)
// ---------------------------------------------------------------------------

Deno.test("periods.ts's inline transfer list is the taxonomy's", () => {
  assertEquals([...TRANSFER_CATEGORIES_INLINE].sort(), [...TRANSFER_CATEGORY_CODES]);
});

Deno.test("shared cases: annualizeByCategory", async (t) => {
  for (const c of CASES.byCategory) {
    await t.step(c.name, () => {
      const rows = c.rows as PeriodRow[];
      const basis = c.basis as CashflowBasis;
      const by = Object.fromEntries(annualizeByCategory(rows, basis).map((x) => [x.category, x]));
      for (const [cat, want] of Object.entries(c.expect)) {
        assertAlmostEquals(by[cat]?.monthly_income ?? 0, want.monthly_income, 1e-6, `${cat} income`);
        assertAlmostEquals(by[cat]?.monthly_expenses ?? 0, want.monthly_expenses, 1e-6, `${cat} expenses`);
      }
      assertEquals(by["to_savings"], undefined);
      const total = annualizeCashflow(rows, basis);
      const sum = annualizeByCategory(rows, basis).reduce((s, x) => s + x.monthly_expenses, 0);
      assertAlmostEquals(sum, total.monthly_expenses, 1e-6);
      const withT = Object.fromEntries(
        annualizeByCategory(rows, basis, { includeTransfers: true }).map((x) => [x.category, x]),
      );
      for (const [cat, want] of Object.entries(c.expectWithTransfers)) {
        assertAlmostEquals(withT[cat]?.monthly_expenses ?? 0, want.monthly_expenses, 1e-6, cat);
      }
    });
  }
});
