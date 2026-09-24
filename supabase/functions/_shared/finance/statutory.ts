// D2 — statutory payroll deductions (EPF / SOCSO / EIS): computed on the fly,
// never stored. spec 2026-09-25-cfp-p2b-standing-items-design.md 决策 6.
// EPF Third Schedule banding + SOCSO/EIS band-midpoint formula added for the
// cash-flow correctness fix (see docs plan for the P2b-followup task).
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
// Malaysia, private-sector employee:
//
//   EPF   the Third Schedule: wages are rounded UP into a band (RM20 bands to
//         RM5,000, RM100 bands to RM20,000, exact above that) before the rate
//         is applied, and each side's contribution itself rounds UP to the
//         next ringgit. Employer rate is 13%/12% (≤/> RM5,000 "regular wage"
//         per month, excluding bonus), both 0%/4% at age ≥60. Employee side
//         is a cash-flow item (`epf_employee`, O1 — a TRANSFER, not spending:
//         it is still the client's own money). Employer side never reaches
//         the client's pocket, so it is never a cash-flow item — only a
//         number (`employer_epf_monthly`) for whoever reconciles net worth
//         (P4). A bonus (or any other non-monthly EPF-able item) is NOT
//         folded into the regular wage before banding — it adds its own
//         marginal contribution, per occurrence: EPF(W + occurrence) −
//         EPF(W), summed and divided by 12 (see epfMarginalMonthly below).
//   SOCSO/EIS  employee 0.5% + 0.2% of the RM100 band's MIDPOINT (band upper
//         − 50), capped at the top band's midpoint (RM5,950, i.e. any wage
//         above RM5,900 caps out there); below RM300 there is no published
//         band, so this falls back to a flat percentage of the wage,
//         flagged as an approximation. 0% at age ≥60. A real expense
//         (`socso_eis`, O9) — it leaves the client's pocket and never comes
//         back the way EPF does.
//
// Every item below carries the Chinese note 「按法定比例估算」 — advisors are
// told this is an estimate, never a claim of payroll-exact precision.

import { activeItems, itemMonthlyAmount, type StandingItem } from "../cashflow/items.ts";

export const EPF_EMPLOYEE_RATE = 0.11;
export const EPF_EMPLOYEE_RATE_SENIOR = 0;
export const EPF_EMPLOYER_RATE_LOW = 0.13;
export const EPF_EMPLOYER_RATE_HIGH = 0.12;
export const EPF_EMPLOYER_RATE_SENIOR = 0.04;
/** 常规月薪 (excluding bonus) at or below this uses the higher employer rate. */
export const EPF_EMPLOYER_WAGE_THRESHOLD = 5000;

/** EPF Third Schedule band boundaries (决策 6 followup): RM20 bands to this
 *  wage, then RM100 bands to EPF_SCHEDULE_HIGH_BAND_CEILING, exact above it.
 *  Wages at or below this floor contribute nothing. */
export const EPF_SCHEDULE_ZERO_FLOOR = 10;
export const EPF_SCHEDULE_LOW_BAND_CEILING = 5000;
export const EPF_SCHEDULE_HIGH_BAND_CEILING = 20000;

export const SOCSO_EMPLOYEE_RATE = 0.005;
export const EIS_EMPLOYEE_RATE = 0.002;
/** Kept for compatibility — the nominal monthly wage ceiling (Oct 2024
 *  onward). The actual per-employee cap applied is the top band's MIDPOINT,
 *  SOCSO_EIS_TOP_BAND_MIDPOINT below (any wage from RM5,901 up reads the same
 *  top-band midpoint as a wage of exactly RM6,000 would). */
export const SOCSO_EIS_WAGE_CEILING = 6000;
/** RM100-band midpoint (band upper − 50) of the top band — the SOCSO/EIS
 *  contribution never uses a midpoint above this, however high the wage. */
export const SOCSO_EIS_TOP_BAND_MIDPOINT = SOCSO_EIS_WAGE_CEILING - 50;
/** Below this wage there is no published SOCSO/EIS band; the flat-percentage
 *  fallback below is used instead, and flagged as an approximation. */
export const SOCSO_EIS_LOW_WAGE_THRESHOLD = 300;

/** 60th birthday: employee EPF drops to 0%, employer to 4%, SOCSO/EIS to 0%. */
export const STATUTORY_SENIOR_AGE = 60;

export const STATUTORY_NOTE = "按法定比例估算";
/** Attached (in addition to STATUTORY_NOTE) to a socso_eis item computed via
 *  the sub-RM300 flat-percentage fallback — there is no official band down
 *  there, so the figure is a plain percentage, not a table lookup. */
export const SOCSO_EIS_LOW_WAGE_NOTE = "月薪低于 RM300，SOCSO/EIS 按比例估算，非官方分级表数值";

/** 决策 6: the EPF wage base — salary_basic + fixed_allowance + commission +
 *  bonus, excluding overtime. */
const EPF_WAGE_CATEGORIES = ["salary_basic", "fixed_allowance", "commission", "bonus"];
/** The "常规月薪" the EMPLOYER RATE threshold is tested against, and the base
 *  ("W") the EPF Third Schedule bands directly — the same categories minus
 *  bonus, counted only from items that actually recur monthly. A bonus (or
 *  any other EPF-wage item that isn't paid monthly) never widens W itself;
 *  it only ever contributes through the per-occurrence marginal formula
 *  below, so an annual bonus can never push the client into the lower
 *  employer rate, and it is never banded together with the regular wage. */
const REGULAR_WAGE_CATEGORIES = ["salary_basic", "fixed_allowance", "commission"];
/** SOCSO/EIS wage base — salary_basic + fixed_allowance + commission +
 *  overtime (bonus excluded — SOCSO/EIS is not charged on bonus). */
const SOCSO_EIS_WAGE_CATEGORIES = ["salary_basic", "fixed_allowance", "commission", "overtime"];

/** How many times a year a non-monthly EPF-wage item's occurrence repeats.
 *  A verbatim local mirror of periods.ts's ANNUAL_OCCURRENCES table — this
 *  file may import only items.ts (which doesn't re-export the table), so the
 *  handful of values used here are duplicated rather than imported. Kept in
 *  sync by pinning both to the same numbers this project has used since the
 *  original CASHFLOW_ANNUALIZE table (periods.ts, baseline.ts). */
const FREQUENCY_OCCURRENCES_PER_YEAR: Record<string, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  one_off: 0,
};

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

/**
 * The Third Schedule's band UPPER LIMIT for a given wage: wages at or below
 * RM10 contribute nothing; up to RM5,000 the band is RM20 wide; up to
 * RM20,000 it's RM100 wide; above that EPF is charged on the exact wage
 * (决策 6 followup, official Third Schedule rule).
 */
function epfBandUpper(wage: number): number {
  const w = Math.max(0, wage);
  if (w <= EPF_SCHEDULE_ZERO_FLOOR) return 0;
  if (w <= EPF_SCHEDULE_LOW_BAND_CEILING) return Math.ceil(w / 20) * 20;
  if (w <= EPF_SCHEDULE_HIGH_BAND_CEILING) return Math.ceil(w / 100) * 100;
  return w;
}

/** One side's (employee or employer) EPF contribution at `wage`: the band's
 *  upper limit times `rate`, rounded UP to the next ringgit. */
function epfSide(wage: number, rate: number): number {
  return roundUpToRinggit(epfBandUpper(wage) * rate);
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

/** The regular monthly wage "W" the Third Schedule bands directly: active,
 *  inflow, MONTHLY-frequency items in `categories` only. Anything paid on a
 *  different cadence (an annual bonus, a quarterly one-off commission, …) is
 *  never linearly folded in here — see epfMarginalMonthly. */
function sumRegularMonthlyWage(items: StandingItem[], asOf: Date, categories: string[]): number {
  let total = 0;
  for (const item of activeItems(items ?? [], asOf)) {
    if (item.direction !== "inflow") continue;
    if (!categories.includes(item.category)) continue;
    if ((item.frequency ?? "monthly") !== "monthly") continue;
    total += itemMonthlyAmount(item); // identity for a monthly item
  }
  return total;
}

/**
 * 决策 6 followup: the marginal EPF contributed by every active, non-monthly
 * EPF-wage item (a bonus, or any other EPF-able category paid on some other
 * cadence) — EPF(W + one occurrence's amount) − EPF(W), for EACH occurrence
 * in the year, divided by 12. `rate` is fixed at whatever the regular wage W
 * already determined (senior / ≤5,000 / >5,000) — a bonus never changes
 * which employer rate applies, it only ever adds on top of it.
 */
function epfMarginalMonthly(
  items: StandingItem[],
  asOf: Date,
  W: number,
  rate: number,
): number {
  let delta = 0;
  for (const item of activeItems(items ?? [], asOf)) {
    if (item.direction !== "inflow") continue;
    if (!EPF_WAGE_CATEGORIES.includes(item.category)) continue;
    const freq = item.frequency ?? "monthly";
    if (freq === "monthly") continue; // already counted in W
    const occurrences = FREQUENCY_OCCURRENCES_PER_YEAR[freq] ?? 12;
    if (occurrences <= 0) continue; // one_off: no recurring EPF wage
    const amount = Number(item.amount);
    const perOccurrence = Number.isFinite(amount) ? amount : 0;
    const marginalPerOccurrence = epfSide(W + perOccurrence, rate) - epfSide(W, rate);
    delta += (occurrences * marginalPerOccurrence) / 12;
  }
  return delta;
}

/**
 * SOCSO/EIS employee contribution at `wage`: the RM100 band's MIDPOINT (band
 * upper − 50), capped at the top band's midpoint, times the employee rate.
 * Below RM300 there is no published band — a flat percentage of the wage is
 * used instead and flagged `approx: true`.
 */
function socsoEisContribution(wage: number): { socso: number; eis: number; approx: boolean } {
  const w = Math.max(0, wage);
  if (w <= 0) return { socso: 0, eis: 0, approx: false };
  if (w <= SOCSO_EIS_LOW_WAGE_THRESHOLD) {
    return {
      socso: round2(w * SOCSO_EMPLOYEE_RATE),
      eis: round2(w * EIS_EMPLOYEE_RATE),
      approx: true,
    };
  }
  const midpoint = Math.min(Math.ceil(w / 100) * 100 - 50, SOCSO_EIS_TOP_BAND_MIDPOINT);
  return {
    socso: round2(midpoint * SOCSO_EMPLOYEE_RATE),
    eis: round2(midpoint * EIS_EMPLOYEE_RATE),
    approx: false,
  };
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

  // Reporting-only figure (决策 6, unchanged definition): the full EPF wage
  // base, bonus linearly averaged in — printed/pinned as `epf_wage_monthly`,
  // never fed into the Third Schedule banding itself (that uses W below).
  const epfWage = sumWage(items, asOf, EPF_WAGE_CATEGORIES);
  if (epfWage <= 0) return nothing;

  const W = sumRegularMonthlyWage(items, asOf, REGULAR_WAGE_CATEGORIES);
  const socsoEisWage = sumWage(items, asOf, SOCSO_EIS_WAGE_CATEGORIES);

  const age = ageAt(client.date_of_birth, asOf);
  const isSenior = age != null && age >= STATUTORY_SENIOR_AGE;

  const employeeRate = isSenior ? EPF_EMPLOYEE_RATE_SENIOR : EPF_EMPLOYEE_RATE;
  const employerRate = isSenior
    ? EPF_EMPLOYER_RATE_SENIOR
    : W <= EPF_EMPLOYER_WAGE_THRESHOLD
      ? EPF_EMPLOYER_RATE_LOW
      : EPF_EMPLOYER_RATE_HIGH;

  const employeeEpf = round2(
    epfSide(W, employeeRate) + epfMarginalMonthly(items, asOf, W, employeeRate),
  );
  const employerEpf = round2(
    epfSide(W, employerRate) + epfMarginalMonthly(items, asOf, W, employerRate),
  );

  let socsoEis = 0;
  let socsoEisApprox = false;
  if (!isSenior) {
    const contrib = socsoEisContribution(socsoEisWage);
    socsoEis = round2(contrib.socso + contrib.eis);
    socsoEisApprox = contrib.approx;
  }

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
      warnings: socsoEisApprox ? [STATUTORY_NOTE, SOCSO_EIS_LOW_WAGE_NOTE] : [STATUTORY_NOTE],
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
