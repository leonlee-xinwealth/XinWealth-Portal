// P2a derived cash-flow items — installments and premiums computed from their
// source (liabilities / policies) instead of re-keyed by hand.
// spec 2026-09-24-cfp-p2a-linked-obligations-design.md 决策 1, 3, 4, 5.
// P2b extends this with standing items and statutory deductions —
// spec 2026-09-25-cfp-p2b-standing-items-design.md, Task A.
//
// Imports are relative-with-`.ts` only, and only from the modules the specs
// name: ../taxonomy/balance.ts, ../taxonomy/cashflow.ts, ../cashflow/periods.ts,
// ../cashflow/items.ts, ./loans.ts, ./statutory.ts, ./incomeTax.ts. (Contrast
// with loans.ts, statutory.ts and the taxonomy modules themselves, which must
// have ZERO or a much narrower set of imports — this file is allowed the
// widest surface.)
// This file MAY import statutory.ts and incomeTax.ts; neither may import this
// file back (that two-file cycle is exactly what every bundler here refuses
// to resolve) — incomeTax.ts in fact has ZERO imports of its own.

import { liabilityTypeMeta } from "../taxonomy/balance.ts";
import { CATEGORY_BY_CODE } from "../taxonomy/cashflow.ts";
import { annualizeCashflow, annualizeByCategory, isTransferCode, type CashflowBasis, type CashflowTotals, type CategoryTotals, type PeriodRow } from "../cashflow/periods.ts";
import { activeItems, annualizeItems, annualizeItemsByCategory, type StandingItem } from "../cashflow/items.ts";
import { estimateLoan, type LoanInput } from "./loans.ts";
import { deriveStatutoryItems, type DeriveStatutoryResult, type StatutoryClientInfo } from "./statutory.ts";
import { estimateIncomeTax } from "./incomeTax.ts";

export type LiabilityRow = LoanInput & { id?: string | null; name?: string | null };

export interface PolicyRow {
  id?: string | null;
  policy_type: string;
  plan_name?: string | null;
  provider?: string | null;
  premium?: number | null;
  premium_frequency?: string | null;
  end_date?: string | null;
  /** P5 决策 3 (migration 20260926000001_insurance_policy_status.sql):
   *  in_force/lapsed/paid_up/surrendered/matured, default in_force. Optional/
   *  nullable so callers that don't select the column keep working exactly
   *  as before (treated as in_force). */
  status?: string | null;
}

export interface DerivedItem {
  key: string;
  source_type: "liability" | "policy" | "statutory" | "tax";
  source_id: string | null;
  source_name: string;
  category: string;
  direction: "outflow";
  monthly_amount: number;
  interest_monthly: number;
  principal_monthly: number;
  estimated: Array<"monthly_payment" | "interest_rate" | "remaining_months" | "statutory_rate" | "tax_estimate">;
  warnings: string[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * P2b followup — `monthly_planned_savings`: outflow minus inflow, summed
 * across every TRANSFER category except the statutory `epf_employee` (that
 * forced saving is already accounted for under 税与法定扣款, not here).
 * Works on either periods.ts's or items.ts's CategoryTotals shape — the two
 * are structurally identical — so one function serves both planCashflow paths.
 */
function plannedSavingsFromCategoryTotals(totals: CategoryTotals[]): number {
  let net = 0;
  for (const t of totals) {
    if (t.category === "epf_employee") continue;
    if (!isTransferCode(t.category)) continue;
    net += t.monthly_expenses - t.monthly_income;
  }
  return round2(net);
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

/** P5 决策 3: only an in_force (or unset — every pre-P5 row) policy still owes
 * a premium. lapsed/surrendered/matured plainly don't; paid_up is fully paid
 * up — its cover still counts (see _shared/insurance/mapping.ts) but it
 * generates no further premium outflow even if a stale `premium` value is
 * still stored on the row. */
function isPremiumActive(status: string | null | undefined): boolean {
  return status == null || status === "in_force";
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

/** 决策 3: one derived item per non-expired, premium-active policy with a
 * non-zero premium. Uses only the policy's own `premium` (never rider
 * premiums — same basis as the tax/insurance modules). single_premium
 * policies annualise to 0 and are skipped, same as an expired or non-active
 * (lapsed/paid_up/surrendered/matured — P5 决策 3) policy. */
export function derivePremiumItems(policies: PolicyRow[], today: Date = new Date()): DerivedItem[] {
  const items: DerivedItem[] = [];
  for (const p of policies ?? []) {
    if (isExpired(p.end_date, today)) continue;
    if (!isPremiumActive(p.status)) continue;

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
    // P5 决策 3: a lapsed/paid_up/surrendered/matured policy derives no
    // premium item (derivePremiumItems, above), so it must not supersede a
    // manual row either — otherwise the manual premium and the (now absent)
    // derived one would BOTH vanish from the totals.
    const activePolicies = (policies ?? []).filter((p) => isPremiumActive(p.status));
    const policyCategories = new Set(activePolicies.map((p) => premiumCategoryOf(p.policy_type)));
    if (policyCategories.has(code)) return true;
    if (code === "protection_other" && activePolicies.length > 0) return true;
    return false;
  }

  return false;
}

/** P2b 决策 6 + P2b followup: statutory info plus the client's tax residency
 *  (needed only for the income-tax estimate — non-residents get the flat 30%
 *  with no reliefs/rebate). Extends StatutoryClientInfo rather than modifying
 *  it: statutory.ts is EPF/SOCSO/EIS-only and has no notion of tax. */
export interface PlanCashflowClientInfo extends StatutoryClientInfo {
  tax_residency?: string | null;
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
  client?: PlanCashflowClientInfo;
  /** P2b 决策 6 (household): per-employee statutory info, keyed by client_id.
   *  SOCSO/EIS's wage ceiling and EPF's employer-rate threshold are each
   *  PER EMPLOYEE, so a joint plan must never pool both spouses' salaries into
   *  one wage base — that would misprice both of their statutory deductions.
   *  When this is given (household.ts merges each spouse's own items with
   *  their own client_id already on each row), items are grouped by
   *  `client_id` and `deriveStatutoryItems` runs once per group; `client` is
   *  ignored. Absent = the single-client behaviour via `client` above. */
  clients?: Record<string, PlanCashflowClientInfo>;
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
  /** P2b followup — the cash-flow-correctness fix. Estimated on the items
   *  path (unless an active manual `income_tax` item exists — then that
   *  item's own monthly amount, already inside `totals`); on the actuals
   *  path, only ever a manual `income_tax` row's amount (never estimated). */
  monthly_income_tax: number;
  /** monthly_employee_epf + monthly_socso_eis — the statutory deductions
   *  block shown above 实得收入 on the cash-flow waterfall. 0 on the actuals
   *  path (statutory is only ever derived from standing salary items). */
  monthly_statutory: number;
  /** income − monthly_statutory − monthly_income_tax: what's actually left
   *  in hand after EPF/SOCSO/EIS/tax, before any spending at all. */
  monthly_take_home: number;
  /** monthly_expenses minus the SOCSO/EIS and tax already shown separately
   *  under statutory deductions — i.e. just living costs, installments and
   *  premiums. */
  monthly_living: number;
  /** monthly_take_home − monthly_living. */
  monthly_savable: number;
  /** active transfer items (O1/I4 etc., excluding statutory epf_employee),
   *  outflow minus inflow — money actually set aside/withdrawn on purpose,
   *  as opposed to the forced statutory EPF already counted above. */
  monthly_planned_savings: number;
  /** monthly_savable − monthly_planned_savings — the headline figure. */
  monthly_net_cash_flow: number;
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

  // P2b followup: on the actuals path there is no statutory derivation and
  // no automatic tax estimate — tax is whatever a manual `income_tax` row
  // says, statutory is always 0. Planned savings still comes from the SAME
  // kept rows, via periods.ts's own by-category breakdown (includeTransfers)
  // so it uses the identical basis/divisor as every other actuals figure.
  const incomeTaxByCategory = annualizeByCategory(keptRows, basis).find((t) => t.category === "income_tax");
  const monthly_income_tax = round2(incomeTaxByCategory?.monthly_expenses ?? 0);
  const monthly_statutory = 0;
  const monthly_take_home = round2(totals.monthly_income - monthly_statutory - monthly_income_tax);
  const monthly_living = round2(totals.monthly_expenses - monthly_income_tax);
  const monthly_savable = round2(monthly_take_home - monthly_living);
  const monthly_planned_savings = plannedSavingsFromCategoryTotals(
    annualizeByCategory(keptRows, basis, { includeTransfers: true }),
  );
  const monthly_net_cash_flow = round2(monthly_savable - monthly_planned_savings);

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
    monthly_income_tax,
    monthly_statutory,
    monthly_take_home,
    monthly_living,
    monthly_savable,
    monthly_planned_savings,
    monthly_net_cash_flow,
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

function isNonResident(info: PlanCashflowClientInfo | undefined): boolean {
  return !!info?.tax_residency && info.tax_residency !== "resident";
}

/**
 * P2b followup: the income-tax estimate, per employee when `clients` is
 * given — mirrors deriveStatutoryForHousehold's own per-employee split, since
 * each spouse's EPF relief and residency are their own. `policies` is passed
 * whole to every person's estimate rather than split per spouse — the same
 * simplification planCashflowFromItems already makes for loanItems/
 * premiumItems, which are never split per spouse either.
 */
function estimateIncomeTaxMonthlyForPlan(
  items: StandingItem[],
  policies: PolicyRow[],
  client: PlanCashflowClientInfo | undefined,
  clients: Record<string, PlanCashflowClientInfo> | undefined,
  today: Date,
): number {
  const estimateFor = (groupItems: StandingItem[], info: PlanCashflowClientInfo | undefined): number => {
    const statutory = deriveStatutoryItems(groupItems, info ?? {}, today);
    return estimateIncomeTax({
      items: groupItems,
      policies,
      employeeEpfAnnual: 12 * statutory.employee_epf_monthly,
      nonResident: isNonResident(info),
      asOf: today,
    }).monthly_tax;
  };

  if (!clients) return round2(estimateFor(items, client));

  const byClient = new Map<string, StandingItem[]>();
  for (const it of items ?? []) {
    const cid = it.client_id ?? "";
    const group = byClient.get(cid);
    if (group) group.push(it);
    else byClient.set(cid, [it]);
  }

  let total = 0;
  for (const [cid, groupItems] of byClient) {
    total += estimateFor(groupItems, clients[cid]);
  }
  return round2(total);
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

  // P2b followup: the income-tax estimate. Skipped entirely when the client
  // already has an active MANUAL income_tax item — O9 categories are never
  // superseded (isSuperseded only handles O2/O3), so that row is already an
  // ordinary kept expense; estimating on top of it would double-count.
  const hasManualIncomeTax = active.some((it) => it.category === "income_tax");
  const manualIncomeTaxMonthly = round2(
    annualizeItemsByCategory(kept, today).find((t) => t.category === "income_tax")?.monthly_expenses ?? 0,
  );
  const estimatedIncomeTaxMonthly = hasManualIncomeTax
    ? 0
    : estimateIncomeTaxMonthlyForPlan(items, policies, client, clients, today);

  const taxItems: DerivedItem[] = [];
  if (!hasManualIncomeTax && estimatedIncomeTaxMonthly > 0) {
    taxItems.push({
      key: "tax:income_tax",
      source_type: "tax",
      source_id: null,
      source_name: "所得税（估算）",
      category: "income_tax",
      direction: "outflow",
      monthly_amount: round2(estimatedIncomeTaxMonthly),
      interest_monthly: 0,
      principal_monthly: 0,
      estimated: ["tax_estimate"],
      warnings: ["按 2026 税率与基本减免估算"],
    });
  }

  const derived: DerivedItem[] = [...loanItems, ...premiumItems, ...statutory.items, ...taxItems];

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

  // P2b followup: monthly_income_tax reflects whichever source is actually
  // inside monthly_expenses right now — the manual row if one exists,
  // otherwise the estimate just added above (0 when neither applies).
  const monthly_income_tax = hasManualIncomeTax ? manualIncomeTaxMonthly : round2(estimatedIncomeTaxMonthly);
  const monthly_statutory = round2(statutory.employee_epf_monthly + statutory.socso_eis_monthly);
  const monthly_take_home = round2(totals.monthly_income - monthly_statutory - monthly_income_tax);
  // monthly_expenses already carries SOCSO/EIS and (if estimated/manual) tax
  // under the deductions block above — strip them back out so "living" is
  // just living costs, installments and premiums.
  const monthly_living = round2(monthly_expenses - statutory.socso_eis_monthly - monthly_income_tax);
  const monthly_savable = round2(monthly_take_home - monthly_living);
  const monthly_planned_savings = plannedSavingsFromCategoryTotals(
    annualizeItemsByCategory(kept, today, { includeTransfers: true }),
  );
  const monthly_net_cash_flow = round2(monthly_savable - monthly_planned_savings);

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
    monthly_income_tax,
    monthly_statutory,
    monthly_take_home,
    monthly_living,
    monthly_savable,
    monthly_planned_savings,
    monthly_net_cash_flow,
  };
}
