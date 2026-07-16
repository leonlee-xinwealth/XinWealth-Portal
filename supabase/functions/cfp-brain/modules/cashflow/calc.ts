// 现金流管家 — deterministic cashflow & budget calculator. Pure, no LLM.
// Mostly reads the shared baseline (single source of truth) and adds the
// breakdowns + emergency-fund verdict the section renders.

import type { CfpData, FinancialBaseline } from "../../types.ts";
import { CASHFLOW_ANNUALIZE } from "../../baseline.ts";

export type EmergencyFundStatus = "sufficient" | "partial" | "insufficient";

export interface CategoryBreakdown {
  category: string;
  monthly_amount: number;
  share: number | null;
}

export interface CashflowDet {
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  annual_income: number;
  annual_expenses: number;
  annual_surplus: number;
  savings_ratio: number | null;
  debt_service_ratio: number | null;
  income_breakdown: CategoryBreakdown[];
  expense_breakdown: CategoryBreakdown[];
  emergency_fund: {
    need_low: number;
    need_high: number;
    actual: number;
    months_covered: number | null;
    shortfall: number;
    status: EmergencyFundStatus;
  };
  insufficient_data: boolean;
}

const round = (n: number) => Math.round(n);

function breakdown(
  rows: CfpData["cashflow"],
  direction: "inflow" | "outflow",
  monthlyTotal: number,
): CategoryBreakdown[] {
  const byCategory = new Map<string, number>();
  for (const r of rows) {
    if (r.direction !== direction) continue;
    const monthly = r.amount * (CASHFLOW_ANNUALIZE[r.frequency] ?? 12) / 12;
    const key = r.category ?? "uncategorised";
    byCategory.set(key, (byCategory.get(key) ?? 0) + monthly);
  }
  return [...byCategory.entries()]
    .map(([category, monthly]) => ({
      category,
      monthly_amount: round(monthly),
      share: monthlyTotal > 0
        ? Number((monthly / monthlyTotal).toFixed(4))
        : null,
    }))
    .sort((a, b) => b.monthly_amount - a.monthly_amount);
}

export function computeCashflow(
  f: CfpData,
  b: FinancialBaseline,
): CashflowDet {
  const monthlyIncome = b.annual_income / 12;
  const monthlyExpenses = b.annual_expenses / 12;

  const actual = b.emergency_fund_actual;
  const needLow = b.emergency_fund_need_low;
  const needHigh = b.emergency_fund_need_high;
  const status: EmergencyFundStatus = actual >= needHigh
    ? "sufficient"
    : actual >= needLow
    ? "partial"
    : "insufficient";

  return {
    monthly_income: round(monthlyIncome),
    monthly_expenses: round(monthlyExpenses),
    monthly_surplus: round(monthlyIncome - monthlyExpenses),
    annual_income: b.annual_income,
    annual_expenses: b.annual_expenses,
    annual_surplus: b.annual_surplus,
    savings_ratio: b.savings_ratio,
    debt_service_ratio: b.debt_service_ratio,
    income_breakdown: breakdown(f.cashflow, "inflow", monthlyIncome),
    expense_breakdown: breakdown(f.cashflow, "outflow", monthlyExpenses),
    emergency_fund: {
      need_low: needLow,
      need_high: needHigh,
      actual,
      months_covered: b.monthly_essential_expenses > 0
        ? Number((actual / b.monthly_essential_expenses).toFixed(1))
        : null,
      shortfall: Math.max(0, round(needHigh - actual)),
      status,
    },
    insufficient_data: b.annual_income <= 0,
  };
}
