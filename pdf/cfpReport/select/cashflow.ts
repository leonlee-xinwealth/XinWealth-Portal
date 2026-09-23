// P6 现金流概览 / P7 现金流明细 — reads cashflow_planning.content.
//
// One thing worth knowing about this module's numbers: cfp-brain's 小会计 draws a
// line between 真支出 and 资产转移. Money moved from a savings account into an
// investment is not spending, so it is excluded from `monthly_expenses` and
// reported separately as `asset_transfers_monthly`. The overview page prints it
// as its own step, otherwise the client sees a surplus that does not match their
// bank balance and stops trusting the whole report.

import type { CfpReportData } from "../types";
import type { Slice } from "../viz/Donut";
import type { WaterfallStep } from "../viz/Waterfall";
import type { TableRow } from "../viz/DataTable";
import { money } from "../viz/DataTable";
import { cashflowCategoryLabel } from "../labels/enums";

export interface CategoryRow {
  category: string;
  monthly: number;
  share: number | null;
}

/**
 * P6 决策 1 (P2b baseline): one auto-derived installment/premium/statutory
 * item that cfp-brain folded into the plan instead of a hand-typed row —
 * `financial_reports.baseline.derived_items` (FinancialBaseline, not the
 * section content, which never carries these). A loan installment's 本金
 * (principal) / 利息 (interest) split is populated only for
 * `sourceType === "liability"`; a premium or statutory item leaves both null.
 */
export interface AutoItemRow {
  key: string;
  sourceType: "liability" | "policy" | "statutory";
  sourceName: string;
  categoryLabel: string;
  monthly: number;
  principalMonthly: number | null;
  interestMonthly: number | null;
  /** true when any of the item's fields (payment/rate/term, or the
   *  statutory rate itself) were estimated rather than given */
  estimated: boolean;
}

/** P2b 决策 4: a one_off standing item near "now", listed separately from
 *  the recurring monthly breakdown so it never distorts the monthly figures. */
export interface OneOffItemRow {
  categoryLabel: string;
  name: string | null;
  amount: number;
  direction: "inflow" | "outflow";
  /** 'YYYY-MM', or null when the source item had no usable month */
  month: string | null;
}

export interface CashflowView {
  hasData: boolean;
  /**
   * Which months of actuals every figure below was annualised from, already
   * formatted. The client is entitled to see the assumption: "RM 1,420 a month"
   * means something different when it comes from one recorded month than from
   * twelve, and the report has no business hiding which.
   */
  basisLabel: string | null;
  /** true when the window holds months with no entries — stated as a caveat */
  basisHasGap: boolean;
  /** P2b 决策 1: which of cashflow_items / cashflow_entries the plan came
   *  from — null on a baseline written before this field existed. */
  cashflowSource: "items" | "actuals" | null;
  /** Ready-to-print basis sentence covering BOTH sources uniformly — "依据：
   *  常设项目（截至 2026-09）" on the items path, or the actuals sentence.
   *  Null when the baseline predates cashflow_source (legacy report). */
  planBasisLine: string | null;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySurplus: number;
  annualIncome: number;
  annualExpenses: number;
  annualSurplus: number;
  assetTransfersMonthly: number;
  savingsRatio: number | null;
  income: CategoryRow[];
  expenses: CategoryRow[];
  emergency: {
    actual: number;
    needLow: number;
    needHigh: number;
    monthsCovered: number | null;
    shortfall: number;
    status: "sufficient" | "partial" | "insufficient" | null;
  } | null;
  /** P2b 决策 6: employee EPF — already excluded from monthlyExpenses (it's a
   *  transfer, not spending); shown as its own savings line. 0 when the
   *  client has no statutory EPF. */
  employeeEpfMonthly: number;
  /** P2b 决策 6: employer EPF — never in the client's own cash flow; an
   *  info line only, for net-worth reconciliation. */
  employerEpfMonthly: number;
  socsoEisMonthly: number;
  /** P2b 决策 6: annual_surplus minus the employee EPF that can't be
   *  redirected — null on a baseline written before this field existed. */
  disposableSurplusAnnual: number | null;
  /** Installments (本金/利息 split), premiums and statutory deductions the
   *  plan folded in automatically — empty when the client has none, or on a
   *  baseline written before P2a/P2b. */
  autoItems: AutoItemRow[];
  oneOffItems: OneOffItemRow[];
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function rows(raw: unknown): CategoryRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({
      category: String(r?.category ?? "").trim()
        ? cashflowCategoryLabel(String(r.category).trim(), "zh")
        : "未分类",
      monthly: num(r?.monthly_amount),
      share: typeof r?.share === "number" ? r.share : null,
    }))
    .filter((r) => r.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);
}

/**
 * The months the plan was annualised from, read off the stored baseline.
 *
 * Formatted here rather than imported from the shared module: this file is the
 * PDF's view layer and the report's phrasing is its own concern. The shape is
 * pinned to the server's by __tests__/cashflow.test.ts.
 */
function basisOf(data: CfpReportData): { label: string | null; hasGap: boolean } {
  const b = data.baseline?.cashflow_basis ?? null;
  if (!b || typeof b.year !== "number") return { label: null, hasGap: false };
  const label = b.from_month === b.to_month
    ? `${b.year} 年 ${b.from_month} 月`
    : `${b.year} 年 ${b.from_month}–${b.to_month} 月`;
  const span = data.baseline?.cashflow_basis_months ?? null;
  const withData = data.baseline?.cashflow_months_with_data?.length ?? null;
  return {
    label,
    hasGap: span != null && withData != null && withData < span,
  };
}

/**
 * P2b 决策 1: one sentence covering whichever basis the plan actually rests
 * on. `data.baseline` — not the section content, which never carries
 * `cashflow_source`/`items_as_of` — is the only place this lives; see
 * FinancialBaseline in supabase/functions/cfp-brain/types.ts.
 */
function planBasisLineOf(
  data: CfpReportData,
  basis: { label: string | null; hasGap: boolean },
): { source: "items" | "actuals" | null; line: string | null } {
  const source = data.baseline?.cashflow_source;
  if (source === "items") {
    const asOf = typeof data.baseline?.items_as_of === "string"
      ? data.baseline.items_as_of.slice(0, 7)
      : null;
    return { source, line: asOf ? `依据：常设项目（截至 ${asOf}）` : "依据：常设项目" };
  }
  if (source === "actuals") {
    return {
      source,
      line: basis.label
        ? `依据：实际记录年化（${basis.label}）${basis.hasGap ? "，区间内部分月份无记录" : ""}`
        : null,
    };
  }
  return { source: null, line: null };
}

/** P2a/P2b: the installments/premiums/statutory deductions cfp-brain folded
 *  into the plan automatically, read off `data.baseline.derived_items` — the
 *  section content never carries these either. */
function autoItemRowsOf(data: CfpReportData): AutoItemRow[] {
  const items = data.baseline?.derived_items;
  if (!Array.isArray(items)) return [];
  return items.map((d, i) => {
    const isLoan = d?.source_type === "liability";
    return {
      key: String(d?.key ?? `${d?.source_type ?? "item"}:${i}`),
      sourceType: (d?.source_type === "policy" || d?.source_type === "statutory") ? d.source_type : "liability",
      sourceName: String(d?.source_name ?? ""),
      categoryLabel: cashflowCategoryLabel(d?.category, "zh"),
      monthly: num(d?.monthly_amount),
      principalMonthly: isLoan ? num(d?.principal_monthly) : null,
      interestMonthly: isLoan ? num(d?.interest_monthly) : null,
      estimated: Array.isArray(d?.estimated) && d.estimated.length > 0,
    };
  });
}

/** P2b 决策 4: `content.one_off_items` mirrors `baseline.one_off_items`
 *  verbatim (cfp-brain's cashflow calc copies it straight through), so the
 *  section content is a fine source and keeps this in step with the rest of
 *  the selector, which reads `c`. */
function oneOffItemRowsOf(raw: unknown): OneOffItemRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it) => ({
    categoryLabel: cashflowCategoryLabel(it?.category, "zh"),
    name: typeof it?.name === "string" && it.name.trim() ? it.name.trim() : null,
    amount: num(it?.amount),
    direction: it?.direction === "inflow" ? "inflow" : "outflow",
    month: typeof it?.effective_from === "string" ? it.effective_from.slice(0, 7) : null,
  }));
}

export function selectCashflow(data: CfpReportData): CashflowView {
  const c = data.sections?.find((s) => s.section_type === "cashflow_planning")?.content ?? null;
  const basis = basisOf(data);
  const planBasis = planBasisLineOf(data, basis);
  const b = data.baseline ?? null;

  const baselineFields = {
    cashflowSource: planBasis.source,
    planBasisLine: planBasis.line,
    employeeEpfMonthly: num(b?.monthly_employee_epf),
    employerEpfMonthly: num(b?.monthly_employer_epf),
    socsoEisMonthly: num(b?.monthly_socso_eis),
    disposableSurplusAnnual: typeof b?.annual_disposable_surplus === "number"
      ? b.annual_disposable_surplus
      : null,
    autoItems: autoItemRowsOf(data),
  };

  const empty: CashflowView = {
    hasData: false,
    basisLabel: basis.label, basisHasGap: basis.hasGap,
    monthlyIncome: 0, monthlyExpenses: 0, monthlySurplus: 0,
    annualIncome: 0, annualExpenses: 0, annualSurplus: 0,
    assetTransfersMonthly: 0, savingsRatio: null,
    income: [], expenses: [], emergency: null,
    oneOffItems: [],
    ...baselineFields,
  };
  if (!c || c.insufficient_data) return empty;

  const ef = c.emergency_fund ?? null;
  return {
    hasData: num(c.monthly_income) > 0 || num(c.monthly_expenses) > 0,
    basisLabel: basis.label,
    basisHasGap: basis.hasGap,
    monthlyIncome: num(c.monthly_income),
    monthlyExpenses: num(c.monthly_expenses),
    monthlySurplus: num(c.monthly_surplus),
    annualIncome: num(c.annual_income),
    annualExpenses: num(c.annual_expenses),
    annualSurplus: num(c.annual_surplus),
    assetTransfersMonthly: num(c.asset_transfers_monthly),
    savingsRatio: typeof c.savings_ratio === "number" ? c.savings_ratio : null,
    income: rows(c.income_breakdown),
    expenses: rows(c.expense_breakdown),
    emergency: ef
      ? {
          actual: num(ef.actual),
          needLow: num(ef.need_low),
          needHigh: num(ef.need_high),
          monthsCovered: typeof ef.months_covered === "number" ? ef.months_covered : null,
          shortfall: num(ef.shortfall),
          status: ef.status ?? null,
        }
      : null,
    oneOffItems: oneOffItemRowsOf(c.one_off_items),
    ...baselineFields,
  };
}

/** P6 waterfall: income in, expenses and transfers out, surplus left standing. */
export function cashflowWaterfall(v: CashflowView): WaterfallStep[] {
  if (!v.hasData) return [];
  const steps: WaterfallStep[] = [
    { label: "月收入", delta: v.monthlyIncome },
    { label: "月支出", delta: -v.monthlyExpenses },
  ];
  if (v.assetTransfersMonthly > 0) {
    steps.push({ label: "资产转移", delta: -v.assetTransfersMonthly });
  }
  steps.push({ label: "月结余", delta: 0, isTotal: true });
  return steps;
}

export function expenseSlices(v: CashflowView): Slice[] {
  return v.expenses.map((r) => ({ label: r.category, value: r.monthly }));
}

export function incomeSlices(v: CashflowView): Slice[] {
  return v.income.map((r) => ({ label: r.category, value: r.monthly }));
}

/** P7 detail table: income group, expense group, then the net line. */
export function cashflowRows(v: CashflowView): TableRow[] {
  if (!v.hasData) return [];
  const out: TableRow[] = [];

  out.push({ kind: "group", label: "收入" });
  for (const r of v.income) {
    out.push({
      kind: "row", label: r.category, indent: true,
      meta: r.share != null ? `${(r.share * 100).toFixed(0)}%` : undefined,
      value: money(r.monthly),
    });
  }
  out.push({ kind: "subtotal", label: "月收入合计", value: money(v.monthlyIncome) });

  out.push({ kind: "group", label: "支出" });
  for (const r of v.expenses) {
    out.push({
      kind: "row", label: r.category, indent: true,
      meta: r.share != null ? `${(r.share * 100).toFixed(0)}%` : undefined,
      value: money(-r.monthly),
    });
  }
  out.push({ kind: "subtotal", label: "月支出合计", value: money(-v.monthlyExpenses) });

  if (v.assetTransfersMonthly > 0) {
    out.push({ kind: "group", label: "资产转移（非支出）" });
    out.push({
      kind: "row", label: "转入自有资产", indent: true,
      value: money(-v.assetTransfersMonthly),
    });
  }

  out.push({ kind: "total", label: "月净结余", value: money(v.monthlySurplus) });
  return out;
}

/**
 * P7 附表: the auto-included installments/premiums/statutory deductions —
 * marked 「自动」 (and 「估算」 when a field was filled in rather than given)
 * so the client can tell a computed line from a hand-typed one. A loan's 本金
 * /利息 split rides in `meta`; the value column stays the single monthly
 * total every other row uses.
 */
export function autoItemRows(v: CashflowView): TableRow[] {
  if (v.autoItems.length === 0) return [];
  const tag = (it: AutoItemRow) => it.estimated ? "自动 · 估算" : "自动";
  return v.autoItems.map((it) => ({
    kind: "row" as const,
    label: it.sourceName || it.categoryLabel,
    meta: it.principalMonthly != null && it.interestMonthly != null
      ? `${it.categoryLabel} · 本金 ${money(it.principalMonthly)} · 利息 ${money(it.interestMonthly)} · ${tag(it)}`
      : `${it.categoryLabel} · ${tag(it)}`,
    value: money(it.monthly),
  }));
}

/** P7 附表: one_off items, listed on their own so they never inflate the
 *  monthly breakdown above. */
export function oneOffRows(v: CashflowView): TableRow[] {
  if (v.oneOffItems.length === 0) return [];
  return v.oneOffItems.map((it) => ({
    kind: "row" as const,
    label: it.name || it.categoryLabel,
    meta: it.month ? `${it.categoryLabel} · ${it.month}` : it.categoryLabel,
    value: it.direction === "inflow" ? money(it.amount) : money(-it.amount),
  }));
}
