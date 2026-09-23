// Pure helpers for turning liabilities/policies into the client-portal's
// "expense" record shape (api/health.js): installments and premiums that are
// computed from their source (决策 1), never re-keyed by hand, and — like
// every manual row already there — filed under the month/year the portal's
// "latest period" picks up (services/apiService.ts getLatestRecords).
// spec docs/superpowers/specs/2026-09-24-cfp-p2a-linked-obligations-design.md
import { categoryLabel, deriveLoanItems, derivePremiumItems, isSuperseded, planCashflow } from './taxonomy.mjs';
import { cashflowLabel } from './portalLabels.js';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The Year/Month the client portal will treat as "current" for these expense
 * records — mirrors services/apiService.ts's getLatestRecords: the most
 * recent Year, then the most recent Month within it. Falls back to today's
 * month when the client has no dated expense rows at all, so a client whose
 * only spending is a mortgage installment still gets it counted instead of
 * silently discarded for want of a Year/Month to match.
 */
export function latestMonthYear(expenseRecords, today = new Date()) {
  const dated = (expenseRecords || []).filter((r) => r?.fields?.Year && r?.fields?.Month);
  if (dated.length === 0) {
    return { month: MONTH_NAMES[today.getMonth()], year: String(today.getFullYear()) };
  }
  const sorted = [...dated].sort((a, b) => {
    const yearA = parseInt(a.fields.Year, 10) || 0;
    const yearB = parseInt(b.fields.Year, 10) || 0;
    if (yearA !== yearB) return yearB - yearA;
    return MONTH_NAMES.indexOf(b.fields.Month) - MONTH_NAMES.indexOf(a.fields.Month);
  });
  return { month: sorted[0].fields.Month, year: sorted[0].fields.Year };
}

/**
 * A manually-keyed outflow row that now duplicates a derived installment or
 * premium (决策 4) — dropped from api/health.js's expense records so the
 * client portal doesn't double-count it against the derived row that
 * replaces it.
 */
export function isSupersededOutflow(row, liabilities, policies) {
  return row?.direction === 'outflow' && isSuperseded(row, liabilities, policies);
}

/**
 * One client-portal "expense" record per derived installment/premium item
 * (decision 3), stamped with the SAME Year/Month `latestMonthYear` returned
 * so getLatestRecords picks them up alongside the manual rows for that
 * period rather than treating them as belonging to no period at all.
 */
export function buildDerivedExpenseRecords({ liabilities, policies, month, year, today = new Date() }) {
  const items = [...deriveLoanItems(liabilities || [], today), ...derivePremiumItems(policies || [], today)];
  return items.map((item) => ({
    id: item.key,
    fields: {
      'Category': categoryLabel(item.category, 'en'),
      'Type': cashflowLabel('outflow', item.category),
      'Description': item.source_name,
      'Amount': item.monthly_amount,
      'Month': month,
      'Year': year,
      'Date': null,
    },
  }));
}

/**
 * The client portal's CURRENT position (spec docs/superpowers/specs/
 * 2026-09-25-cfp-p2b-standing-items-design.md, D2): read from the plan —
 * cashflow_items when the client has any, the averaged actuals otherwise
 * (决策 1) — never from just "whatever the latest recorded month happens to
 * hold", which is what the month-by-month history below this still uses on
 * purpose (that history stays on cashflow_entries, unaffected by this).
 * Kept as a thin, independently-testable wrapper around planCashflow so
 * api/health.js stays a plain fetch-and-shape handler.
 */
export function buildCurrentPlan({ rows, liabilities, policies, items, client, basis = null, today = new Date() }) {
  const plan = planCashflow({
    rows: rows || [],
    liabilities: liabilities || [],
    policies: policies || [],
    basis,
    items: items || [],
    client: client || undefined,
    today,
  });
  const monthlySurplus = plan.totals.monthly_income - plan.totals.monthly_expenses;
  return {
    source: plan.source,
    monthly_income: plan.totals.monthly_income,
    monthly_expenses: plan.totals.monthly_expenses,
    monthly_surplus: monthlySurplus,
    annual_income: plan.totals.annual_income,
    annual_expenses: plan.totals.annual_expenses,
    monthly_debt_service: plan.monthly_debt_service,
    monthly_principal: plan.monthly_principal,
    monthly_interest: plan.monthly_interest,
    monthly_premiums: plan.monthly_premiums,
    monthly_employee_epf: plan.monthly_employee_epf,
    monthly_employer_epf: plan.monthly_employer_epf,
    monthly_socso_eis: plan.monthly_socso_eis,
  };
}
