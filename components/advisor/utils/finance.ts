import {
  planCashflow, type LiabilityRow, type PolicyRow,
} from '../../../supabase/functions/_shared/finance/derived';
import type { CashflowBasis, PeriodRow } from '../../../supabase/functions/_shared/cashflow/periods';
import type { StandingItem } from '../../../supabase/functions/_shared/cashflow/items';

export const safeNumber = (v: any): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/**
 * @deprecated for cashflow_entries. A row there records ONE MONTH'S actual
 * amount, so converting it to a "monthly rate" and summing across rows treats
 * June's and July's figures as two concurrent commitments — the mistake that
 * made a real client's RM 1,548 of spending read as RM 128. Use
 * `annualizeCashflow` from supabase/functions/_shared/cashflow/periods.ts.
 *
 * Still correct for genuinely recurring commitments held elsewhere, such as an
 * insurance premium with its own frequency.
 */
export const toMonthly = (amount: number, frequency?: string | null): number => {
  const f = (frequency || 'monthly').toLowerCase();
  const map: Record<string, number> = {
    monthly: 1,
    quarterly: 1 / 3,
    semi_annual: 1 / 6,
    semiannual: 1 / 6,
    annual: 1 / 12,
    yearly: 1 / 12,
    weekly: 4.33,
    one_off: 0,
    oneoff: 0,
    single_premium: 0
  };
  return amount * (map[f] ?? 1);
};

export const firstDayOfCurrentMonth = () => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return d;
};

export const yyyyMmDd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const fmtRM = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const fmtPercent = (n: number) => `${n.toFixed(0)}%`;

export const fmtMultiplier = (n: number) => `${n.toFixed(1)}×`;

export interface PlanIncomeExpenseInput {
  rows: PeriodRow[];
  liabilities?: LiabilityRow[];
  policies?: PolicyRow[];
  /** P2b 决策 1: pass the client's cashflow_items when there are any — the
   *  plan is then read from them instead of averaged cashflow_entries. */
  items?: StandingItem[];
  basis?: CashflowBasis | null;
  client?: { has_epf?: boolean | null; date_of_birth?: string | null } | null;
  today?: Date;
}

export interface PlanIncomeExpenseResult {
  annualIncome: number;
  annualExpenses: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  source: 'items' | 'actuals';
}

/**
 * The one way advisor-side screens should read a client's income/expenses:
 * the plan (cashflow_items) when the client has any, the averaged actuals
 * otherwise — spec 2026-09-25-cfp-p2b decision 1. Thin wrapper around
 * planCashflow so callers (health score, insurance gap, …) don't each
 * re-derive "does this client have items" and the P2a superseded-row/derived
 * installment logic by hand.
 */
export function planAnnualIncomeExpenses(input: PlanIncomeExpenseInput): PlanIncomeExpenseResult {
  const plan = planCashflow({
    rows: input.rows,
    liabilities: input.liabilities ?? [],
    policies: input.policies ?? [],
    basis: input.basis ?? null,
    items: input.items ?? [],
    client: input.client ?? undefined,
    today: input.today,
  });
  return {
    annualIncome: plan.totals.annual_income,
    annualExpenses: plan.totals.annual_expenses,
    monthlyIncome: plan.totals.monthly_income,
    monthlyExpenses: plan.totals.monthly_expenses,
    source: plan.source,
  };
}

