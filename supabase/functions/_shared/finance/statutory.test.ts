import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { deriveStatutoryItems, STATUTORY_NOTE, type StatutoryClientInfo } from "./statutory.ts";
import type { StandingItem } from "../cashflow/items.ts";

const ASOF = new Date("2026-06-01T00:00:00Z");

function salaryItem(amount: number, category = "salary_basic", effective_from = "2026-01-01"): StandingItem {
  return { direction: "inflow", category, amount, frequency: "monthly", effective_from };
}

// ---------------------------------------------------------------------------
// Gate: has_epf and wage base
// ---------------------------------------------------------------------------

Deno.test("deriveStatutoryItems: has_epf false or missing produces nothing", () => {
  const items = [salaryItem(8000)];
  assertEquals(deriveStatutoryItems(items, { has_epf: false }, ASOF).items.length, 0);
  assertEquals(deriveStatutoryItems(items, {}, ASOF).items.length, 0);
  assertEquals(deriveStatutoryItems(items, { has_epf: null }, ASOF).items.length, 0);
});

Deno.test("deriveStatutoryItems: has_epf true but no active salary items produces nothing", () => {
  const result = deriveStatutoryItems([], { has_epf: true }, ASOF);
  assertEquals(result.items.length, 0);
  assertEquals(result.employee_epf_monthly, 0);
  assertEquals(result.employer_epf_monthly, 0);
  assertEquals(result.socso_eis_monthly, 0);
});

// ---------------------------------------------------------------------------
// Employer rate threshold — 决策 6
// ---------------------------------------------------------------------------

Deno.test("wage 4,000 -> employee 440, employer 520 (13%, at the threshold)", () => {
  const result = deriveStatutoryItems([salaryItem(4000)], { has_epf: true }, ASOF);
  assertEquals(result.employee_epf_monthly, 440);
  assertEquals(result.employer_epf_monthly, 520);
  const epfItem = result.items.find((i) => i.category === "epf_employee")!;
  assert(epfItem);
  assertEquals(epfItem.monthly_amount, 440);
  assertEquals(epfItem.direction, "outflow");
  assertEquals(epfItem.source_type, "statutory");
  assert(epfItem.warnings.includes(STATUTORY_NOTE));
});

Deno.test("wage 8,000 -> employee 880, employer 960 (12%, above the threshold)", () => {
  const result = deriveStatutoryItems([salaryItem(8000)], { has_epf: true }, ASOF);
  assertEquals(result.employee_epf_monthly, 880);
  assertEquals(result.employer_epf_monthly, 960);
});

Deno.test("a bonus adds to the EPF wage base but NOT to the employer-rate threshold test", () => {
  // Regular wage 4,600 (≤ 5,000 -> 13%), plus a bonus item worth 1,000/mo more
  // in the EPF base (epf_wage_monthly = 5,600, itself > 5,000). If the rate
  // test wrongly used the full EPF base, this would flip to 12%.
  const annualBonus: StandingItem = { direction: "inflow", category: "bonus", amount: 12000, frequency: "annual", effective_from: "2026-01-01" };
  const result = deriveStatutoryItems([salaryItem(4600), annualBonus], { has_epf: true }, ASOF);

  assertEquals(result.epf_wage_monthly, 5600, "4,600 salary + 1,000/mo bonus equivalent");
  // Employer rate must still be 13% (regular wage 4,600 ≤ 5,000), applied to
  // the FULL 5,600 base -> 728, not 12% x 5,600 = 672.
  assertEquals(result.employer_epf_monthly, 728);
  assertEquals(result.employee_epf_monthly, 616); // 5,600 x 11%
});

// ---------------------------------------------------------------------------
// Age ≥ 60 — 决策 6
// ---------------------------------------------------------------------------

Deno.test("age 61 -> employee 0%, employer 4%, SOCSO/EIS 0", () => {
  const dob = "1965-01-01"; // 61 at 2026-06-01
  const items = [salaryItem(8000)];
  const result = deriveStatutoryItems(items, { has_epf: true, date_of_birth: dob }, ASOF);
  assertEquals(result.employee_epf_monthly, 0);
  assertEquals(result.employer_epf_monthly, roundUp(8000 * 0.04));
  assertEquals(result.socso_eis_monthly, 0);
  // no epf_employee or socso_eis item — both are zero.
  assertEquals(result.items.length, 0);
});

Deno.test("a null date_of_birth is treated as under 60, never as senior", () => {
  const result = deriveStatutoryItems([salaryItem(8000)], { has_epf: true, date_of_birth: null }, ASOF);
  assertEquals(result.employee_epf_monthly, 880); // the under-60 rate, not 0
});

Deno.test("exactly the day before the 60th birthday is still under 60", () => {
  // 60th birthday is 2026-06-02 -> at asOf 2026-06-01 the client is still 59.
  const dob = "1966-06-02";
  const result = deriveStatutoryItems([salaryItem(4000)], { has_epf: true, date_of_birth: dob }, ASOF);
  assertEquals(result.employee_epf_monthly, 440); // 11%, not 0
});

Deno.test("exactly the 60th birthday itself is senior", () => {
  const dob = "1966-06-01";
  const result = deriveStatutoryItems([salaryItem(4000)], { has_epf: true, date_of_birth: dob }, ASOF);
  assertEquals(result.employee_epf_monthly, 0);
});

// ---------------------------------------------------------------------------
// SOCSO/EIS — 决策 6
// ---------------------------------------------------------------------------

Deno.test("wage 10,000 -> SOCSO 30.00 + EIS 12.00 = 42.00, capped at the 6,000 ceiling", () => {
  const result = deriveStatutoryItems([salaryItem(10000)], { has_epf: true }, ASOF);
  assertAlmostEquals(result.socso_eis_monthly, 30 + 12, 0.001);
  const item = result.items.find((i) => i.category === "socso_eis")!;
  assert(item);
  assertAlmostEquals(item.monthly_amount, 42, 0.001);
});

Deno.test("SOCSO/EIS wage base includes overtime but not bonus", () => {
  const items: StandingItem[] = [
    salaryItem(3000, "salary_basic"),
    { direction: "inflow", category: "overtime", amount: 500, frequency: "monthly", effective_from: "2026-01-01" },
    { direction: "inflow", category: "bonus", amount: 12000, frequency: "annual", effective_from: "2026-01-01" },
  ];
  const result = deriveStatutoryItems(items, { has_epf: true }, ASOF);
  // socso/eis wage = 3000 + 500 = 3500 (bonus excluded); epf wage = 3000 + 1000(bonus/mo) = 4000.
  assertEquals(result.epf_wage_monthly, 4000);
  assertAlmostEquals(result.socso_eis_monthly, 3500 * 0.007, 0.001);
});

// ---------------------------------------------------------------------------
// Rounding — 决策 6
// ---------------------------------------------------------------------------

Deno.test("EPF rounds UP to the next ringgit; SOCSO/EIS keeps 2dp", () => {
  const result = deriveStatutoryItems([salaryItem(4001)], { has_epf: true }, ASOF);
  // 4001 x 0.11 = 440.11 -> rounds up to 441.
  assertEquals(result.employee_epf_monthly, 441);
  // 4001 x 0.13 = 520.13 -> rounds up to 521.
  assertEquals(result.employer_epf_monthly, 521);
});

// ---------------------------------------------------------------------------
// Active-at-asOf: inactive salary items don't feed the wage base
// ---------------------------------------------------------------------------

Deno.test("an ended salary item no longer contributes to the wage base", () => {
  const item: StandingItem = { direction: "inflow", category: "salary_basic", amount: 8000, frequency: "monthly", effective_from: "2026-01-01", effective_to: "2026-03-01" };
  const result = deriveStatutoryItems([item], { has_epf: true }, ASOF); // asOf = 2026-06-01, item ended in March
  assertEquals(result.items.length, 0);
  assertEquals(result.epf_wage_monthly, 0);
});

function roundUp(n: number): number {
  return Math.ceil(n - 1e-9);
}
