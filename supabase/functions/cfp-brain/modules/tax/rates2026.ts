// Malaysian resident individual progressive tax bands, YA2026 — deterministic
// data only, no computation here. Re-check and bump the year comment whenever
// LHDN publishes updated bands/reliefs.

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
