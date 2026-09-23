// P2a derived cash-flow items — installments and premiums computed from their
// source (liabilities / policies) instead of re-keyed by hand.
// spec 2026-09-24-cfp-p2a-linked-obligations-design.md 决策 1, 3, 4, 5.
//
// Imports are relative-with-`.ts` only, and only from the four modules the
// spec names: ../taxonomy/balance.ts, ../taxonomy/cashflow.ts,
// ../cashflow/periods.ts, ./loans.ts. (Contrast with loans.ts and the taxonomy
// modules themselves, which must have ZERO imports — this file is allowed a
// small, fixed set.)

import { liabilityTypeMeta } from "../taxonomy/balance.ts";
import { CATEGORY_BY_CODE } from "../taxonomy/cashflow.ts";
import { annualizeCashflow, isTransferCode, type CashflowBasis, type CashflowTotals, type PeriodRow } from "../cashflow/periods.ts";
import { estimateLoan, type LoanInput } from "./loans.ts";

export type LiabilityRow = LoanInput & { id?: string | null; name?: string | null };

export interface PolicyRow {
  id?: string | null;
  policy_type: string;
  plan_name?: string | null;
  provider?: string | null;
  premium?: number | null;
  premium_frequency?: string | null;
  end_date?: string | null;
}

export interface DerivedItem {
  key: string;
  source_type: "liability" | "policy";
  source_id: string | null;
  source_name: string;
  category: string;
  direction: "outflow";
  monthly_amount: number;
  interest_monthly: number;
  principal_monthly: number;
  estimated: Array<"monthly_payment" | "interest_rate" | "remaining_months">;
  warnings: string[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** How many times a year a premium is billed. Mirrors PREMIUM_ANNUALIZE in
 *  ../insurance/mapping.ts, kept as a local literal because that module is
 *  outside this file's allowed import list. */
const PREMIUM_OCCURRENCES: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  single_premium: 0,
};

/** 决策 3: policy_type → the O3 (or O4 for property) premium category. */
export function premiumCategoryOf(policy_type: string): string {
  switch (policy_type) {
    case "life":
      return "life_takaful";
    case "investment_linked":
      return "savings_plan_premium";
    case "medical":
      return "medical_card";
    case "critical_illness":
      return "critical_illness";
    case "accident":
      return "personal_accident";
    case "property":
      return "home_insurance";
    default:
      return "protection_other";
  }
}

function isExpired(endDate: string | null | undefined, today: Date): boolean {
  if (!endDate) return false;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return false;
  const cutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return end.getTime() < cutoff.getTime();
}

/** 决策 3: one derived item per liability that carries a monthly payment.
 * Liabilities whose type has no `installment_category` (policy_loan, or an
 * unrecognised type) produce nothing — there is no category to file them
 * under. Credit cards record only the INTEREST as `finance_charges` (the
 * purchases were already booked to their own category; repaying them is a
 * transfer) — same treatment as the true interest_only types (overdraft,
 * share_margin), whose installment_category already points at their interest
 * category (finance_charges / share_margin_interest respectively). */
export function deriveLoanItems(liabilities: LiabilityRow[], today: Date = new Date()): DerivedItem[] {
  const items: DerivedItem[] = [];
  for (const l of liabilities ?? []) {
    const meta = liabilityTypeMeta(l.liability_type);
    if (!meta || meta.installment_category == null) continue;

    const est = estimateLoan(l, today);
    const isCreditCard = l.liability_type === "credit_card";
    const category = isCreditCard ? "finance_charges" : meta.installment_category;
    const interestOnlyAmount = isCreditCard || est.rate_type === "interest_only";
    const amount = interestOnlyAmount ? est.interest_monthly : est.monthly_payment;

    items.push({
      key: `liability:${l.id ?? l.name ?? l.liability_type}`,
      source_type: "liability",
      source_id: l.id ?? null,
      source_name: l.name ?? meta.label_zh,
      category,
      direction: "outflow",
      monthly_amount: round2(amount),
      interest_monthly: est.interest_monthly,
      principal_monthly: est.principal_monthly,
      estimated: est.estimated,
      warnings: est.warnings,
    });
  }
  return items;
}

/** 决策 3: one derived item per non-expired policy with a non-zero premium.
 * Uses only the policy's own `premium` (never rider premiums — same basis as
 * the tax/insurance modules). single_premium policies annualise to 0 and are
 * skipped, same as an expired policy. */
export function derivePremiumItems(policies: PolicyRow[], today: Date = new Date()): DerivedItem[] {
  const items: DerivedItem[] = [];
  for (const p of policies ?? []) {
    if (isExpired(p.end_date, today)) continue;

    const occurrences = PREMIUM_OCCURRENCES[p.premium_frequency ?? "annual"] ?? 12;
    const monthly = round2(((p.premium ?? 0) * occurrences) / 12);
    if (monthly === 0) continue;

    items.push({
      key: `policy:${p.id ?? p.plan_name ?? p.policy_type}`,
      source_type: "policy",
      source_id: p.id ?? null,
      source_name: p.plan_name ?? p.provider ?? p.policy_type,
      category: premiumCategoryOf(p.policy_type),
      direction: "outflow",
      monthly_amount: monthly,
      interest_monthly: 0,
      principal_monthly: 0,
      estimated: [],
      warnings: [],
    });
  }
  return items;
}

/**
 * 决策 4: does a manually-keyed cash-flow row now duplicate a derived item?
 * Matching is BY CATEGORY, never a blanket "any O2/O3 row is out":
 *   - O2 SPLIT categories (the *_installment codes, bnpl_payment,
 *     family_loan_repayment, debt_other — NOT credit_card_payment /
 *     finance_charges / share_margin_interest, which aren't `split`): superseded
 *     when the client has a liability whose installment_category matches, OR
 *     the row is the catch-all `debt_other` and the client has ANY liability
 *     that produces an installment.
 *   - O3 categories: superseded when the client has a policy mapping to the
 *     same category, OR the row is the catch-all `protection_other` and the
 *     client has ANY policy.
 */
export function isSuperseded(
  row: { category?: string | null },
  liabilities: LiabilityRow[],
  policies: PolicyRow[],
): boolean {
  const code = row.category;
  if (!code) return false;
  const cat = CATEGORY_BY_CODE[code];
  if (!cat) return false;

  if (cat.group === "O2" && cat.wealth_effect === "split") {
    const liabilityCategories = new Set(
      (liabilities ?? [])
        .map((l) => liabilityTypeMeta(l.liability_type)?.installment_category)
        .filter((c): c is string => c != null),
    );
    if (liabilityCategories.has(code)) return true;
    if (code === "debt_other" && liabilityCategories.size > 0) return true;
    return false;
  }

  if (cat.group === "O3") {
    const policyCategories = new Set((policies ?? []).map((p) => premiumCategoryOf(p.policy_type)));
    if (policyCategories.has(code)) return true;
    if (code === "protection_other" && (policies?.length ?? 0) > 0) return true;
    return false;
  }

  return false;
}

export interface PlanCashflowInput {
  rows: PeriodRow[];
  liabilities: LiabilityRow[];
  policies: PolicyRow[];
  basis: CashflowBasis | null;
  today?: Date;
}

export interface PlanCashflowResult {
  totals: CashflowTotals;
  derived: DerivedItem[];
  superseded: PeriodRow[];
  monthly_debt_service: number;
  monthly_principal: number;
  monthly_interest: number;
  monthly_premiums: number;
}

/**
 * 决策 5: totals = retained manual rows (periods.annualizeCashflow, same
 * basis as always) + derived items × 12 (transfer-category derived items, if
 * any ever exist, excluded). Cash view: the full installment counts as
 * spending, even though technically principal is a transfer — `monthly_principal`
 * is exposed separately for whoever needs the wealth-building view later.
 * `monthly_debt_service` sums every liability's FULL estimated payment
 * (credit card = its minimum payment; policy_loan excluded), independent of
 * the interest-only amount actually filed under `finance_charges`.
 */
export function planCashflow(input: PlanCashflowInput): PlanCashflowResult {
  const { rows, liabilities, policies, basis } = input;
  const today = input.today ?? new Date();

  const superseded: PeriodRow[] = [];
  const keptRows: PeriodRow[] = [];
  for (const r of rows ?? []) {
    if (isSuperseded(r, liabilities, policies)) superseded.push(r);
    else keptRows.push(r);
  }

  const baseTotals = annualizeCashflow(keptRows, basis);

  const loanItems = deriveLoanItems(liabilities, today);
  const premiumItems = derivePremiumItems(policies, today);
  const derived = [...loanItems, ...premiumItems];

  let derivedMonthlyExpense = 0;
  for (const item of derived) {
    if (isTransferCode(item.category)) continue;
    derivedMonthlyExpense += item.monthly_amount;
  }

  const monthly_expenses = round2(baseTotals.monthly_expenses + derivedMonthlyExpense);
  const annual_expenses = round2(baseTotals.annual_expenses + derivedMonthlyExpense * 12);

  const totals: CashflowTotals = {
    ...baseTotals,
    monthly_expenses,
    annual_expenses,
  };

  let monthly_debt_service = 0;
  let monthly_principal = 0;
  let monthly_interest = 0;
  for (const l of liabilities ?? []) {
    const meta = liabilityTypeMeta(l.liability_type);
    if (!meta || meta.installment_category == null) continue;
    const est = estimateLoan(l, today);
    monthly_debt_service += est.monthly_payment;
    monthly_principal += est.principal_monthly;
    monthly_interest += est.interest_monthly;
  }

  let monthly_premiums = 0;
  for (const item of premiumItems) monthly_premiums += item.monthly_amount;

  return {
    totals,
    derived,
    superseded,
    monthly_debt_service: round2(monthly_debt_service),
    monthly_principal: round2(monthly_principal),
    monthly_interest: round2(monthly_interest),
    monthly_premiums: round2(monthly_premiums),
  };
}
