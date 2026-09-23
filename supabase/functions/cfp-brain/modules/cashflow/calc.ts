// 小会计 (Little Accountant) — deterministic cashflow & budget calculator.
// Pure, no LLM. Reads the shared baseline (single source of truth) and adds
// breakdowns, the true-expense vs asset-transfer split, and the emergency-fund
// verdict. Persona duty: awareness, not judgement — the numbers here let the
// client SEE where money goes.

import type { CfpData, FinancialBaseline } from "../../types.ts";
import { annualizeByCategory, isTransferCode } from "../../../_shared/cashflow/periods.ts";
import { annualizeItemsByCategory, type StandingItem } from "../../../_shared/cashflow/items.ts";
import { isSuperseded, type DerivedItem } from "../../../_shared/finance/derived.ts";

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
  /** 真支出 vs 资产转移: monthly total moved into the client's own assets
   * (savings → investment etc.) — excluded from expenses, shown separately */
  asset_transfers_monthly: number;
  emergency_fund: {
    need_low: number;
    need_high: number;
    actual: number;
    months_covered: number | null;
    shortfall: number;
    status: EmergencyFundStatus;
  };
  insufficient_data: boolean;
  /** P2b 决策 4: one_off items near "now" — surfaced verbatim from the
   *  baseline (empty on the actuals path). */
  one_off_items: StandingItem[];
}

const round = (n: number) => Math.round(n);

/**
 * P2a (决策 4, 5): manual rows superseded by a derived loan/premium item are
 * dropped here — same rule planCashflow applies to the totals — and the
 * derived items (outflow only; none are transfers) are merged in by
 * category, so the breakdown always adds up to the SAME monthly total the
 * baseline reports and shares never exceed 100%.
 */
function breakdown(
  rows: CfpData["cashflow"],
  basis: FinancialBaseline["cashflow_basis"],
  direction: "inflow" | "outflow",
  monthlyTotal: number,
  liabilities: CfpData["liabilities"],
  policies: CfpData["policies"],
  derivedItems: DerivedItem[],
): CategoryBreakdown[] {
  // Same filter + divisor as planCashflow's totals, so the categories add up
  // to the whole.
  const keptRows = rows.filter((r) => !isSuperseded(r, liabilities, policies));

  const merged = new Map<string, number>();
  for (const t of annualizeByCategory(keptRows, basis)) {
    const monthly = direction === "inflow" ? t.monthly_income : t.monthly_expenses;
    if (monthly > 0) merged.set(t.category, (merged.get(t.category) ?? 0) + monthly);
  }
  if (direction === "outflow") {
    for (const item of derivedItems) {
      if (isTransferCode(item.category)) continue;
      merged.set(item.category, (merged.get(item.category) ?? 0) + item.monthly_amount);
    }
  }

  return [...merged.entries()]
    .filter(([, monthly]) => monthly > 0)
    .map(([category, monthly]) => ({
      category,
      monthly_amount: round(monthly),
      share: monthlyTotal > 0 ? Number((monthly / monthlyTotal).toFixed(4)) : null,
    }))
    .sort((a, b) => b.monthly_amount - a.monthly_amount);
}

/**
 * P2b 决策 1: the items-path analogue of `breakdown` above — active,
 * non-superseded standing items (决策 8, same dedupe rule) instead of
 * actuals rows, plus the SAME derived loan/premium/statutory items merged in
 * by category. `epf_employee` (a transfer, O1) never reaches the expense
 * breakdown, exactly like `breakdown`'s own transfer exclusion; `socso_eis`
 * (a real O9 expense) does.
 */
function itemsBreakdown(
  items: StandingItem[],
  asOf: string,
  direction: "inflow" | "outflow",
  monthlyTotal: number,
  liabilities: CfpData["liabilities"],
  policies: CfpData["policies"],
  derivedItems: DerivedItem[],
): CategoryBreakdown[] {
  const kept = items.filter((it) => !isSuperseded(it, liabilities, policies));

  const merged = new Map<string, number>();
  for (const t of annualizeItemsByCategory(kept, asOf)) {
    const monthly = direction === "inflow" ? t.monthly_income : t.monthly_expenses;
    if (monthly > 0) merged.set(t.category, (merged.get(t.category) ?? 0) + monthly);
  }
  if (direction === "outflow") {
    for (const item of derivedItems) {
      if (isTransferCode(item.category)) continue;
      merged.set(item.category, (merged.get(item.category) ?? 0) + item.monthly_amount);
    }
  }

  return [...merged.entries()]
    .filter(([, monthly]) => monthly > 0)
    .map(([category, monthly]) => ({
      category,
      monthly_amount: round(monthly),
      share: monthlyTotal > 0 ? Number((monthly / monthlyTotal).toFixed(4)) : null,
    }))
    .sort((a, b) => b.monthly_amount - a.monthly_amount);
}

/** P2b: the items-path analogue of the `asset_transfers_monthly` figure —
 *  transfer-category standing items (e.g. a unit-trust contribution) plus
 *  any transfer-category derived item (statutory `epf_employee`). */
function itemsAssetTransfersMonthly(
  items: StandingItem[],
  asOf: string,
  liabilities: CfpData["liabilities"],
  policies: CfpData["policies"],
  derivedItems: DerivedItem[],
): number {
  const kept = items.filter((it) => !isSuperseded(it, liabilities, policies));
  const fromItems = annualizeItemsByCategory(kept, asOf, { includeTransfers: true })
    .filter((t) => isTransferCode(t.category))
    .reduce((s, t) => s + t.monthly_expenses, 0);
  const fromDerived = derivedItems
    .filter((d) => isTransferCode(d.category))
    .reduce((s, d) => s + d.monthly_amount, 0);
  return fromItems + fromDerived;
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
    // P2b 决策 1: on the items path, the breakdown comes from active,
    // non-superseded standing items (决策 8) instead of actuals rows —
    // `b.items_as_of` is the SAME "as of" month the baseline itself used, so
    // this never re-filters against a different moment than the totals above
    // were built from.
    income_breakdown: b.cashflow_source === "items" && b.items_as_of
      ? itemsBreakdown(f.items ?? [], b.items_as_of, "inflow", monthlyIncome, f.liabilities, f.policies, b.derived_items)
      : breakdown(f.cashflow, b.cashflow_basis, "inflow", monthlyIncome, f.liabilities, f.policies, b.derived_items),
    expense_breakdown: b.cashflow_source === "items" && b.items_as_of
      ? itemsBreakdown(f.items ?? [], b.items_as_of, "outflow", monthlyExpenses, f.liabilities, f.policies, b.derived_items)
      : breakdown(f.cashflow, b.cashflow_basis, "outflow", monthlyExpenses, f.liabilities, f.policies, b.derived_items),
    asset_transfers_monthly: round(
      b.cashflow_source === "items" && b.items_as_of
        ? itemsAssetTransfersMonthly(f.items ?? [], b.items_as_of, f.liabilities, f.policies, b.derived_items)
        : annualizeByCategory(f.cashflow, b.cashflow_basis, { includeTransfers: true })
          .filter((t) => isTransferCode(t.category))
          .reduce((s, t) => s + t.monthly_expenses, 0),
    ),
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
    one_off_items: b.one_off_items,
  };
}
