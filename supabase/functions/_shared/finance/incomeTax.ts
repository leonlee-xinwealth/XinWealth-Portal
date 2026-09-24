// Malaysian resident individual income tax — YA2026 bands/reliefs, and the
// shared "taxable income from standing items" definition that both the
// cash-flow estimate (derived.ts) and the tax report (cfp-brain/modules/
// tax/calc.ts) now read from, so the two never disagree.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE MUST HAVE ZERO IMPORTS — the same contract as ../cashflow/
// periods.ts and ../taxonomy/cashflow.ts. It is loaded by Deno edge
// functions, the Vite browser bundle, plain Node/tsx scripts, and (through
// the committed api/_lib/taxonomy.mjs bundle) Vercel functions — four
// runtimes that resolve modules differently, and a file with zero imports is
// the only shape all of them agree on.
//
// Two consequences of that:
//   1. The category lists below (TAXABLE_I1_CATEGORIES, RENTAL_INCOME_
//      CATEGORY) are a LOCAL, hand-kept mirror of taxonomy/cashflow.ts's I1
//      group and its `rental_income` row, not an import of it. incomeTax.
//      test.ts (a separate file, free to import whatever it needs) pins
//      this list against the live taxonomy so the two can never silently
//      drift apart.
//   2. `TaxItem`/`TaxPolicy` below are small structural types — NOT imports
//      of cashflow/items.ts's StandingItem or derived.ts's PolicyRow — and
//      the active-item/monthly-equivalent helpers are local, verbatim
//      mirrors of items.ts's isActiveAt/itemMonthlyAmount. Every caller's
//      real StandingItem/PolicyRow values are structurally assignable into
//      these without an import, exactly like statutory.ts's own local
//      StatutoryDerivedItem mirror.
// ─────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Progressive tax bands, reliefs, rebate — re-checked/bumped whenever LHDN
// publishes updated figures. (Historically lived in cfp-brain/modules/tax/
// rates2026.ts; moved here so the cash-flow estimate can use the identical
// numbers without cfp-brain/modules/tax being importable from _shared.)
// ---------------------------------------------------------------------------

export interface TaxBand {
  /** upper bound of chargeable income for this band; null = no ceiling */
  up_to: number | null;
  rate: number;
}

export const TAX_BANDS: TaxBand[] = [
  { up_to: 5000, rate: 0 },
  { up_to: 20000, rate: 0.01 },
  { up_to: 35000, rate: 0.03 },
  { up_to: 50000, rate: 0.06 },
  { up_to: 70000, rate: 0.11 },
  { up_to: 100000, rate: 0.19 },
  { up_to: 400000, rate: 0.25 },
  { up_to: 600000, rate: 0.26 },
  { up_to: 2000000, rate: 0.28 },
  { up_to: null, rate: 0.30 },
];

export const NON_RESIDENT_FLAT_RATE = 0.30;

/** Chargeable income at/below this gets an RM400 rebate (tax floored at 0). */
export const REBATE_THRESHOLD = 35000;
export const REBATE_AMOUNT = 400;

export type ReliefAutoSource = "always" | "epf" | "life_premium" | "none";

export interface ReliefBand {
  key: string;
  label_zh: string;
  cap: number;
  auto: ReliefAutoSource;
}

export const RELIEFS: ReliefBand[] = [
  { key: "personal", label_zh: "个人及受扶养亲属", cap: 9000, auto: "always" },
  { key: "epf", label_zh: "EPF 雇员公积金", cap: 4000, auto: "epf" },
  { key: "life_insurance", label_zh: "人寿保险保费", cap: 3000, auto: "life_premium" },
  { key: "medical_insurance", label_zh: "医疗/教育保险保费", cap: 3000, auto: "none" },
  { key: "prs", label_zh: "私人退休计划 PRS", cap: 3000, auto: "none" },
  { key: "lifestyle", label_zh: "生活方式", cap: 2500, auto: "none" },
  { key: "sspn", label_zh: "SSPN 教育储蓄", cap: 8000, auto: "none" },
  { key: "medical_expenses", label_zh: "医疗费用（严重疾病等）", cap: 8000, auto: "none" },
];

/** Cumulative progressive tax over TAX_BANDS for a resident individual. */
export function progressiveTax(chargeableIncome: number): number {
  if (chargeableIncome <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const band of TAX_BANDS) {
    const upper = band.up_to ?? Infinity;
    if (chargeableIncome <= lower) break;
    const taxableInBand = Math.min(chargeableIncome, upper) - lower;
    tax += taxableInBand * band.rate;
    lower = upper;
  }
  return tax;
}

/** Marginal rate: the rate of the band the chargeable income falls into. */
export function marginalRateFor(chargeableIncome: number): number {
  if (chargeableIncome <= 0) return 0;
  for (const band of TAX_BANDS) {
    const upper = band.up_to ?? Infinity;
    if (chargeableIncome <= upper) return band.rate;
  }
  return TAX_BANDS[TAX_BANDS.length - 1].rate;
}

/** RM400 rebate when chargeable income ≤ RM35,000 (tax floored at 0);
 *  otherwise `tax` unchanged. Applies to residents only — a non-resident's
 *  flat 30% never gets this rebate (see estimateIncomeTax below). */
export function taxAfterRebate(tax: number, chargeableIncome: number): number {
  if (chargeableIncome <= REBATE_THRESHOLD) {
    return Math.max(0, tax - REBATE_AMOUNT);
  }
  return tax;
}

// ---------------------------------------------------------------------------
// Detectable reliefs by cash-flow category (moved here from cfp-brain/
// modules/tax/calc.ts, which now imports it instead of defining it locally —
// so the items-path relief scan below and the report's cash-flow-based scan
// use the exact same mapping).
// ---------------------------------------------------------------------------

export type DetectableReliefKey =
  | "medical_insurance"
  | "medical_expenses"
  | "sspn"
  | "prs"
  | "lifestyle";

export const RELIEF_BY_CATEGORY: Readonly<Record<string, DetectableReliefKey>> = {
  medical_card: "medical_insurance",
  health_medical: "medical_expenses",
  sspn: "sspn",
  prs_contribution: "prs",
  fitness: "lifestyle",
  self_education: "lifestyle",
  telco: "lifestyle",
  subscriptions: "lifestyle",
};

// ---------------------------------------------------------------------------
// Taxable income from standing items — the shared 口径 both derived.ts (the
// cash-flow tax estimate) and cfp-brain/modules/tax/calc.ts (the report) use.
// I1 (主动收入) except employer_epf (never reaches the employee), plus
// rental_income at GROSS (租金按总额估算，未扣可扣除费用 — no deductible
// expenses are modelled). Dividends, interest, transfers and every other I2/
// I3/I4 category are excluded: exempt, or not income at all.
// ---------------------------------------------------------------------------

/** I1 group's codes, taxonomy/cashflow.ts, minus employer_epf. Pinned against
 *  the live taxonomy by a test in incomeTax.test.ts (this file may not import
 *  it — see the file header). */
export const TAXABLE_I1_CATEGORIES: readonly string[] = [
  "salary_basic",
  "fixed_allowance",
  "overtime",
  "bonus",
  "commission",
  "director_fee",
  "business_income",
  "side_income",
  "active_income_other",
];

/** I2's rental_income — the one non-I1 category taxable income also counts,
 *  at gross. */
export const RENTAL_INCOME_CATEGORY = "rental_income";

/** A structural mirror of cashflow/items.ts's StandingItem — see file header. */
export interface TaxItem {
  direction: "inflow" | "outflow";
  category: string;
  amount: number;
  frequency: string;
  /** 'YYYY-MM-01' */
  effective_from: string;
  effective_to?: string | null;
}

/** A structural mirror of derived.ts's PolicyRow, narrowed to what a life
 *  insurance relief scan needs. */
export interface TaxPolicy {
  policy_type: string;
  premium?: number | null;
  premium_frequency?: string | null;
  status?: string | null;
  end_date?: string | null;
}

/** Verbatim local mirror of periods.ts's ANNUAL_OCCURRENCES / items.ts's
 *  itemMonthlyAmount table — duplicated, not imported, per the file header. */
const FREQUENCY_OCCURRENCES_PER_YEAR: Record<string, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  one_off: 0,
};

function monthStartLocal(d: Date | string): string {
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})/.exec(d);
    if (m) return `${m[1]}-${m[2]}-01`;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) {
      throw new Error(`incomeTax: unusable date "${d}"`);
    }
    return monthStartLocal(parsed);
  }
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${mo}-01`;
}

/** Verbatim local mirror of items.ts's isActiveAt. */
function isItemActiveAt(
  item: { effective_from: string; effective_to?: string | null },
  asOf: Date | string,
): boolean {
  const asOfMonth = monthStartLocal(asOf);
  if (item.effective_from > asOfMonth) return false;
  if (item.effective_to != null && item.effective_to < asOfMonth) return false;
  return true;
}

/** Verbatim local mirror of items.ts's itemMonthlyAmount. */
function itemMonthlyAmountLocal(item: { amount: number; frequency: string }): number {
  const occurrences = FREQUENCY_OCCURRENCES_PER_YEAR[item.frequency] ?? 12;
  const amount = Number(item.amount);
  const n = Number.isFinite(amount) ? amount : 0;
  return (n * occurrences) / 12;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const round = (n: number) => Math.round(n);

/** Monthly-equivalents×12 of every active inflow item in TAXABLE_I1_
 *  CATEGORIES plus rental_income (gross) — the shared taxable-income
 *  definition. */
export function taxableIncomeFromItems(items: readonly TaxItem[], asOf: Date = new Date()): number {
  let total = 0;
  for (const item of items ?? []) {
    if (item.direction !== "inflow") continue;
    if (!isItemActiveAt(item, asOf)) continue;
    const isI1 = TAXABLE_I1_CATEGORIES.includes(item.category);
    const isRental = item.category === RENTAL_INCOME_CATEGORY;
    if (!isI1 && !isRental) continue;
    total += itemMonthlyAmountLocal(item) * 12;
  }
  return round2(total);
}

/** Sum of matched RELIEF_BY_CATEGORY categories, annualised, from active
 *  standing items (mirrors cfp-brain/modules/tax/calc.ts's own
 *  detectReliefsFromCashflow, but off items instead of cashflow_entries).
 *  Transfers are included on purpose — SSPN/PRS deposits ARE the relief. */
export function detectReliefsFromItems(
  items: readonly TaxItem[],
  asOf: Date = new Date(),
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items ?? []) {
    if (!isItemActiveAt(item, asOf)) continue;
    const key = RELIEF_BY_CATEGORY[item.category];
    if (!key) continue;
    const annual = itemMonthlyAmountLocal(item) * 12;
    if (annual <= 0) continue;
    totals[key] = (totals[key] ?? 0) + annual;
  }
  return totals;
}

/** How many times a year a premium is billed — a local mirror of derived.ts's
 *  PREMIUM_OCCURRENCES (that file is outside this one's zero-import rule). */
const PREMIUM_OCCURRENCES: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  single_premium: 0,
};

const LIFE_RELIEF_POLICY_TYPES = ["life", "investment_linked"];

function isPolicyPremiumActive(status: string | null | undefined): boolean {
  return status == null || status === "in_force";
}

function isPolicyExpired(endDate: string | null | undefined, asOf: Date): boolean {
  if (!endDate) return false;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return false;
  const cutoff = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  return end.getTime() < cutoff.getTime();
}

/** Annual premiums of in-force, non-expired life/investment_linked policies —
 *  the life_insurance relief's basis. */
export function lifeInsurancePremiumAnnual(
  policies: readonly TaxPolicy[],
  asOf: Date = new Date(),
): number {
  let total = 0;
  for (const p of policies ?? []) {
    if (!LIFE_RELIEF_POLICY_TYPES.includes(p.policy_type)) continue;
    if (!isPolicyPremiumActive(p.status)) continue;
    if (isPolicyExpired(p.end_date, asOf)) continue;
    const occurrences = PREMIUM_OCCURRENCES[p.premium_frequency ?? "annual"] ?? 12;
    total += (p.premium ?? 0) * occurrences;
  }
  return round2(total);
}

// ---------------------------------------------------------------------------
// estimateIncomeTax — the one entry point derived.ts (cash-flow estimate) and
// the household `clients` map path both call.
// ---------------------------------------------------------------------------

export interface EstimateIncomeTaxInput {
  items: readonly TaxItem[];
  policies?: readonly TaxPolicy[];
  /** 12 × the client's actual statutory employee EPF (statutory.ts), so the
   *  relief uses the real figure instead of a re-derived guess. */
  employeeEpfAnnual?: number;
  nonResident?: boolean;
  asOf?: Date;
}

export interface IncomeTaxReliefLine {
  key: string;
  amount: number;
}

export interface EstimateIncomeTaxResult {
  annual_tax: number;
  monthly_tax: number;
  chargeable_income: number;
  taxable_income: number;
  reliefs: IncomeTaxReliefLine[];
  notes: string[];
}

/**
 * A deterministic, advisor-facing income tax ESTIMATE (not a PCB/CP500
 * calculation): personal + EPF + life-insurance reliefs, plus whatever
 * RELIEF_BY_CATEGORY detects from the client's own active standing items,
 * each capped per RELIEFS. Non-resident clients get the flat 30% with no
 * reliefs or rebate, per LHDN rules.
 */
export function estimateIncomeTax(input: EstimateIncomeTaxInput): EstimateIncomeTaxResult {
  const asOf = input.asOf ?? new Date();
  const items = input.items ?? [];
  const notes: string[] = [];

  const taxableIncome = taxableIncomeFromItems(items, asOf);
  const hasRental = items.some(
    (it) => it.category === RENTAL_INCOME_CATEGORY && it.direction === "inflow" && isItemActiveAt(it, asOf),
  );
  if (hasRental) notes.push("租金按总额估算，未扣可扣除费用");

  if (input.nonResident) {
    const tax = Math.max(0, round(taxableIncome * NON_RESIDENT_FLAT_RATE));
    notes.push("非居民：按应课税收入统一税率 30% 估算，不适用个人减免与回扣");
    return {
      annual_tax: tax,
      monthly_tax: round2(tax / 12),
      chargeable_income: taxableIncome,
      taxable_income: taxableIncome,
      reliefs: [],
      notes,
    };
  }

  const capByKey = new Map(RELIEFS.map((r) => [r.key, r.cap]));
  const reliefs: IncomeTaxReliefLine[] = [];

  reliefs.push({ key: "personal", amount: capByKey.get("personal") ?? 9000 });

  const epfCap = capByKey.get("epf") ?? 4000;
  const epfAmount = Math.min(epfCap, Math.max(0, round(input.employeeEpfAnnual ?? 0)));
  if (epfAmount > 0) reliefs.push({ key: "epf", amount: epfAmount });

  const lifeCap = capByKey.get("life_insurance") ?? 3000;
  const lifeAmount = Math.min(lifeCap, round(lifeInsurancePremiumAnnual(input.policies ?? [], asOf)));
  if (lifeAmount > 0) reliefs.push({ key: "life_insurance", amount: lifeAmount });

  const detected = detectReliefsFromItems(items, asOf);
  for (const key of Object.keys(detected)) {
    const cap = capByKey.get(key) ?? detected[key];
    const amount = Math.min(cap, round(detected[key]));
    if (amount > 0) reliefs.push({ key, amount });
  }

  const totalReliefs = reliefs.reduce((s, r) => s + r.amount, 0);
  const chargeableIncome = Math.max(0, round(taxableIncome - totalReliefs));

  const rawTax = round(progressiveTax(chargeableIncome));
  const tax = taxAfterRebate(rawTax, chargeableIncome);
  if (tax !== rawTax) {
    notes.push(`应课税收入 ≤ RM${REBATE_THRESHOLD.toLocaleString()}，已减免 RM${REBATE_AMOUNT}`);
  }

  return {
    annual_tax: tax,
    monthly_tax: round2(tax / 12),
    chargeable_income: chargeableIncome,
    taxable_income: taxableIncome,
    reliefs,
    notes,
  };
}
