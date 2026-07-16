// Deterministic FinancialBaseline — the single source of truth every module
// calculator consumes. Pure function, no LLM, no network. Resolves the two
// coupling bugs the multi-agent design exists to fix:
//   1. emergency fund vs insurance CNA double-counting liquid assets
//      (liquid_assets_after_emergency reserves 6 months of essential spend)
//   2. unified economic assumptions so retirement/investment/goals never
//      diverge on returns or inflation.

import type {
  BaselineAssumptions,
  CfpData,
  FinancialBaseline,
  PlanningInputs,
} from "./types.ts";

export const BASELINE_DEFAULTS = {
  epf_dividend: 0.055,
  inflation: 0.035,
  education_inflation: 0.04,
  retirement_replacement_ratio: 0.66,
  withdrawal_rate: 0.04,
  life_expectancy: 85,
  default_retirement_age: 60,
  emergency_months_low: 3,
  emergency_months_high: 6,
  investment_return_by_band: {
    conservative: 0.04,
    moderate: 0.05,
    balanced: 0.06,
    growth: 0.075,
    aggressive: 0.09,
  } as Record<string, number>,
  default_band: "balanced",
} as const;

export const CASHFLOW_ANNUALIZE: Record<string, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  one_off: 0,
};

/** Asset types counting as emergency-fund-eligible liquid assets. */
export const LIQUID_ASSET_TYPES = ["savings", "fixed_deposit", "money_market"];

const round = (n: number) => Math.round(n);

export function ageFromDob(dob: string | null, now = new Date()): number | null {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (!isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / (365.25 * 24 * 3600 * 1000));
}

/** 小会计口径: rows linked to the client's own asset are transfers (savings →
 * investment etc.), not true income/expenses. Loan repayments
 * (linked_liability_id) remain true expenses. */
export function isAssetTransfer(r: CfpData["cashflow"][number]): boolean {
  return r.linked_asset_id != null;
}

function annualize(rows: CfpData["cashflow"], direction: "inflow" | "outflow"): number {
  return rows
    .filter((r) => r.direction === direction && !isAssetTransfer(r))
    .reduce((s, r) => s + r.amount * (CASHFLOW_ANNUALIZE[r.frequency] ?? 12), 0);
}

export function resolveAssumptions(
  riskProfile: string | null,
  overrides?: Partial<BaselineAssumptions>,
): BaselineAssumptions {
  const d = BASELINE_DEFAULTS;
  const band = riskProfile && d.investment_return_by_band[riskProfile]
    ? riskProfile
    : d.default_band;
  const base: BaselineAssumptions = {
    epf_dividend: d.epf_dividend,
    inflation: d.inflation,
    education_inflation: d.education_inflation,
    retirement_replacement_ratio: d.retirement_replacement_ratio,
    withdrawal_rate: d.withdrawal_rate,
    life_expectancy: d.life_expectancy,
    default_retirement_age: d.default_retirement_age,
    emergency_months_low: d.emergency_months_low,
    emergency_months_high: d.emergency_months_high,
    investment_return_by_band: { ...d.investment_return_by_band },
    client_investment_return: d.investment_return_by_band[band],
  };
  return { ...base, ...(overrides ?? {}) };
}

export function computeBaseline(
  f: CfpData,
  inputs: PlanningInputs = {},
  now = new Date(),
): FinancialBaseline {
  const assumptions = resolveAssumptions(
    f.client.risk_profile,
    inputs.assumption_overrides,
  );
  const notes: string[] = [];

  const annualIncome = annualize(f.cashflow, "inflow");
  const annualExpenses = annualize(f.cashflow, "outflow");
  const monthlyIncome = annualIncome / 12;
  // Essential-expense proxy: all recurring outflows. Category strings are
  // free-text, so a conservative "everything is essential" reading keeps the
  // emergency fund honest rather than optimistic.
  const monthlyEssential = annualExpenses / 12;
  notes.push("紧急预备金按全部经常性月支出为「必要支出」口径计算");
  notes.push("与自有资产挂钩的现金流视为资产转移，不计入收入或支出（还贷除外）");

  const emergencyNeedLow = monthlyEssential * assumptions.emergency_months_low;
  const emergencyNeedHigh = monthlyEssential * assumptions.emergency_months_high;

  const liquidTotal = f.assets
    .filter((a) => LIQUID_ASSET_TYPES.includes(a.asset_type))
    .reduce((s, a) => s + (a.current_value ?? 0), 0);
  // Reserve the conservative 6-month target before anything else claims the
  // cash — insurance CNA deducts only what is left (coupling fix #1).
  const liquidAfterEmergency = Math.max(0, liquidTotal - emergencyNeedHigh);
  notes.push(
    `可抵扣流动资产已预留 ${assumptions.emergency_months_high} 个月紧急预备金`,
  );

  const totalAssets = f.assets.reduce((s, a) => s + (a.current_value ?? 0), 0) +
    f.holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
  const totalLiabilities = f.liabilities.reduce(
    (s, l) => s + (l.outstanding_balance ?? 0),
    0,
  );
  const monthlyDebtService = f.liabilities.reduce(
    (s, l) => s + (l.monthly_payment ?? 0),
    0,
  );
  const netWorth = totalAssets - totalLiabilities;

  const age = ageFromDob(f.client.date_of_birth, now);
  const retirementAge = f.client.retirement_age ??
    assumptions.default_retirement_age;
  if (!f.client.retirement_age) {
    notes.push(`退休年龄未填写，按 ${retirementAge} 岁假设`);
  }
  if (annualIncome <= 0) {
    notes.push("未录得经常性收入，收入相关比率不具参考意义");
  }

  return {
    version: 1,
    annual_income: round(annualIncome),
    annual_expenses: round(annualExpenses),
    monthly_income: round(monthlyIncome),
    monthly_essential_expenses: round(monthlyEssential),
    annual_surplus: round(annualIncome - annualExpenses),
    emergency_fund_need_low: round(emergencyNeedLow),
    emergency_fund_need_high: round(emergencyNeedHigh),
    emergency_fund_actual: round(liquidTotal),
    liquid_assets_total: round(liquidTotal),
    liquid_assets_after_emergency: round(liquidAfterEmergency),
    total_assets: round(totalAssets),
    net_worth: round(netWorth),
    total_liabilities: round(totalLiabilities),
    monthly_debt_service: round(monthlyDebtService),
    debt_service_ratio: monthlyIncome > 0
      ? Number((monthlyDebtService / monthlyIncome).toFixed(4))
      : null,
    savings_ratio: annualIncome > 0
      ? Number(((annualIncome - annualExpenses) / annualIncome).toFixed(4))
      : null,
    solvency_ratio: totalAssets > 0
      ? Number((netWorth / totalAssets).toFixed(4))
      : null,
    current_year: now.getFullYear(),
    age,
    retirement_age: retirementAge,
    years_to_retirement: age != null ? Math.max(0, retirementAge - age) : null,
    dependents: f.client.number_of_dependants ?? 0,
    marital_status: f.client.marital_status,
    assumptions,
    baseline_notes: notes,
  };
}
