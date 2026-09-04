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

export interface CategoryRow {
  category: string;
  monthly: number;
  share: number | null;
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
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function rows(raw: unknown): CategoryRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({
      category: String(r?.category ?? "").trim() || "未分类",
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

export function selectCashflow(data: CfpReportData): CashflowView {
  const c = data.sections?.find((s) => s.section_type === "cashflow_planning")?.content ?? null;
  const basis = basisOf(data);

  const empty: CashflowView = {
    hasData: false,
    basisLabel: basis.label, basisHasGap: basis.hasGap,
    monthlyIncome: 0, monthlyExpenses: 0, monthlySurplus: 0,
    annualIncome: 0, annualExpenses: 0, annualSurplus: 0,
    assetTransfersMonthly: 0, savingsRatio: null,
    income: [], expenses: [], emergency: null,
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
