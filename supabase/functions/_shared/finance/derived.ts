// P2a derived cash-flow items — installments and premiums computed from their
// source (liabilities / policies) instead of re-keyed by hand.
// spec 2026-09-24-cfp-p2a-linked-obligations-design.md 决策 1, 3, 4, 5.
// P2b extends this with standing items and statutory deductions —
// spec 2026-09-25-cfp-p2b-standing-items-design.md, Task A.
//
// Imports are relative-with-`.ts` only, and only from the modules the specs
// name: ../taxonomy/balance.ts, ../taxonomy/cashflow.ts, ../cashflow/periods.ts,
// ../cashflow/items.ts, ./loans.ts, ./statutory.ts. (Contrast with loans.ts,
// statutory.ts and the taxonomy modules themselves, which must have ZERO or a
// much narrower set of imports — this file is allowed the widest surface.)
// This file MAY import statutory.ts; statutory.ts MUST NOT import this file
// (that two-file cycle is exactly what every bundler here refuses to resolve).

import { liabilityTypeMeta } from "../taxonomy/balance.ts";
import { CATEGORY_BY_CODE } from "../taxonomy/cashflow.ts";
import { annualizeCashflow, isTransferCode, type CashflowBasis, type CashflowTotals, type PeriodRow } from "../cashflow/periods.ts";
import { activeItems, annualizeItems, type StandingItem } from "../cashflow/items.ts";
import { estimateLoan, type LoanInput } from "./loans.ts";
import { deriveStatutoryItems, type DeriveStatutoryResult, type StatutoryClientInfo } from "./statutory.ts";

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
  source_type: "liability" | "policy" | "statutory";
  source_id: string | null;
  source_name: string;
  category: string;
  direction: "outflow";
  monthly_amount: number;
  interest_monthly: number;
  principal_monthly: number;
  estimated: Array<"monthly_payment" | "interest_rate" | "remaining_months" | "statutory_rate">;
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
  /** P2b 决策 1: when this is a non-empty array, the plan is read from
   *  cashflow_items instead of averaging cashflow_entries actuals. */
  items?: StandingItem[];
  /** P2b 决策 6: only used on the items path (statutory needs standing salary
   *  items to compute a wage base from). Single-client reports only — a
   *  household report supplies `clients` instead (see below). */
  client?: StatutoryClientInfo;
  /** P2b 决策 6 (household): per-employee statutory info, keyed by client_id.
   *  SOCSO/EIS's wage ceiling and EPF's employer-rate threshold are each
   *  PER EMPLOYEE, so a joint plan must never pool both spouses' salaries into
   *  one wage base — that would misprice both of their statutory deductions.
   *  When this is given (household.ts merges each spouse's own items with
   *  their own client_id already on each row), items are grouped by
   *  `client_id` and `deriveStatutoryItems` runs once per group; `client` is
   *  ignored. Absent = the single-client behaviour via `client` above. */
  clients?: Record<string, StatutoryClientInfo>;
}

export interface PlanCashflowResult {
  totals: CashflowTotals;
  derived: DerivedItem[];
  superseded: Array<PeriodRow | StandingItem>;
  monthly_debt_service: number;
  monthly_principal: number;
  monthly_interest: number;
  monthly_premiums: number;
  /** which of cashflow_items / cashflow_entries the totals were built from —
   *  P2b 决策 1. */
  source: "items" | "actuals";
  monthly_employee_epf: number;
  monthly_employer_epf: number;
  monthly_socso_eis: number;
  /** one_off items near `today`; always empty on the actuals path (periods.ts
   *  has no such concept — see periods.cashflowEntries's own annual items). */
  one_off_items: StandingItem[];
}

/**
 * 决策 5 (P2a) / 决策 1 (P2b): reads the plan from cashflow_items when the
 * client has any (`input.items` non-empty), otherwise falls back to the
 * original actuals-average algorithm — UNCHANGED, so every existing caller
 * and test keeps its exact numbers until a client actually has items.
 */
export function planCashflow(input: PlanCashflowInput): PlanCashflowResult {
  return input.items && input.items.length > 0
    ? planCashflowFromItems(input)
    : planCashflowFromActuals(input);
}

/**
 * The original P2a algorithm: totals = retained manual rows
 * (periods.annualizeCashflow, same basis as always) + derived items × 12
 * (transfer-category derived items, if any ever exist, excluded). Cash view:
 * the full installment counts as spending, even though technically principal
 * is a transfer — `monthly_principal` is exposed separately for whoever
 * needs the wealth-building view later. `monthly_debt_service` sums every
 * liability's FULL estimated payment (credit card = its minimum payment;
 * policy_loan excluded), independent of the interest-only amount actually
 * filed under `finance_charges`.
 */
function planCashflowFromActuals(input: PlanCashflowInput): PlanCashflowResult {
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
    source: "actuals",
    monthly_employee_epf: 0,
    monthly_employer_epf: 0,
    monthly_socso_eis: 0,
    one_off_items: [],
  };
}

/**
 * P2b 决策 6 (household): runs `deriveStatutoryItems` once per employee
 * instead of once for the whole household. `items` are split by their own
 * `client_id` (each spouse's items already carry their own — see
 * household.ts's item merge), each group is measured against that person's
 * OWN `clients[client_id]` flags, and the per-person results are summed.
 * Each derived item's `key` gets that client_id appended so a joint report's
 * two `epf_employee` items (one per spouse) never collide.
 *
 * Falls back to the single-client `deriveStatutoryItems` call when `clients`
 * is absent — the household path never fires for a solo report.
 */
function deriveStatutoryForHousehold(
  items: StandingItem[],
  clientInfo: StatutoryClientInfo | undefined,
  clients: Record<string, StatutoryClientInfo> | undefined,
  today: Date,
): DeriveStatutoryResult {
  if (!clients) return deriveStatutoryItems(items, clientInfo ?? {}, today);

  const byClient = new Map<string, StandingItem[]>();
  for (const it of items ?? []) {
    const cid = it.client_id ?? "";
    const group = byClient.get(cid);
    if (group) group.push(it);
    else byClient.set(cid, [it]);
  }

  let employee_epf_monthly = 0;
  let employer_epf_monthly = 0;
  let socso_eis_monthly = 0;
  let epf_wage_monthly = 0;
  const items_out: DeriveStatutoryResult["items"] = [];
  const notes = new Set<string>();

  for (const [cid, groupItems] of byClient) {
    const result = deriveStatutoryItems(groupItems, clients[cid] ?? {}, today);
    employee_epf_monthly += result.employee_epf_monthly;
    employer_epf_monthly += result.employer_epf_monthly;
    socso_eis_monthly += result.socso_eis_monthly;
    epf_wage_monthly += result.epf_wage_monthly;
    for (const it of result.items) {
      items_out.push({ ...it, key: cid ? `${it.key}:${cid}` : it.key });
    }
    for (const n of result.notes) notes.add(n);
  }

  return {
    items: items_out,
    employee_epf_monthly: round2(employee_epf_monthly),
    employer_epf_monthly: round2(employer_epf_monthly),
    socso_eis_monthly: round2(socso_eis_monthly),
    epf_wage_monthly: round2(epf_wage_monthly),
    notes: [...notes],
  };
}

/**
 * P2b 决策 1/4/6/8: the plan read from cashflow_items. Active items at
 * `today` are kept unless `isSuperseded` (决策 8: the SAME P2a dedupe rule —
 * a manual `car_installment` item is dropped exactly like a manual row would
 * be, once a matching liability exists). Totals = annualizeItems(kept) +
 * derived loans/premiums/statutory × 12, transfers excluded from expense
 * totals exactly as the actuals path excludes them. Statutory items are
 * derived from the FULL items list (not just the kept/non-superseded ones —
 * a salary item is never "superseded", so this only matters in theory, but
 * statutory's own `activeItems` filtering makes the distinction moot either
 * way).
 */
function planCashflowFromItems(input: PlanCashflowInput): PlanCashflowResult {
  const { liabilities, policies, client, clients } = input;
  const items = input.items ?? [];
  const today = input.today ?? new Date();

  const active = activeItems(items, today);
  const superseded: StandingItem[] = [];
  const kept: StandingItem[] = [];
  for (const it of active) {
    if (isSuperseded(it, liabilities, policies)) superseded.push(it);
    else kept.push(it);
  }

  const itemTotals = annualizeItems(kept, today);

  // one_off_items must be scanned from EVERY non-superseded item, not just
  // the ones active "at today" (`kept`, above). isActiveAt requires
  // effective_from ≤ month(today) ≤ effective_to, and a one_off item's
  // effective_to === effective_from (a single month) — so a one_off item
  // scheduled outside that exact month (e.g. 5 months in the future, or 3
  // months in the past) is never "active at today" and `activeItems` drops
  // it before annualizeItems ever sees it, even though it plainly belongs in
  // annualizeItems' own ±11/+12-month surfacing window. Recurring totals
  // above correctly stay based on `kept` (active items only); only the
  // one_off listing needs the broader, non-superseded set.
  const nonSupersededAll = items.filter((it) => !isSuperseded(it, liabilities, policies));
  const one_off_items = annualizeItems(nonSupersededAll, today).one_off_items;

  const loanItems = deriveLoanItems(liabilities, today);
  const premiumItems = derivePremiumItems(policies, today);
  const statutory = deriveStatutoryForHousehold(items, client, clients, today);
  const derived: DerivedItem[] = [...loanItems, ...premiumItems, ...statutory.items];

  let derivedMonthlyExpense = 0;
  for (const item of derived) {
    if (isTransferCode(item.category)) continue;
    derivedMonthlyExpense += item.monthly_amount;
  }

  const monthly_expenses = round2(itemTotals.monthly_expenses + derivedMonthlyExpense);
  const annual_expenses = round2(itemTotals.annual_expenses + derivedMonthlyExpense * 12);

  const { one_off_items: _itemTotalsOneOff, ...itemTotalsRest } = itemTotals;
  const totals: CashflowTotals = {
    ...itemTotalsRest,
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
    source: "items",
    monthly_employee_epf: statutory.employee_epf_monthly,
    monthly_employer_epf: statutory.employer_epf_monthly,
    monthly_socso_eis: statutory.socso_eis_monthly,
    one_off_items,
  };
}
