// The single 口径 for turning cashflow_entries into income and expense figures.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE MUST HAVE NO IMPORTS.
//
// It is loaded by three runtimes that resolve modules differently: Deno edge
// functions (`./periods.ts`, extension required), the Vite browser bundle
// (extensionless), and plain Node scripts. A file with zero imports is the only
// shape all three agree on. The first `import` line added here silently breaks
// two of the three — add types inline instead.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHAT A ROW MEANS
//
// One row is ONE MONTH'S ACTUAL AMOUNT for one category. The advisor asks the
// client to fill in a specific month's position, so a row recorded against
// 2026-06 says "in June the client spent RM 580 on personal", not "the client
// spends RM 580 every month forever". A year is the sum of that year's months.
//
// Rows whose `frequency` is not "monthly" are the exception: an annual bonus is
// genuinely an annual event that happens to land in one month. Those are
// annualised once and kept OUT of the monthly average, because averaging a
// RM 18,400 bonus into a month and then multiplying by twelve would invent
// RM 220,800 of income.
//
// WHY THIS FILE EXISTS
//
// The same table used to be read three incompatible ways: the client portal
// sliced by month (right), every calculator summed all rows as if each were a
// standing recurring item (wrong), and cfp-brain kept only the most recent
// period_month and discarded the rest (worst). On real data that last one
// turned RM 1,548/month of spending into RM 128 and reported the client's
// retirement as fully funded. Nothing errored; the numbers were internally
// consistent and wrong. One function, used everywhere, is the fix.

/** How many times a year a non-monthly item occurs. Mirrors the historical
 *  CASHFLOW_ANNUALIZE table so no existing figure shifts meaning. */
export const ANNUAL_OCCURRENCES: Record<string, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  one_off: 0,
};

export interface PeriodRow {
  direction: "inflow" | "outflow";
  amount: number;
  frequency: string;
  /** YYYY-MM-DD (the first of the month); the month this figure belongs to */
  period_month: string;
  /** the asset this row belongs to (rent → its condo). Relational only: it
   *  does NOT make the row a transfer — the category does. */
  linked_asset_id?: string | null;
  linked_liability_id?: string | null;
  category?: string | null;
}

/** The months whose actuals the plan is built on. `from_month`/`to_month` are
 *  1-12 inclusive. */
export interface CashflowBasis {
  year: number;
  from_month: number;
  to_month: number;
}

export interface MonthTotals {
  /** 1-12 */
  month: number;
  income: number;
  expenses: number;
  /** how many rows were recorded for this month, in either direction */
  entries: number;
}

export interface CashflowTotals {
  annual_income: number;
  annual_expenses: number;
  monthly_income: number;
  monthly_expenses: number;
  /** months the basis spans (to_month - from_month + 1) */
  basis_months: number;
  /** months inside the basis that actually have data, ascending */
  months_with_data: number[];
  /** the non-monthly items counted once for the year, e.g. an annual bonus */
  annual_items_income: number;
  annual_items_expenses: number;
}

/**
 * Category codes whose money stays the client's own — savings into an FD or a
 * fund, selling an asset, an EPF withdrawal, a loan drawdown, a card repayment.
 * A verbatim mirror of TRANSFER_CATEGORY_CODES in ../taxonomy/cashflow.ts: this
 * file may not import it, so periods.test.ts and cashflowPeriods.test.ts pin
 * the two lists together.
 */
export const TRANSFER_CATEGORIES_INLINE: readonly string[] = [
  "asnb_contribution", "asset_purchase", "asset_sale", "borrowing_family",
  "business_capital", "credit_card_payment", "crypto_purchase", "epf_employee",
  "epf_voluntary", "epf_withdrawal", "fd_placement", "gold_purchase",
  "investment_contribution", "investment_other", "lend_out", "loan_drawdown",
  "prs_contribution", "savings_withdrawal", "sspn", "stock_etf_purchase",
  "tabung_haji", "to_savings", "unit_trust_contribution",
];
const TRANSFER_SET = new Set(TRANSFER_CATEGORIES_INLINE);

/**
 * 小会计口径: a transfer moves the client's own money between pockets — it is
 * neither income nor spending. Decided by CATEGORY (spec 2026-09-22 §1). Loan
 * installments are 'split' and still count as spending until P2 separates the
 * principal.
 */
export function isAssetTransfer(r: PeriodRow): boolean {
  return isTransferCode(r.category);
}

/** The same test for a bare category code (e.g. a per-category total). */
export function isTransferCode(code: string | null | undefined): boolean {
  return code != null && TRANSFER_SET.has(code);
}

/** Year of a period_month, or null when the value is unusable. */
export function yearOf(periodMonth: string): number | null {
  const y = Number(String(periodMonth ?? "").slice(0, 4));
  return Number.isInteger(y) && y > 1900 && y < 3000 ? y : null;
}

/** Month (1-12) of a period_month, or null when the value is unusable. */
export function monthOf(periodMonth: string): number | null {
  const m = Number(String(periodMonth ?? "").slice(5, 7));
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
}

/** A row that records one month's actual amount, as opposed to a periodic item.
 *  Exported so ../cashflow/items.ts (which may import only this file) can group
 *  cashflow_entries rows the SAME way this file does, rather than re-deriving
 *  the rule and risking drift. */
export function isMonthlyActual(r: { frequency?: string | null }): boolean {
  return (r.frequency ?? "monthly") === "monthly";
}

function amountOf(r: PeriodRow): number {
  const n = Number(r.amount);
  return Number.isFinite(n) ? n : 0;
}

/** Years that have at least one usable row, most recent first. */
export function recordedYears(rows: PeriodRow[]): number[] {
  const years = new Set<number>();
  for (const r of rows ?? []) {
    const y = yearOf(r.period_month);
    if (y != null) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

/**
 * Per-month totals for one year, ascending, including only months that have
 * data.
 *
 * The `entries` count is what lets the UI show that July holds one row and June
 * holds five — the difference between a lean month and a half-entered one,
 * which no formula can tell apart and a person can tell at a glance.
 */
export function monthlyBreakdown(rows: PeriodRow[], year: number): MonthTotals[] {
  const byMonth = new Map<number, MonthTotals>();
  for (const r of rows ?? []) {
    if (yearOf(r.period_month) !== year) continue;
    const m = monthOf(r.period_month);
    if (m == null) continue;
    if (isAssetTransfer(r)) continue;

    const slot = byMonth.get(m) ?? { month: m, income: 0, expenses: 0, entries: 0 };
    const amount = amountOf(r);
    if (r.direction === "inflow") slot.income += amount;
    else slot.expenses += amount;
    slot.entries += 1;
    byMonth.set(m, slot);
  }
  return [...byMonth.values()].sort((a, b) => a.month - b.month);
}

/**
 * The basis to use when the advisor has not chosen one: the most recent year
 * with data, spanning every month of it that has data.
 *
 * Deliberately NOT "the latest month" — that is the rule that produced the
 * original defect, and a default that silently discards data is worse than one
 * that averages more of it than intended.
 */
export function defaultBasis(rows: PeriodRow[]): CashflowBasis | null {
  const year = recordedYears(rows)[0];
  if (year == null) return null;
  const months = monthlyBreakdown(rows, year).map((m) => m.month);
  if (months.length === 0) return null;
  return { year, from_month: months[0], to_month: months[months.length - 1] };
}

/** Clamps a basis to something usable; null basis yields a whole-year window. */
function normalise(basis: CashflowBasis | null, fallbackYear: number): CashflowBasis {
  if (!basis) return { year: fallbackYear, from_month: 1, to_month: 12 };
  const from = Math.min(12, Math.max(1, Math.round(basis.from_month)));
  const to = Math.min(12, Math.max(1, Math.round(basis.to_month)));
  return {
    year: basis.year,
    from_month: Math.min(from, to),
    to_month: Math.max(from, to),
  };
}

/**
 * Income and expenses for a basis.
 *
 *   monthly rows      summed over the basis months, then divided by the number
 *                     of those months that ACTUALLY HAVE DATA — not by the
 *                     width of the window. A basis of June–July where only June
 *                     was filled in should report June's position, not half of
 *                     it; dividing by the window would score the missing month
 *                     as zero income and halve the client's spending.
 *
 *                     `basis_months` and `months_with_data` are both returned
 *                     precisely so the UI can say when the two disagree. A gap
 *                     is a data-entry fact the advisor has to see, not
 *                     something arithmetic can resolve.
 *
 *   non-monthly rows  counted once for the basis YEAR, wherever in that year
 *                     they sit. A bonus recorded in March is real 2026 income
 *                     even when the basis is June–July, and multiplying it by
 *                     twelve through the monthly average would be absurd.
 *
 *   one_off           zero occurrences a year, so it drops out — unchanged
 *                     from the historical table.
 *
 *   transfers         excluded in both paths (小会计口径).
 */
export function annualizeCashflow(
  rows: PeriodRow[],
  basis: CashflowBasis | null,
): CashflowTotals {
  const b = normalise(basis, new Date().getFullYear());
  const basisMonths = b.to_month - b.from_month + 1;

  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let annualItemsIncome = 0;
  let annualItemsExpenses = 0;
  const withData = new Set<number>();

  for (const r of rows ?? []) {
    if (isAssetTransfer(r)) continue;
    if (yearOf(r.period_month) !== b.year) continue;
    const amount = amountOf(r);
    const inflow = r.direction === "inflow";

    if (isMonthlyActual(r)) {
      const m = monthOf(r.period_month);
      if (m == null || m < b.from_month || m > b.to_month) continue;
      withData.add(m);
      if (inflow) monthlyIncome += amount;
      else monthlyExpenses += amount;
    } else {
      // Anywhere in the basis year, not just inside the month window.
      const occurrences = ANNUAL_OCCURRENCES[r.frequency] ?? 12;
      const annual = amount * occurrences;
      if (inflow) annualItemsIncome += annual;
      else annualItemsExpenses += annual;
    }
  }

  const divisor = withData.size || 1;
  const avgIncome = monthlyIncome / divisor;
  const avgExpenses = monthlyExpenses / divisor;

  const annualIncome = avgIncome * 12 + annualItemsIncome;
  const annualExpenses = avgExpenses * 12 + annualItemsExpenses;

  return {
    annual_income: annualIncome,
    annual_expenses: annualExpenses,
    monthly_income: annualIncome / 12,
    monthly_expenses: annualExpenses / 12,
    basis_months: basisMonths,
    months_with_data: [...withData].sort((a, b2) => a - b2),
    annual_items_income: annualItemsIncome,
    annual_items_expenses: annualItemsExpenses,
  };
}

export interface CategoryTotals {
  category: string;
  annual_income: number;
  annual_expenses: number;
  monthly_income: number;
  monthly_expenses: number;
}

/**
 * annualizeCashflow, split by category. Monthly rows are divided by the SAME
 * number of months as the totals (months in the basis holding any
 * non-transfer data), so the categories add up exactly to annualizeCashflow's
 * figures and no share can exceed 100%.
 *
 * `includeTransfers` adds transfer categories (e.g. SSPN and PRS deposits for
 * the tax-relief scan); they share the same divisor.
 */
export function annualizeByCategory(
  rows: PeriodRow[],
  basis: CashflowBasis | null,
  opts: { includeTransfers?: boolean } = {},
): CategoryTotals[] {
  const b = normalise(basis, new Date().getFullYear());
  const divisor = annualizeCashflow(rows, basis).months_with_data.length || 1;
  const acc = new Map<string, { mi: number; me: number; ai: number; ae: number }>();

  for (const r of rows ?? []) {
    if (!opts.includeTransfers && isAssetTransfer(r)) continue;
    if (yearOf(r.period_month) !== b.year) continue;
    const key = r.category ?? "uncategorised";
    const a = acc.get(key) ?? { mi: 0, me: 0, ai: 0, ae: 0 };
    const amount = amountOf(r);
    const inflow = r.direction === "inflow";
    if (isMonthlyActual(r)) {
      const m = monthOf(r.period_month);
      if (m == null || m < b.from_month || m > b.to_month) continue;
      if (inflow) a.mi += amount;
      else a.me += amount;
    } else {
      const annual = amount * (ANNUAL_OCCURRENCES[r.frequency] ?? 12);
      if (inflow) a.ai += annual;
      else a.ae += annual;
    }
    acc.set(key, a);
  }

  return [...acc.entries()].map(([category, a]) => {
    const annual_income = (a.mi / divisor) * 12 + a.ai;
    const annual_expenses = (a.me / divisor) * 12 + a.ae;
    return {
      category,
      annual_income,
      annual_expenses,
      monthly_income: annual_income / 12,
      monthly_expenses: annual_expenses / 12,
    };
  });
}

export interface YearActuals {
  year: number;
  income: number;
  expenses: number;
  surplus: number;
  months_with_data: number[];
}

/**
 * What the client ACTUALLY earned and spent in a year so far — the sum of the
 * months on record.
 *
 * This is a different number from `annualizeCashflow().annual_income` and the
 * two must never be swapped. June RM 6,000 plus July RM 4,000 is RM 10,000 of
 * actual income and a RM 60,000 annual RUN-RATE. The first is what the advisor
 * and client look at on the cashflow screen; the second is what a savings
 * ratio or a retirement projection has to be built on. Labelling one as the
 * other is how a client ends up reading that they earn RM 10,000 a year.
 *
 * Non-monthly items (an annual bonus) are counted at face value here, because
 * this is a record of what happened, not a projection.
 */
export function yearToDateTotals(rows: PeriodRow[], year: number): YearActuals {
  let income = 0;
  let expenses = 0;
  const months = new Set<number>();
  for (const r of rows ?? []) {
    if (isAssetTransfer(r)) continue;
    if (yearOf(r.period_month) !== year) continue;
    const m = monthOf(r.period_month);
    if (m == null) continue;
    months.add(m);
    const amount = amountOf(r);
    if (r.direction === "inflow") income += amount;
    else expenses += amount;
  }
  return {
    year,
    income,
    expenses,
    surplus: income - expenses,
    months_with_data: [...months].sort((a, b) => a - b),
  };
}

/** "2026 年 6–7 月" / "2026 年 6 月" — printed on the report so the client can
 *  see which months the plan was built on. */
export function formatBasis(basis: CashflowBasis | null, lang: "zh" | "en" = "zh"): string {
  if (!basis) return lang === "zh" ? "无记录" : "no data";
  const { year, from_month, to_month } = basis;
  if (lang === "en") {
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return from_month === to_month
      ? `${MONTHS[from_month - 1]} ${year}`
      : `${MONTHS[from_month - 1]}–${MONTHS[to_month - 1]} ${year}`;
  }
  return from_month === to_month
    ? `${year} 年 ${from_month} 月`
    : `${year} 年 ${from_month}–${to_month} 月`;
}
