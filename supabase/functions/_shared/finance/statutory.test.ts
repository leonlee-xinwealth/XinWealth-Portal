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
// EPF Third Schedule — official examples from the plan: the wage is rounded
// UP into its band (RM20 to RM5,000, RM100 to RM20,000, exact above) BEFORE
// the rate is applied, and each side rounds UP to the next ringgit.
// ---------------------------------------------------------------------------

Deno.test("EPF Third Schedule: 3,250 -> 359 employee / 424 employer (13%, band upper 3,260)", () => {
  const result = deriveStatutoryItems([salaryItem(3250)], { has_epf: true }, ASOF);
  assertEquals(result.employee_epf_monthly, 359);
  assertEquals(result.employer_epf_monthly, 424);
});

Deno.test("EPF Third Schedule: 4,250 -> 469 / 554 (band upper 4,260)", () => {
  const result = deriveStatutoryItems([salaryItem(4250)], { has_epf: true }, ASOF);
  assertEquals(result.employee_epf_monthly, 469);
  assertEquals(result.employer_epf_monthly, 554);
});

Deno.test("EPF Third Schedule: 5,000 -> 550 / 650 (exact multiple of 20, at the employer-rate threshold)", () => {
  const result = deriveStatutoryItems([salaryItem(5000)], { has_epf: true }, ASOF);
  assertEquals(result.employee_epf_monthly, 550);
  assertEquals(result.employer_epf_monthly, 650);
});

Deno.test("EPF Third Schedule: 5,050 -> 561 / 612 (crosses into the RM100 band, and the 12% employer rate)", () => {
  const result = deriveStatutoryItems([salaryItem(5050)], { has_epf: true }, ASOF);
  assertEquals(result.employee_epf_monthly, 561);
  assertEquals(result.employer_epf_monthly, 612);
});

Deno.test("EPF Third Schedule: 25,000 -> 2,750 / 3,000 (above RM20,000: exact wage, no banding)", () => {
  const result = deriveStatutoryItems([salaryItem(25000)], { has_epf: true }, ASOF);
  assertEquals(result.employee_epf_monthly, 2750);
  assertEquals(result.employer_epf_monthly, 3000);
});

Deno.test("EPF Third Schedule: a wage at/below RM10 contributes nothing to EPF (SOCSO/EIS's own rule is separate)", () => {
  const result = deriveStatutoryItems([salaryItem(10)], { has_epf: true }, ASOF);
  assertEquals(result.employee_epf_monthly, 0);
  assertEquals(result.employer_epf_monthly, 0);
  assertEquals(result.items.find((i) => i.category === "epf_employee"), undefined);
  // SOCSO/EIS has no RM10 floor of its own — wage 10 still falls under the
  // sub-RM300 flat-percentage fallback and produces a (tiny) item.
  assertAlmostEquals(result.socso_eis_monthly, 10 * 0.007, 0.001);
});

// ---------------------------------------------------------------------------
// Employer rate threshold — 决策 6
// ---------------------------------------------------------------------------

Deno.test("wage 4,000 -> employee 440, employer 520 (13%, at the threshold, exact band)", () => {
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

Deno.test("wage 8,000 -> employee 880, employer 960 (12%, above the threshold, exact band)", () => {
  const result = deriveStatutoryItems([salaryItem(8000)], { has_epf: true }, ASOF);
  assertEquals(result.employee_epf_monthly, 880);
  assertEquals(result.employer_epf_monthly, 960);
});

// ---------------------------------------------------------------------------
// Bonus / non-monthly EPF-wage items: EPF(W) + Σ[EPF(W + occurrence) −
// EPF(W)] / 12 per occurrence in the year — never linearly folded into W.
// ---------------------------------------------------------------------------

Deno.test("bonus example (plan spec): salary 4,000 + annual bonus 8,000 -> EPF(4,000)=440 + [EPF(12,000)-440]/12", () => {
  const annualBonus: StandingItem = { direction: "inflow", category: "bonus", amount: 8000, frequency: "annual", effective_from: "2026-01-01" };
  const result = deriveStatutoryItems([salaryItem(4000), annualBonus], { has_epf: true }, ASOF);

  // EPF(4,000) employee = 440 (exact band). EPF(12,000) employee: band upper
  // = 12,000 exact (RM100 band) -> 12,000*0.11 = 1,320. Marginal = 1,320-440
  // = 880, once a year, /12 = 73.333... -> 440 + 73.33 = 513.33.
  assertAlmostEquals(result.employee_epf_monthly, 440 + 880 / 12, 0.005);

  // Employer rate stays 13% throughout (W=4,000 <= 5,000) even though
  // W+bonus (12,000) alone would be > 5,000 — a bonus never changes the rate.
  // EPF(4,000) employer = 520. EPF(12,000) employer = 1,560. Marginal =
  // 1,040/12 = 86.67 -> 520 + 86.67 = 606.67.
  assertAlmostEquals(result.employer_epf_monthly, 520 + 1040 / 12, 0.005);
});

Deno.test("a bonus adds to the EPF wage base but NOT to the employer-rate threshold test", () => {
  // Regular wage 4,600 (<= 5,000 -> 13% employer rate), plus an annual bonus
  // of 12,000 (one occurrence/yr). Both 4,600 and 4,600+12,000=16,600 land
  // exactly on a Third Schedule band boundary (4,600/20 and 16,600/100 are
  // both whole numbers), so the marginal formula's result here happens to
  // match a plain linear rate*wage calculation (616 / 728) — a coincidence of
  // these particular round numbers, not a general equivalence.
  const annualBonus: StandingItem = { direction: "inflow", category: "bonus", amount: 12000, frequency: "annual", effective_from: "2026-01-01" };
  const result = deriveStatutoryItems([salaryItem(4600), annualBonus], { has_epf: true }, ASOF);

  assertEquals(result.epf_wage_monthly, 5600, "4,600 salary + 1,000/mo bonus equivalent (reporting figure only)");
  assertEquals(result.employer_epf_monthly, 728);
  assertEquals(result.employee_epf_monthly, 616);
});

// ---------------------------------------------------------------------------
// Age ≥ 60 — 决策 6
// ---------------------------------------------------------------------------

Deno.test("age 61 -> employee 0%, employer 4%, SOCSO/EIS 0", () => {
  const dob = "1965-01-01"; // 61 at 2026-06-01
  const items = [salaryItem(8000)];
  const result = deriveStatutoryItems(items, { has_epf: true, date_of_birth: dob }, ASOF);
  assertEquals(result.employee_epf_monthly, 0);
  assertEquals(result.employer_epf_monthly, 320); // ceil(8,000 * 0.04)
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
// SOCSO/EIS — band midpoint (band upper - 50), capped at the top band's
// midpoint (RM5,950). Official examples from the plan.
// ---------------------------------------------------------------------------

Deno.test("SOCSO/EIS official example: wage 2,577 -> SOCSO 12.75 + EIS 5.10", () => {
  const result = deriveStatutoryItems([salaryItem(2577)], { has_epf: true }, ASOF);
  assertAlmostEquals(result.socso_eis_monthly, 12.75 + 5.10, 0.001);
});

Deno.test("SOCSO/EIS official example: wage 10,000 -> SOCSO 29.75 + EIS 11.90, capped at the top band's midpoint", () => {
  const result = deriveStatutoryItems([salaryItem(10000)], { has_epf: true }, ASOF);
  assertAlmostEquals(result.socso_eis_monthly, 29.75 + 11.90, 0.001);
  const item = result.items.find((i) => i.category === "socso_eis")!;
  assert(item);
  assertAlmostEquals(item.monthly_amount, 41.65, 0.001);
});

Deno.test("SOCSO/EIS wage base includes overtime but not bonus", () => {
  const items: StandingItem[] = [
    salaryItem(3000, "salary_basic"),
    { direction: "inflow", category: "overtime", amount: 500, frequency: "monthly", effective_from: "2026-01-01" },
    { direction: "inflow", category: "bonus", amount: 12000, frequency: "annual", effective_from: "2026-01-01" },
  ];
  const result = deriveStatutoryItems(items, { has_epf: true }, ASOF);
  // socso/eis wage = 3000 + 500 = 3500 (bonus excluded); epf wage (reporting
  // figure) = 3000 + 1000(bonus/mo) = 4000.
  assertEquals(result.epf_wage_monthly, 4000);
  // wage 3,500 -> midpoint = ceil(3500/100)*100 - 50 = 3,450.
  // SOCSO = 0.005*3450 = 17.25, EIS = 0.002*3450 = 6.90 -> 24.15.
  assertAlmostEquals(result.socso_eis_monthly, 24.15, 0.001);
});

Deno.test("SOCSO/EIS below RM300: flat-percentage fallback, flagged as an approximation", () => {
  const result = deriveStatutoryItems([salaryItem(200)], { has_epf: true }, ASOF);
  assertAlmostEquals(result.socso_eis_monthly, 200 * 0.007, 0.001);
  const item = result.items.find((i) => i.category === "socso_eis")!;
  assert(item);
  assert(item.warnings.some((w) => w.includes("非官方分级表")));
});

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

Deno.test("EPF Third Schedule bands the wage BEFORE rounding the contribution up to the ringgit", () => {
  // wage 4,001 is NOT a linear rate*wage rounding — it bands first: band
  // upper = ceil(4001/20)*20 = 4,020, then employee = ceil(4,020*0.11) = 443
  // and employer (<=5,000 -> 13%) = ceil(4,020*0.13) = 523. (A naive
  // rate*wage-then-ceil approach, which this formula replaces, would have
  // given 441 / 521 — the exact bug this Third Schedule implementation
  // fixes.)
  const result = deriveStatutoryItems([salaryItem(4001)], { has_epf: true }, ASOF);
  assertEquals(result.employee_epf_monthly, 443);
  assertEquals(result.employer_epf_monthly, 523);
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
