import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  estimateIncomeTax,
  progressiveTax,
  RELIEFS,
  taxableIncomeFromItems,
  taxAfterRebate,
  TAXABLE_I1_CATEGORIES,
  RENTAL_INCOME_CATEGORY,
  REBATE_AMOUNT,
  REBATE_THRESHOLD,
  type TaxItem,
  type TaxPolicy,
} from "./incomeTax.ts";
// incomeTax.ts itself must have ZERO imports (see its file header) — this
// TEST file has no such restriction, so it pins the local TAXABLE_I1_
// CATEGORIES/RENTAL_INCOME_CATEGORY mirror against the live taxonomy.
import { CASHFLOW_CATEGORIES } from "../taxonomy/cashflow.ts";

const ASOF = new Date("2026-06-01T00:00:00Z");

function inflow(category: string, amount: number, frequency = "monthly", effective_from = "2026-01-01"): TaxItem {
  return { direction: "inflow", category, amount, frequency, effective_from };
}

// ---------------------------------------------------------------------------
// Pin the local, zero-import category lists against the real taxonomy —
// incomeTax.ts can't import taxonomy/cashflow.ts, so this test is the only
// thing standing between the two silently drifting apart.
// ---------------------------------------------------------------------------

Deno.test("TAXABLE_I1_CATEGORIES == taxonomy I1 group minus employer_epf", () => {
  const i1Codes = CASHFLOW_CATEGORIES.filter((c) => c.group === "I1").map((c) => c.code);
  const expected = i1Codes.filter((c) => c !== "employer_epf").sort();
  assertEquals([...TAXABLE_I1_CATEGORIES].sort(), expected);
});

Deno.test("RENTAL_INCOME_CATEGORY is a real I2 taxonomy code", () => {
  const cat = CASHFLOW_CATEGORIES.find((c) => c.code === RENTAL_INCOME_CATEGORY);
  assert(cat, "rental_income must exist in the taxonomy");
  assertEquals(cat!.group, "I2");
});

// ---------------------------------------------------------------------------
// taxAfterRebate
// ---------------------------------------------------------------------------

Deno.test("taxAfterRebate: RM400 off when chargeable <= 35,000, floored at 0; untouched above", () => {
  assertEquals(taxAfterRebate(135, 18516), 0); // floors below 0
  assertEquals(taxAfterRebate(1000, 35000), 600); // boundary inclusive
  assertEquals(taxAfterRebate(1000, 35001), 1000); // just above: untouched
  assertEquals(REBATE_AMOUNT, 400);
  assertEquals(REBATE_THRESHOLD, 35000);
});

// ---------------------------------------------------------------------------
// taxableIncomeFromItems
// ---------------------------------------------------------------------------

Deno.test("taxableIncomeFromItems: I1 (except employer_epf) + rental_income gross; dividends/interest excluded", () => {
  const items: TaxItem[] = [
    inflow("salary_basic", 8000),
    inflow("commission", 5000),
    inflow("director_fee", 3000),
    inflow("bonus", 18400, "annual"),
    inflow("rental_income", 1800),
    inflow("dividend_company", 2000),
    inflow("dividend_investment", 500),
    inflow("employer_epf", 1000), // I1 but excluded
  ];
  assertEquals(taxableIncomeFromItems(items, ASOF), 232000);
});

Deno.test("taxableIncomeFromItems: an inactive item doesn't count", () => {
  const items: TaxItem[] = [
    { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01", effective_to: "2026-03-01" },
  ];
  assertEquals(taxableIncomeFromItems(items, ASOF), 0); // ASOF = 2026-06, item ended in March
});

// ---------------------------------------------------------------------------
// estimateIncomeTax — 乙 shape: tax 0 via the RM400 rebate.
// ---------------------------------------------------------------------------

Deno.test("estimateIncomeTax (乙 shape): salary 2,577 + EPF relief 284x12 -> chargeable 18,516, tax 0 via rebate", () => {
  const items: TaxItem[] = [inflow("salary_basic", 2577)];
  const result = estimateIncomeTax({ items, employeeEpfAnnual: 284 * 12, asOf: ASOF });

  assertEquals(result.taxable_income, 2577 * 12);
  const epfRelief = result.reliefs.find((r) => r.key === "epf");
  assert(epfRelief);
  assertEquals(epfRelief!.amount, 284 * 12);
  assertEquals(result.chargeable_income, 18516);
  assertEquals(result.annual_tax, 0);
  assertEquals(result.monthly_tax, 0);
});

Deno.test("estimateIncomeTax (乙 shape, no EPF): still 0 via the rebate (chargeable 21,924)", () => {
  const items: TaxItem[] = [inflow("salary_basic", 2577)];
  const result = estimateIncomeTax({ items, employeeEpfAnnual: 0, asOf: ASOF });
  assertEquals(result.chargeable_income, 2577 * 12 - 9000);
  assertEquals(result.annual_tax, 0);
});

// ---------------------------------------------------------------------------
// estimateIncomeTax — Lim shape: taxable 232,000, chargeable 220,000, tax 39,400.
// ---------------------------------------------------------------------------

Deno.test("estimateIncomeTax (Lim shape): taxable 232,000, chargeable 220,000, annual tax 39,400", () => {
  const items: TaxItem[] = [
    inflow("salary_basic", 8000),
    inflow("commission", 5000),
    inflow("director_fee", 3000),
    inflow("bonus", 18400, "annual"),
    inflow("rental_income", 1800),
    inflow("dividend_company", 2000),
    inflow("dividend_investment", 500),
  ];
  const policies: TaxPolicy[] = [
    { policy_type: "life", premium: 24000, premium_frequency: "annual" },
  ];
  const result = estimateIncomeTax({ items, policies, employeeEpfAnnual: 0, asOf: ASOF });

  assertEquals(result.taxable_income, 232000);
  assertEquals(result.chargeable_income, 220000);
  assertEquals(result.annual_tax, 39400);
  assertAlmostEquals(result.monthly_tax, 39400 / 12, 0.01);

  const life = result.reliefs.find((r) => r.key === "life_insurance");
  assert(life);
  assertEquals(life!.amount, 3000); // 24,000 capped at 3,000

  assert(result.notes.includes("租金按总额估算，未扣可扣除费用"));
  // Sanity: matches progressiveTax computed directly (no rebate above 35,000).
  assertEquals(result.annual_tax, Math.round(progressiveTax(220000)));
});

// ---------------------------------------------------------------------------
// estimateIncomeTax — non-resident: flat 30% of taxable income, no reliefs.
// ---------------------------------------------------------------------------

Deno.test("estimateIncomeTax: non-resident pays a flat 30% of taxable income, no reliefs or rebate", () => {
  const items: TaxItem[] = [
    inflow("salary_basic", 8000),
    inflow("commission", 5000),
    inflow("director_fee", 3000),
    inflow("bonus", 18400, "annual"),
    inflow("rental_income", 1800),
  ];
  const result = estimateIncomeTax({ items, nonResident: true, asOf: ASOF });
  assertEquals(result.taxable_income, 232000);
  assertEquals(result.chargeable_income, 232000); // no reliefs subtracted
  assertEquals(result.annual_tax, Math.round(232000 * 0.3));
  assertEquals(result.reliefs, []);
});

// ---------------------------------------------------------------------------
// detected reliefs (RELIEF_BY_CATEGORY) from active standing items.
// ---------------------------------------------------------------------------

Deno.test("estimateIncomeTax: detects and caps a RELIEF_BY_CATEGORY relief from standing items", () => {
  const items: TaxItem[] = [
    inflow("salary_basic", 10000),
    { direction: "outflow", category: "medical_card", amount: 300, frequency: "monthly", effective_from: "2026-01-01" },
  ];
  const result = estimateIncomeTax({ items, asOf: ASOF });
  const medical = result.reliefs.find((r) => r.key === "medical_insurance");
  assert(medical);
  assertEquals(medical!.amount, 3000); // 300*12=3,600 capped at the 3,000 cap
});

Deno.test("RELIEFS still exposes the expected caps (sanity: nothing silently dropped in the move)", () => {
  const byKey = Object.fromEntries(RELIEFS.map((r) => [r.key, r.cap]));
  assertEquals(byKey.personal, 9000);
  assertEquals(byKey.epf, 4000);
  assertEquals(byKey.life_insurance, 3000);
});
