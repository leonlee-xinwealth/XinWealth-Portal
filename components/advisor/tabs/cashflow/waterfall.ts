// Pure helpers for the CashflowTab summary waterfall — P2b followup (cash-flow
// correctness fix). Framework-free (no React, no i18n) so it is directly unit
// testable; CashflowTab.tsx is the only importer and supplies the bilingual
// labels itself.
//
// The waterfall: 总收入 → − 税与法定扣款 → = 实得收入 → − 开销 → = 可储蓄金额
// → − 定期储蓄/投资 → = 净现金流 (headline). Every amount below comes straight
// off planCashflow's own output fields — never re-derived from raw items —
// so the rows always add up exactly the way the engine computed them:
//   gross_income − tax_and_statutory = take_home
//   take_home − living = savable
//   savable − planned_savings = net_cash_flow

import { activeItems, type StandingItem } from '../../../../supabase/functions/_shared/cashflow/items';
import type { PlanCashflowResult } from '../../../../supabase/functions/_shared/finance/derived';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type WaterfallRowKind = 'total' | 'deduction' | 'subtotal' | 'headline';

export type WaterfallRowKey =
  | 'gross_income'
  | 'tax_and_statutory'
  | 'take_home'
  | 'living'
  | 'savable'
  | 'planned_savings'
  | 'net_cash_flow';

export interface WaterfallRow {
  key: WaterfallRowKey;
  amount: number;
  kind: WaterfallRowKind;
}

/** The minimum slice of PlanCashflowResult the waterfall needs — keeps the
 *  helper (and its tests) from having to construct a full plan object. */
export type WaterfallPlanInput = Pick<
  PlanCashflowResult,
  | 'monthly_employee_epf'
  | 'monthly_socso_eis'
  | 'monthly_income_tax'
  | 'monthly_statutory'
  | 'monthly_take_home'
  | 'monthly_living'
  | 'monthly_savable'
  | 'monthly_planned_savings'
  | 'monthly_net_cash_flow'
> & { totals: Pick<PlanCashflowResult['totals'], 'monthly_income'> };

/**
 * The 7-row compact waterfall. `tax_and_statutory` and `living` are each a
 * single combined step in the chain — their own itemised breakdowns
 * (buildStatutoryBreakdown below, and the plain living-costs/installments/
 * premiums composition) are a UI-level caption under the row, not separate
 * arrow-steps, so the top-level chain stays exactly 7 rows regardless of how
 * many statutory/tax components are actually present.
 */
export function buildWaterfallRows(plan: WaterfallPlanInput): WaterfallRow[] {
  const taxAndStatutory = round2(plan.monthly_statutory + plan.monthly_income_tax);
  return [
    { key: 'gross_income', amount: plan.totals.monthly_income, kind: 'total' },
    { key: 'tax_and_statutory', amount: taxAndStatutory, kind: 'deduction' },
    { key: 'take_home', amount: plan.monthly_take_home, kind: 'subtotal' },
    { key: 'living', amount: plan.monthly_living, kind: 'deduction' },
    { key: 'savable', amount: plan.monthly_savable, kind: 'subtotal' },
    { key: 'planned_savings', amount: plan.monthly_planned_savings, kind: 'deduction' },
    { key: 'net_cash_flow', amount: plan.monthly_net_cash_flow, kind: 'headline' },
  ];
}

export type StatutoryBreakdownKey = 'epf_employee' | 'socso_eis' | 'income_tax';

export interface StatutoryBreakdownItem {
  key: StatutoryBreakdownKey;
  amount: number;
}

/** The itemised components of the `tax_and_statutory` row — EPF (employee),
 *  SOCSO/EIS, income tax — straight off the same plan fields, filtered to
 *  only the non-zero ones so a client with no EPF just shows the tax line
 *  (or nothing, if that's zero too). */
export function buildStatutoryBreakdown(plan: WaterfallPlanInput): StatutoryBreakdownItem[] {
  const items: StatutoryBreakdownItem[] = [
    { key: 'epf_employee', amount: plan.monthly_employee_epf },
    { key: 'socso_eis', amount: plan.monthly_socso_eis },
    { key: 'income_tax', amount: plan.monthly_income_tax },
  ];
  return items.filter((it) => it.amount !== 0);
}

/**
 * true when the client has an active MANUAL `income_tax` standing item —
 * mirrors derived.ts's planCashflowFromItems's own `hasManualIncomeTax` check
 * exactly (P2b followup), so the waterfall's tax label agrees with whichever
 * source (manual row vs. automatic estimate) actually won inside the engine.
 */
export function hasManualIncomeTaxItem(items: readonly StandingItem[], today: Date): boolean {
  return activeItems(items, today).some((it) => it.direction === 'outflow' && it.category === 'income_tax');
}
