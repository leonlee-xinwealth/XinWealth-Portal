// D1 loan estimator — spec 2026-09-24-cfp-p2a-linked-obligations-design.md 决策 2.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE MUST HAVE NO IMPORTS (the same contract as ../cashflow/periods.ts
// and ../taxonomy/*.ts — see periods.ts for why: Deno edge functions, the Vite
// browser bundle, plain Node scripts and esbuild's api/_lib/taxonomy.mjs bundle
// all resolve modules differently, and a file with zero imports is the only
// shape every runtime agrees on).
// ─────────────────────────────────────────────────────────────────────────────
//
// `interest_rate` (on the liability row, and on LoanInput here) is a PERCENT:
// 4.28 means 4.28% per year, not 0.0428. Every formula below divides by 1200
// (100 for percent → decimal, 12 for months) to get the monthly rate.
//
// Fill-what's-missing order (决策 2): balance+rate+months → payment;
// balance+payment+months → bisect for rate; balance+rate+payment → derive
// months. Months, when missing, is first read off `end_date`, then the
// per-type default. Whatever ends up NOT a literal input value is reported in
// `estimated[]`.

export type RateType = "reducing" | "flat" | "revolving" | "interest_only";

export interface LoanInput {
  liability_type: string;
  outstanding_balance: number;
  interest_rate?: number | null;
  monthly_payment?: number | null;
  remaining_months?: number | null;
  rate_type?: RateType | null;
  original_principal?: number | null;
  end_date?: string | null;
}

export interface LoanEstimate {
  monthly_payment: number;
  annual_rate_pct: number;
  remaining_months: number | null;
  rate_type: RateType;
  interest_monthly: number;
  principal_monthly: number;
  estimated: Array<"monthly_payment" | "interest_rate" | "remaining_months">;
  warnings: string[];
}

/**
 * Per liability_type default (annual rate %, remaining months, amortisation
 * style). `policy_loan` is explicitly `null` — spec: "不产生现金流" (it never
 * produces a cash-flow item). A liability_type with no entry here falls back
 * to `other`.
 */
export const LOAN_DEFAULTS: Record<
  string,
  { rate_pct: number; months: number | null; rate_type: RateType } | null
> = {
  mortgage: { rate_pct: 4.2, months: 300, rate_type: "reducing" },
  car_loan: { rate_pct: 3.0, months: 60, rate_type: "flat" },
  personal_loan: { rate_pct: 8, months: 60, rate_type: "reducing" },
  study_loan: { rate_pct: 1, months: 120, rate_type: "reducing" },
  renovation_loan: { rate_pct: 7, months: 60, rate_type: "reducing" },
  business_loan: { rate_pct: 7, months: 60, rate_type: "reducing" },
  asb_financing: { rate_pct: 4.5, months: 120, rate_type: "reducing" },
  family_loan: { rate_pct: 0, months: 36, rate_type: "reducing" },
  bnpl: { rate_pct: 0, months: 6, rate_type: "reducing" },
  tax_payable: { rate_pct: 0, months: 12, rate_type: "reducing" },
  other: { rate_pct: 6, months: 60, rate_type: "reducing" },
  credit_card: { rate_pct: 18, months: null, rate_type: "revolving" },
  overdraft: { rate_pct: 8, months: null, rate_type: "interest_only" },
  share_margin: { rate_pct: 6, months: null, rate_type: "interest_only" },
  policy_loan: null,
};

const WARN_PAYMENT_BELOW_INTEREST = "月供不足以支付当期利息，余额或利率可能有误";
const WARN_PAYMENT_TERM_SHORTFALL = "月供 × 剩余期数小于余额，数据可能有误";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Whole months from `today` to `end_date` (partial months dropped). null when
 *  unusable or not in the future. */
function monthsUntilEndDate(endDate: string | null | undefined, today: Date): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return null;
  const months =
    (end.getUTCFullYear() - today.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - today.getUTCMonth()) -
    (end.getUTCDate() < today.getUTCDate() ? 1 : 0);
  return months > 0 ? months : null;
}

/** Standard reducing-balance installment: P = B·r / (1 − (1+r)^−n), r monthly. */
function reducingPayment(balance: number, rMonthly: number, months: number): number {
  const n = Math.max(months, 1);
  if (rMonthly <= 0) return balance / n;
  return (balance * rMonthly) / (1 - Math.pow(1 + rMonthly, -n));
}

/** n = −ln(1 − B·r/P) / ln(1+r). null when P can't even cover interest. */
function monthsFromRatePayment(balance: number, rMonthly: number, payment: number): number | null {
  if (rMonthly <= 0) return payment > 0 ? balance / payment : null;
  if (payment <= balance * rMonthly) return null;
  return -Math.log(1 - (balance * rMonthly) / payment) / Math.log(1 + rMonthly);
}

/** Bisect the annual rate % (0–60) that reproduces `payment` over `months`. */
function solveRatePct(balance: number, payment: number, months: number): number {
  let lo = 0;
  let hi = 60;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const implied = reducingPayment(balance, mid / 1200, months);
    if (implied > payment) hi = mid;
    else lo = mid;
  }
  return Math.round(((lo + hi) / 2) * 10000) / 10000;
}

export function estimateLoan(input: LoanInput, today: Date = new Date()): LoanEstimate {
  const balanceNum = Number(input.outstanding_balance);
  const B = Number.isFinite(balanceNum) ? balanceNum : 0;

  const rawDefaults = Object.prototype.hasOwnProperty.call(LOAN_DEFAULTS, input.liability_type)
    ? LOAN_DEFAULTS[input.liability_type]
    : LOAN_DEFAULTS.other;

  const rateType: RateType = input.rate_type ?? rawDefaults?.rate_type ?? "reducing";

  const zero = (): LoanEstimate => ({
    monthly_payment: 0,
    annual_rate_pct: 0,
    remaining_months: 0,
    rate_type: rateType,
    interest_monthly: 0,
    principal_monthly: 0,
    estimated: [],
    warnings: [],
  });

  // Zero/negative balance, or a type that spec says produces no cash flow
  // (policy_loan): all zeros, no warnings, nothing estimated.
  if (B <= 0 || rawDefaults === null) return zero();

  const hasRate = input.interest_rate != null;
  const hasPayment = input.monthly_payment != null;
  const hasMonths = input.remaining_months != null;
  const warnings: string[] = [];

  const resolveDefaultMonths = (): number | null => {
    const fromEnd = monthsUntilEndDate(input.end_date, today);
    return fromEnd != null ? fromEnd : rawDefaults.months;
  };

  let months: number | null;
  let ratePct: number;
  let payment: number;
  let interestMonthly: number;
  let principalMonthly: number;

  if (rateType === "reducing") {
    // Months: literal > (defer to derive from rate+payment) > end_date > default.
    if (hasMonths) {
      months = input.remaining_months!;
    } else if (hasRate && hasPayment) {
      months = null; // resolved below, once rate is fixed (case: 有余额+利率+月供→推期数)
    } else {
      months = resolveDefaultMonths();
    }

    // Rate: literal > bisected from payment+months (case: 有余额+月供+期数→反推利率) > default.
    ratePct = hasRate ? input.interest_rate! : (hasPayment && months != null ? solveRatePct(B, input.monthly_payment!, months) : rawDefaults.rate_pct);
    const rMonthly = ratePct / 1200;

    if (months == null && hasRate && hasPayment) {
      const derived = monthsFromRatePayment(B, rMonthly, input.monthly_payment!);
      months = derived != null ? Math.max(1, Math.round(derived)) : null;
    }

    // Payment: literal > computed from rate+months (case: 有余额+利率+期数→算月供).
    payment = hasPayment ? input.monthly_payment! : reducingPayment(B, rMonthly, months ?? rawDefaults.months ?? 1);

    interestMonthly = B * rMonthly;
    principalMonthly = Math.max(0, payment - interestMonthly);

    if (payment <= interestMonthly) warnings.push(WARN_PAYMENT_BELOW_INTEREST);
    if (months != null && payment * months < B * 0.98) warnings.push(WARN_PAYMENT_TERM_SHORTFALL);
  } else if (rateType === "flat") {
    // 车贷平息: interest is a fixed % of the ORIGINAL principal, not the
    // declining balance. Months follow the ordinary literal/end_date/default
    // chain — spec gives no bisection/derivation rule for flat loans.
    months = hasMonths ? input.remaining_months! : resolveDefaultMonths();
    ratePct = hasRate ? input.interest_rate! : rawDefaults.rate_pct;
    const rMonthly = ratePct / 1200;
    const base = input.original_principal ?? B;
    interestMonthly = base * rMonthly;

    const n = months ?? 1;
    payment = hasPayment ? input.monthly_payment! : B / Math.max(n, 1) + interestMonthly;
    principalMonthly = Math.max(0, payment - interestMonthly);

    if (months != null && payment * months < B * 0.98) warnings.push(WARN_PAYMENT_TERM_SHORTFALL);
  } else if (rateType === "revolving") {
    // 信用卡: minimum payment = max(5% of balance, RM50), never more than the
    // balance itself.
    months = hasMonths ? input.remaining_months! : resolveDefaultMonths();
    ratePct = hasRate ? input.interest_rate! : rawDefaults.rate_pct;
    const rMonthly = ratePct / 1200;
    interestMonthly = B * rMonthly;

    const minPayment = Math.min(B, Math.max(B * 0.05, 50));
    payment = hasPayment ? input.monthly_payment! : minPayment;
    principalMonthly = Math.max(0, payment - interestMonthly);

    if (months != null && payment * months < B * 0.98) warnings.push(WARN_PAYMENT_TERM_SHORTFALL);
  } else {
    // interest_only (overdraft, share_margin): the payment IS the interest;
    // principal is never repaid through the cash-flow.
    months = hasMonths ? input.remaining_months! : resolveDefaultMonths();
    ratePct = hasRate ? input.interest_rate! : rawDefaults.rate_pct;
    const rMonthly = ratePct / 1200;
    interestMonthly = B * rMonthly;

    payment = hasPayment ? input.monthly_payment! : interestMonthly;
    principalMonthly = Math.max(0, payment - interestMonthly);

    if (months != null && payment * months < B * 0.98) warnings.push(WARN_PAYMENT_TERM_SHORTFALL);
  }

  const estimated: LoanEstimate["estimated"] = [];
  if (!hasPayment) estimated.push("monthly_payment");
  if (!hasRate) estimated.push("interest_rate");
  if (!hasMonths && months != null) estimated.push("remaining_months");

  return {
    monthly_payment: round2(payment),
    annual_rate_pct: ratePct,
    remaining_months: months,
    rate_type: rateType,
    interest_monthly: round2(interestMonthly),
    principal_monthly: round2(principalMonthly),
    estimated,
    warnings,
  };
}
