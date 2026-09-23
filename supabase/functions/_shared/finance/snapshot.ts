// P4 Task A — the ONE shared health-snapshot formula.
// spec docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md 决策 3.
//
// computeSnapshot() replaces three independent copies of the same math:
// components/advisor/components/HealthScoreCard.tsx (writes health_snapshots
// straight from the client-detail page), api/health.js (the client portal's
// "current position" read) and supabase/functions/cfp-brain/baseline.ts (the
// CFP report). P4 Task B/C move those three callers onto this function; until
// then this file is additive only.
//
// Every field's formula is picked to match cfp-brain's baseline.ts wherever
// baseline computes that figure — per spec decision 3, baseline is the
// tie-breaker when the three existing places disagree. Where NONE of the
// three compute a health_snapshots column yet (non_mortgage_dsr,
// invest_assets_to_net_worth, passive_income_coverage), this file defines the
// formula for the first time — each is called out below.
//
// ─────────────────────────────────────────────────────────────────────────────
// Imports are relative-with-`.ts` only: ../taxonomy/balance.ts,
// ../taxonomy/cashflow.ts (groupOf — the same module ./derived.ts already
// imports, for the I2 被动收入 filter), ../cashflow/items.ts,
// ../cashflow/periods.ts, ./derived.ts (planCashflow — the one place plan
// income/expenses/principal/EPF are computed), ./loans.ts (estimateLoan, for
// the mortgage-vs-non-mortgage DSR split) and ./statutory.ts
// (StatutoryClientInfo, reused rather than redefined).
// ─────────────────────────────────────────────────────────────────────────────

import { assetClassOf, EPF_ASSET_TYPES, isLiquid, liabilityTypeMeta } from "../taxonomy/balance.ts";
import { groupOf } from "../taxonomy/cashflow.ts";
import { activeItems, itemMonthlyAmount, type StandingItem } from "../cashflow/items.ts";
import { annualizeCashflow, defaultBasis, type CashflowBasis, type PeriodRow } from "../cashflow/periods.ts";
import { planCashflow, type LiabilityRow, type PolicyRow } from "./derived.ts";
import { estimateLoan } from "./loans.ts";
import type { StatutoryClientInfo } from "./statutory.ts";

export type { LiabilityRow, PolicyRow };

/** One `assets` row. Counted at `ownership_pct` (决策: "Assets counted at
 *  ownership_pct (default 100) if the asset has it") — a jointly-owned asset
 *  contributes only the client's own share to every total below. */
export interface SnapshotAsset {
  id?: string | null;
  asset_type: string;
  current_value?: number | null;
  /** percent, 0–100 (DB check: `> 0 and <= 100`). Missing/null = 100. */
  ownership_pct?: number | null;
}

/** derived.ts's PolicyRow plus the one field life_insurance_coverage needs
 *  that the cash-flow premium derivation doesn't: sum_assured. */
export interface SnapshotPolicy extends PolicyRow {
  sum_assured?: number | null;
}

export interface SnapshotInput {
  assets: readonly SnapshotAsset[];
  liabilities: readonly LiabilityRow[];
  /** P2b standing items — when non-empty, planCashflow reads the PLAN from
   *  these instead of averaging `rows` (derived.ts 决策 1). */
  items?: readonly StandingItem[];
  /** cashflow_entries actuals — the fallback plan source, and always the
   *  passive-income source of truth for a client who has no items yet. */
  rows?: readonly PeriodRow[];
  policies: readonly SnapshotPolicy[];
  client?: StatutoryClientInfo;
  asOf: Date | string;
}

/** Exactly the health_snapshots metric columns (supabase/migrations
 *  20260424000001_initial_schema.sql + 20260927000001_reviews_snapshots.sql),
 *  plus the extra fields spec Task A calls out by name. `review_id` and
 *  `unexplained_gap` are NOT here — unexplained_gap is reconcile.ts's job
 *  (it needs a previous snapshot, which this function doesn't take), and
 *  review_id is metadata the caller attaches, not a computed figure. */
export interface SnapshotResult {
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
  /** months of essential spending the class-A liquid assets cover:
   *  liquid_assets_total / monthly_expenses. Same formula as
   *  cfp-brain/modules/cashflow/calc.ts's `emergency_fund.months_covered`
   *  and the value components/advisor/components/HealthScoreCard.tsx already
   *  writes into this column (as `metrics.emergencyMonths`). */
  basic_liquidity_ratio: number | null;
  /** liquid_assets_total / net_worth, null when net_worth <= 0 — verbatim
   *  cfp-brain/modules/synthesis/calc.ts's `liquid_to_net_worth`, the only
   *  place this ratio existed before (never actually written to
   *  health_snapshots by any of the three callers). */
  liquid_asset_to_net_worth: number | null;
  /** net_worth / total_assets, null when total_assets <= 0 — baseline.ts's
   *  `solvency_ratio` formula. */
  solvency_ratio: number | null;
  /** monthly_debt_service (EVERY liability's full estimated payment,
   *  credit-card minimum included, policy_loan excluded — same basis as
   *  derived.ts's planCashflow) / monthly_income. baseline.ts and
   *  HealthScoreCard.tsx already agree on this one. */
  debt_service_ratio: number | null;
  /** NEW — no existing caller computes this. (monthly_debt_service minus the
   *  mortgage liabilities' own full estimated payment) / monthly_income: the
   *  standard CFP "non-mortgage DSR" reading, isolating consumer debt burden
   *  from the (usually much larger, secured, long-term) home loan. */
  non_mortgage_dsr: number | null;
  /** (monthly_income - monthly_expenses) / monthly_income — baseline.ts's
   *  `savings_ratio`, restated on a monthly basis (annual_income/annual_expenses
   *  are exactly 12x the monthly figures, so the ratio is identical). */
  savings_ratio: number | null;
  /** active life + investment_linked policies' sum_assured / (monthly_income
   *  * 12) — HealthScoreCard.tsx's `lifeCoverage` formula (the only one of
   *  the three that computes it). "Active" = no end_date, or end_date on or
   *  after asOf, same test HealthScoreCard uses. */
  life_insurance_coverage: number | null;
  /** NEW — no existing caller computes this. class-C investment assets
   *  (taxonomy `assetClassOf === "C"`, weighted by ownership_pct) /
   *  net_worth, null when net_worth <= 0 — the investment-asset analogue of
   *  liquid_asset_to_net_worth above, using the same "null on non-positive
   *  net worth" guard for consistency. */
  invest_assets_to_net_worth: number | null;
  /** NEW as a stored column, though the ratio itself already exists as
   *  synthesis.ts's `wealthFreedomStage().ratio` (投资大师 stage calc):
   *  I2 被动收入 monthly / monthly_expenses. synthesis.ts only ever reads
   *  I2 income from cashflow_entries rows; this function extends the same
   *  formula to the items plan too (filtering StandingItems by
   *  `groupOf(category)?.id === "I2"`), consistent with 决策 1's items-first
   *  plan source. */
  passive_income_coverage: number | null;
  raw_metrics: Record<string, unknown>;
  // ---- extra fields spec Task A names explicitly, alongside the columns ----
  /** identical value to basic_liquidity_ratio, exposed under the friendlier
   *  name reconcile.ts/alerts.ts read. */
  emergency_fund_months: number | null;
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  monthly_principal: number;
  monthly_employer_epf: number;
}

function round0(n: number): number {
  return Math.round(n);
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function ownedValue(a: SnapshotAsset): number {
  const value = Number(a.current_value) || 0;
  const pct = a.ownership_pct == null ? 100 : Number(a.ownership_pct);
  const pctSafe = Number.isFinite(pct) ? pct : 100;
  return value * (pctSafe / 100);
}

/** I2 被动收入 monthly, from whichever plan source is in force — mirrors
 *  synthesis.ts's `passiveIncomeMonthly` (cashflow_entries path) and extends
 *  it to standing items (items path), so a client already migrated off
 *  actuals still gets a passive-income-coverage figure. */
function passiveIncomeMonthly(
  items: readonly StandingItem[],
  rows: readonly PeriodRow[],
  basis: CashflowBasis | null,
  asOf: Date | string,
): number {
  if (items.length > 0) {
    let total = 0;
    for (const it of activeItems(items, asOf)) {
      if (it.direction !== "inflow") continue;
      if (groupOf(it.category)?.id !== "I2") continue;
      total += itemMonthlyAmount(it);
    }
    return total;
  }
  const passive = (rows ?? []).filter(
    (r) => r.direction === "inflow" && groupOf(r.category ?? null)?.id === "I2",
  );
  return annualizeCashflow(passive as PeriodRow[], basis).monthly_income;
}

export function computeSnapshot(input: SnapshotInput): SnapshotResult {
  const asOfDate = typeof input.asOf === "string" ? new Date(input.asOf) : input.asOf;
  // 'YYYY-MM-DD', for the policy end_date comparison below — sliced directly
  // off a string input (never round-tripped through `Date`, which shifts a
  // date-only string west of Greenwich; see cashflow/items.ts's monthStart).
  const asOfStr = typeof input.asOf === "string" ? input.asOf.slice(0, 10) : asOfDate.toISOString().slice(0, 10);

  const assets = input.assets ?? [];
  const liabilities = input.liabilities ?? [];
  const policies = input.policies ?? [];
  const items = input.items ?? [];
  const rows = (input.rows ?? []) as PeriodRow[];

  // ---- asset totals (ownership_pct-weighted) ----
  let totalAssets = 0;
  let liquidTotal = 0;
  let investTotal = 0;
  let epfTotal = 0;
  for (const a of assets) {
    const v = ownedValue(a);
    totalAssets += v;
    if (isLiquid(a.asset_type)) liquidTotal += v;
    if (assetClassOf(a.asset_type) === "C") investTotal += v;
    if (EPF_ASSET_TYPES.includes(a.asset_type)) epfTotal += v;
  }

  const totalLiabilities = liabilities.reduce((s, l) => s + (Number(l.outstanding_balance) || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  // ---- the plan (决策 1: items when present, else averaged actuals) ----
  const basis: CashflowBasis | null = items.length > 0 ? null : defaultBasis(rows);
  const plan = planCashflow({
    rows,
    liabilities: liabilities as LiabilityRow[],
    policies: policies as PolicyRow[],
    basis,
    today: asOfDate,
    items: items as StandingItem[],
    client: input.client,
  });

  const monthlyIncome = plan.totals.monthly_income;
  const monthlyExpenses = plan.totals.monthly_expenses;
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const monthlyDebtService = plan.monthly_debt_service;

  // ---- non-mortgage DSR: same estimateLoan basis as planCashflow's own
  // monthly_debt_service sum (derived.ts planCashflowFromActuals/FromItems),
  // isolating the mortgage liabilities' own full payment. ----
  let mortgageMonthly = 0;
  for (const l of liabilities) {
    if (l.liability_type !== "mortgage") continue;
    const meta = liabilityTypeMeta(l.liability_type);
    if (!meta || meta.installment_category == null) continue;
    mortgageMonthly += estimateLoan(l, asOfDate).monthly_payment;
  }
  const nonMortgageDebtService = monthlyDebtService - mortgageMonthly;

  // ---- life insurance coverage: active life/investment_linked policies ----
  let activeLifeSumAssured = 0;
  for (const p of policies) {
    const active = !p.end_date || p.end_date >= asOfStr;
    if (!active) continue;
    const kind = String(p.policy_type || "").toLowerCase();
    if (kind !== "life" && kind !== "investment_linked") continue;
    activeLifeSumAssured += Number(p.sum_assured) || 0;
  }
  const annualIncome = monthlyIncome * 12;

  const passiveMonthly = passiveIncomeMonthly(items, rows, basis, asOfDate);

  const emergencyFundMonths = monthlyExpenses > 0 ? round4(liquidTotal / monthlyExpenses) : null;

  const notes: string[] = [];
  if (monthlyIncome <= 0) notes.push("未录得经常性收入，收入相关比率不具参考意义");
  if (netWorth <= 0) notes.push("净资产为零或负数，以净资产为分母的比率记为 null");

  return {
    net_worth: round0(netWorth),
    total_assets: round0(totalAssets),
    total_liabilities: round0(totalLiabilities),
    basic_liquidity_ratio: emergencyFundMonths,
    liquid_asset_to_net_worth: netWorth > 0 ? round4(liquidTotal / netWorth) : null,
    solvency_ratio: totalAssets > 0 ? round4(netWorth / totalAssets) : null,
    debt_service_ratio: monthlyIncome > 0 ? round4(monthlyDebtService / monthlyIncome) : null,
    non_mortgage_dsr: monthlyIncome > 0 ? round4(nonMortgageDebtService / monthlyIncome) : null,
    savings_ratio: monthlyIncome > 0 ? round4(monthlySurplus / monthlyIncome) : null,
    life_insurance_coverage: annualIncome > 0 ? round4(activeLifeSumAssured / annualIncome) : null,
    invest_assets_to_net_worth: netWorth > 0 ? round4(investTotal / netWorth) : null,
    passive_income_coverage: monthlyExpenses > 0 ? round4(passiveMonthly / monthlyExpenses) : null,
    raw_metrics: {
      liquid_assets_total: round0(liquidTotal),
      invest_assets_total: round0(investTotal),
      epf_assets_total: round0(epfTotal),
      monthly_debt_service: round0(monthlyDebtService),
      monthly_mortgage_service: round0(mortgageMonthly),
      monthly_non_mortgage_service: round0(nonMortgageDebtService),
      monthly_employee_epf: round0(plan.monthly_employee_epf),
      monthly_socso_eis: round0(plan.monthly_socso_eis),
      active_life_sum_assured: round0(activeLifeSumAssured),
      passive_income_monthly: round0(passiveMonthly),
      annual_income: round0(annualIncome),
      plan_source: plan.source,
      cashflow_basis: basis,
      as_of: asOfStr,
      notes,
    },
    emergency_fund_months: emergencyFundMonths,
    monthly_income: round0(monthlyIncome),
    monthly_expenses: round0(monthlyExpenses),
    monthly_surplus: round0(monthlySurplus),
    monthly_principal: round0(plan.monthly_principal),
    monthly_employer_epf: round0(plan.monthly_employer_epf),
  };
}
