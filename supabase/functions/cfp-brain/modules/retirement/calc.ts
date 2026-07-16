// 退休规划师 — deterministic retirement capital-gap calculator. Pure, no LLM.
// income_need = annual_expenses × replacement_ratio × (1+inflation)^years
// capital_needed = income_need / withdrawal_rate (4% rule)
// EPF/PRS/other investable balances are each projected forward at their own
// growth rate, and the shortfall closes via a sinking-fund monthly top-up.

import type { CfpData, FinancialBaseline } from "../../types.ts";
import { pmtMonthly } from "../goals/calc.ts";

const EPF_ASSET_TYPES = ["epf_account_1", "epf_account_2", "epf_account_3"];
const OTHER_INVESTABLE_ASSET_TYPES = ["stock", "etf", "bond", "unit_trust"];
/** 11% employee + 12% employer statutory EPF contribution. */
const EPF_CONTRIBUTION_RATE = 0.23;

export interface RetirementDet {
  insufficient_data: boolean;
  years_to_retirement: number | null;
  retirement_years: number;
  income_need_at_retirement: number;
  capital_needed: number;
  epf_balance: number;
  annual_epf_contribution: number;
  epf_projected: number;
  prs_balance: number;
  prs_projected: number;
  other_investable: number;
  other_projected: number;
  total_projected: number;
  gap: number;
  required_monthly_topup: number;
  on_track: boolean;
  replacement_ratio_used: number;
  inflation_used: number;
  withdrawal_rate_used: number;
  life_expectancy_used: number;
  epf_dividend_used: number;
  investment_return_used: number;
  depletion_age: number | null;
  survives_to_85: boolean;
  survives_to_100: boolean;
  post_retirement_rate_used: number;
}

const round = (n: number) => Math.round(n);

/**
 * 极限压力测试 — simulates drawing down capitalAtRetirement year by year from
 * retirementAge, growing at postRetirementRate and withdrawing an
 * inflation-adjusted annual need, until either capital runs out (depletion)
 * or maxAge is reached (survives).
 */
export function simulateDrawdown(
  capitalAtRetirement: number,
  annualNeedAtRetirement: number,
  retirementAge: number,
  postRetirementRate: number,
  inflation: number,
  maxAge = 100,
): { depletion_age: number | null; survives_to_85: boolean; survives_to_100: boolean } {
  let capital = capitalAtRetirement;
  let need = annualNeedAtRetirement;
  let depletionAge: number | null = null;

  for (let age = retirementAge; age < maxAge; age++) {
    capital = capital * (1 + postRetirementRate) - need;
    if (capital < 0) {
      depletionAge = age;
      break;
    }
    need = need * (1 + inflation);
  }

  return {
    depletion_age: depletionAge,
    survives_to_85: depletionAge === null || depletionAge > 85,
    survives_to_100: depletionAge === null || depletionAge > 100,
  };
}

export function computeRetirement(
  f: CfpData,
  b: FinancialBaseline,
): RetirementDet {
  const r = b.assumptions;
  const years = b.years_to_retirement;

  const epfBalance = round(
    f.assets
      .filter((a) => EPF_ASSET_TYPES.includes(a.asset_type))
      .reduce((s, a) => s + (a.current_value ?? 0), 0),
  );
  const prsBalance = round(
    f.investment_accounts.reduce(
      (s, a) => s + (a.prs_sub_account_a ?? 0) + (a.prs_sub_account_b ?? 0),
      0,
    ),
  );
  const otherInvestable = round(
    f.assets
      .filter((a) => OTHER_INVESTABLE_ASSET_TYPES.includes(a.asset_type))
      .reduce((s, a) => s + (a.current_value ?? 0), 0) +
      f.holdings.reduce((s, h) => s + (h.market_value ?? 0), 0),
  );

  const retirementYears = Math.max(0, r.life_expectancy - b.retirement_age);

  const base = {
    replacement_ratio_used: r.retirement_replacement_ratio,
    inflation_used: r.inflation,
    withdrawal_rate_used: r.withdrawal_rate,
    life_expectancy_used: r.life_expectancy,
    epf_dividend_used: r.epf_dividend,
    investment_return_used: r.client_investment_return,
  };

  if (years == null) {
    return {
      insufficient_data: true,
      years_to_retirement: null,
      retirement_years: retirementYears,
      income_need_at_retirement: 0,
      capital_needed: 0,
      epf_balance: epfBalance,
      annual_epf_contribution: 0,
      epf_projected: 0,
      prs_balance: prsBalance,
      prs_projected: 0,
      other_investable: otherInvestable,
      other_projected: 0,
      total_projected: 0,
      gap: 0,
      required_monthly_topup: 0,
      on_track: false,
      depletion_age: null,
      survives_to_85: false,
      survives_to_100: false,
      post_retirement_rate_used: r.epf_dividend,
      ...base,
    };
  }

  const incomeNeed = b.annual_expenses * r.retirement_replacement_ratio *
    Math.pow(1 + r.inflation, years);
  const capitalNeeded = r.withdrawal_rate > 0 ? incomeNeed / r.withdrawal_rate : 0;

  const annualEpfContribution = f.client.employment_status === "employed"
    ? EPF_CONTRIBUTION_RATE * b.annual_income
    : 0;

  const epfGrowth = Math.pow(1 + r.epf_dividend, years);
  const epfProjected = r.epf_dividend !== 0
    ? epfBalance * epfGrowth +
      annualEpfContribution * (epfGrowth - 1) / r.epf_dividend
    : epfBalance + annualEpfContribution * years;

  const prsProjected = prsBalance * Math.pow(1 + r.client_investment_return, years);
  const otherProjected = otherInvestable *
    Math.pow(1 + r.client_investment_return, years);

  const totalProjected = epfProjected + prsProjected + otherProjected;
  const gap = Math.max(0, capitalNeeded - totalProjected);
  const requiredMonthlyTopup = pmtMonthly(gap, r.client_investment_return, years);

  const drawdown = simulateDrawdown(
    round(totalProjected),
    round(incomeNeed),
    b.retirement_age,
    r.epf_dividend,
    r.inflation,
  );

  return {
    insufficient_data: false,
    years_to_retirement: years,
    retirement_years: retirementYears,
    income_need_at_retirement: round(incomeNeed),
    capital_needed: round(capitalNeeded),
    epf_balance: epfBalance,
    annual_epf_contribution: round(annualEpfContribution),
    epf_projected: round(epfProjected),
    prs_balance: prsBalance,
    prs_projected: round(prsProjected),
    other_investable: otherInvestable,
    other_projected: round(otherProjected),
    total_projected: round(totalProjected),
    gap: round(gap),
    required_monthly_topup: round(requiredMonthlyTopup),
    on_track: gap <= 0,
    depletion_age: drawdown.depletion_age,
    survives_to_85: drawdown.survives_to_85,
    survives_to_100: drawdown.survives_to_100,
    post_retirement_rate_used: r.epf_dividend,
    ...base,
  };
}
