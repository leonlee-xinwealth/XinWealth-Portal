// D2 — statutory payroll deductions (EPF / SOCSO / EIS): computed on the fly,
// never stored. spec 2026-09-25-cfp-p2b-standing-items-design.md 决策 6.
//
// ─────────────────────────────────────────────────────────────────────────────
// This file may import ONLY ../cashflow/items.ts (and, transitively through
// it, ../cashflow/periods.ts) — relative, with the .ts extension. It must NOT
// import ./derived.ts: derived.ts imports THIS file to call
// deriveStatutoryItems, and a two-file cycle breaks every bundler here (Deno,
// Vite, esbuild). The item shape below is therefore a small LOCAL type,
// structurally identical to (and freely assignable into an array of)
// derived.ts's DerivedItem — nothing needs to import the other's type.
// ─────────────────────────────────────────────────────────────────────────────
//
// Malaysia, private-sector employee, monthly-wage-table-free approximation
// (advisors are told this is an estimate — every item below carries the
// Chinese note 「按法定比例估算」, never a claim of payroll-exact precision):
//
//   EPF   employee 11% of wage, employer 13%/12% (≤/> RM5,000 "wage" per
//         month, excluding bonus), both 0%/4% at age ≥60. Employee side is a
//         cash-flow item (`epf_employee`, O1 — a TRANSFER, not spending: it is
//         still the client's own money). Employer side never reaches the
//         client's pocket, so it is never a cash-flow item — only a number
//         (`employer_epf_monthly`) for whoever reconciles net worth (P4).
//   SOCSO/EIS  employee 0.5% + 0.2% of wage, capped at RM6,000/month, 0% at
//         age ≥60. A real expense (`socso_eis`, O9) — it leaves the client's
//         pocket and never comes back the way EPF does.

import { activeItems, itemMonthlyAmount, type StandingItem } from "../cashflow/items.ts";

export const EPF_EMPLOYEE_RATE = 0.11;
export const EPF_EMPLOYEE_RATE_SENIOR = 0;
export const EPF_EMPLOYER_RATE_LOW = 0.13;
export const EPF_EMPLOYER_RATE_HIGH = 0.12;
export const EPF_EMPLOYER_RATE_SENIOR = 0.04;
/** 常规月薪 (excluding bonus) at or below this uses the higher employer rate. */
export const EPF_EMPLOYER_WAGE_THRESHOLD = 5000;

export const SOCSO_EMPLOYEE_RATE = 0.005;
export const EIS_EMPLOYEE_RATE = 0.002;
export const SOCSO_EIS_WAGE_CEILING = 6000;

/** 60th birthday: employee EPF drops to 0%, employer to 4%, SOCSO/EIS to 0%. */
export const STATUTORY_SENIOR_AGE = 60;

export const STATUTORY_NOTE = "按法定比例估算";

/** 决策 6: the EPF wage base — salary_basic + fixed_allowance + commission +
 *  bonus, excluding overtime. */
const EPF_WAGE_CATEGORIES = ["salary_basic", "fixed_allowance", "commission", "bonus"];
/** The "常规月薪" the EMPLOYER RATE threshold is tested against — the same
 *  base minus bonus, so an annual bonus never pushes the client into the
 *  lower employer rate. */
const REGULAR_WAGE_CATEGORIES = ["salary_basic", "fixed_allowance", "commission"];
/** SOCSO/EIS wage base — salary_basic + fixed_allowance + commission +
 *  overtime (bonus excluded — SOCSO/EIS is not charged on bonus). */
const SOCSO_EIS_WAGE_CATEGORIES = ["salary_basic", "fixed_allowance", "commission", "overtime"];

export interface StatutoryClientInfo {
  has_epf?: boolean | null;
  date_of_birth?: string | null;
}

/** Structurally identical to derived.ts's DerivedItem (source_type widened to
 *  include "statutory" there) — see the file header for why this isn't a
 *  shared import. */
export interface StatutoryDerivedItem {
  key: string;
  source_type: "statutory";
  source_id: null;
  source_name: string;
  category: "epf_employee" | "socso_eis";
  direction: "outflow";
  monthly_amount: number;
  interest_monthly: 0;
  principal_monthly: 0;
  estimated: Array<"statutory_rate">;
  warnings: string[];
}

export interface DeriveStatutoryResult {
  items: StatutoryDerivedItem[];
  employee_epf_monthly: number;
  employer_epf_monthly: number;
  socso_eis_monthly: number;
  epf_wage_monthly: number;
  notes: string[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** EPF contributions round UP to the next whole ringgit (决策 6); a tiny
 *  epsilon absorbs float error so an already-whole number never gets bumped. */
function roundUpToRinggit(n: number): number {
  return Math.ceil(n - 1e-9);
}

/** Age at `asOf`, from a 'YYYY-MM-DD' date of birth. null when unusable — a
 *  missing DOB is treated as under 60 (决策 6), never as "senior by default". */
function ageAt(dob: string | null | undefined, asOf: Date): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  let age = asOf.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthdayThisYear =
    asOf.getUTCMonth() < d.getUTCMonth() ||
    (asOf.getUTCMonth() === d.getUTCMonth() && asOf.getUTCDate() < d.getUTCDate());
  if (beforeBirthdayThisYear) age -= 1;
  return age;
}

function sumWage(items: StandingItem[], asOf: Date, categories: string[]): number {
  let total = 0;
  for (const item of activeItems(items ?? [], asOf)) {
    if (item.direction !== "inflow") continue;
    if (!categories.includes(item.category)) continue;
    total += itemMonthlyAmount(item);
  }
  return total;
}

/**
 * 决策 6: EPF/SOCSO/EIS from the client's standing salary items.
 *
 * Nothing is produced unless `has_epf === true` (an explicit "yes", not just
 * "not false") AND the EPF wage base is actually positive — a client with the
 * flag set but no active salary items has nothing to contribute against.
 */
export function deriveStatutoryItems(
  items: StandingItem[],
  client: StatutoryClientInfo,
  asOf: Date = new Date(),
): DeriveStatutoryResult {
  const nothing: DeriveStatutoryResult = {
    items: [],
    employee_epf_monthly: 0,
    employer_epf_monthly: 0,
    socso_eis_monthly: 0,
    epf_wage_monthly: 0,
    notes: [],
  };
  if (client?.has_epf !== true) return nothing;

  const epfWage = sumWage(items, asOf, EPF_WAGE_CATEGORIES);
  if (epfWage <= 0) return nothing;

  const regularWage = sumWage(items, asOf, REGULAR_WAGE_CATEGORIES);
  const socsoEisWage = Math.min(sumWage(items, asOf, SOCSO_EIS_WAGE_CATEGORIES), SOCSO_EIS_WAGE_CEILING);

  const age = ageAt(client.date_of_birth, asOf);
  const isSenior = age != null && age >= STATUTORY_SENIOR_AGE;

  const employeeRate = isSenior ? EPF_EMPLOYEE_RATE_SENIOR : EPF_EMPLOYEE_RATE;
  const employerRate = isSenior
    ? EPF_EMPLOYER_RATE_SENIOR
    : regularWage <= EPF_EMPLOYER_WAGE_THRESHOLD
      ? EPF_EMPLOYER_RATE_LOW
      : EPF_EMPLOYER_RATE_HIGH;

  const employeeEpf = roundUpToRinggit(epfWage * employeeRate);
  const employerEpf = roundUpToRinggit(epfWage * employerRate);

  const socsoRate = isSenior ? 0 : SOCSO_EMPLOYEE_RATE;
  const eisRate = isSenior ? 0 : EIS_EMPLOYEE_RATE;
  const socsoEis = round2(socsoEisWage * (socsoRate + eisRate));

  const resultItems: StatutoryDerivedItem[] = [];
  if (employeeEpf > 0) {
    resultItems.push({
      key: "statutory:epf_employee",
      source_type: "statutory",
      source_id: null,
      source_name: "EPF（雇员）",
      category: "epf_employee",
      direction: "outflow",
      monthly_amount: employeeEpf,
      interest_monthly: 0,
      principal_monthly: 0,
      estimated: ["statutory_rate"],
      warnings: [STATUTORY_NOTE],
    });
  }
  if (socsoEis > 0) {
    resultItems.push({
      key: "statutory:socso_eis",
      source_type: "statutory",
      source_id: null,
      source_name: "SOCSO/EIS",
      category: "socso_eis",
      direction: "outflow",
      monthly_amount: socsoEis,
      interest_monthly: 0,
      principal_monthly: 0,
      estimated: ["statutory_rate"],
      warnings: [STATUTORY_NOTE],
    });
  }

  return {
    items: resultItems,
    employee_epf_monthly: employeeEpf,
    employer_epf_monthly: employerEpf,
    socso_eis_monthly: socsoEis,
    epf_wage_monthly: round2(epfWage),
    notes: resultItems.length > 0 ? [STATUTORY_NOTE] : [],
  };
}
