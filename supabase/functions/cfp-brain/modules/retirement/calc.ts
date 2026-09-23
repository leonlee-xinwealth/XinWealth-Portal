// 退休规划师 — deterministic retirement capital-gap calculator. Pure, no LLM.
// income_need = annual_expenses × replacement_ratio × (1+inflation)^years
// capital_needed = income_need / withdrawal_rate (4% rule)
// EPF/PRS/other investable balances are each projected forward at their own
// growth rate, and the shortfall closes via a sinking-fund monthly top-up.

import type { CfpData, FinancialBaseline } from "../../types.ts";
import { pmtMonthly } from "../goals/calc.ts";
import { EPF_ASSET_TYPES, isRetirementCapital } from "../../../_shared/taxonomy/balance.ts";

/** 11% employee + 12% employer statutory EPF contribution. */
const EPF_CONTRIBUTION_RATE = 0.23;
/** the drawdown stress test runs to 100 — the report plots the curve to here */
const DRAWDOWN_MAX_AGE = 100;

export interface RetirementDet {
  insufficient_data: boolean;
  years_to_retirement: number | null;
  retirement_years: number;
  income_need_at_retirement: number;
  /**
   * 被动收入式退休 — the capital whose yield alone covers the income need, so
   * the principal is never touched and passes to the next generation.
   * income_need / withdrawal_rate, i.e. the 4% rule.
   */
  capital_needed: number;
  /**
   * 资金耗尽式退休 — the capital that is drawn down to exactly zero at life
   * expectancy. Always the smaller of the two, and the report puts them side by
   * side because the difference between them IS the choice the client is making.
   *
   * Present value of a growing annuity: the income need rises with inflation
   * while the remaining capital earns the post-retirement rate. Same assumptions
   * as the drawdown simulation, so the two never contradict each other.
   */
  capital_needed_depletion: number;
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
  /** 资金耐久曲线 — drawdown on the CURRENT trajectory (total_projected). */
  drawdown_baseline: DrawdownPoint[];
  /** the same drawdown once required_monthly_topup has closed the gap, i.e.
   * starting from capital_needed. Identical to baseline when already on track. */
  drawdown_optimized: DrawdownPoint[];
  /** age the simulation stops at when capital survives */
  drawdown_max_age: number;
}

const round = (n: number) => Math.round(n);

/**
 * Present value of `years` annual withdrawals starting at `first`, each one
 * `growth` larger than the last, discounted at `rate`.
 *
 * This is the capital that funds a rising cost of living and finishes at
 * exactly zero — the 资金耗尽式 figure. When rate and growth coincide the
 * closed form divides by zero, so that case is handled separately rather than
 * left to produce Infinity.
 */
export function growingAnnuityPv(
  first: number,
  rate: number,
  growth: number,
  years: number,
): number {
  if (years <= 0 || first <= 0) return 0;
  if (Math.abs(rate - growth) < 1e-9) return (first * years) / (1 + rate);
  return (first / (rate - growth)) *
    (1 - Math.pow((1 + growth) / (1 + rate), years));
}

/** One retirement year of the drawdown simulation, for plotting the curve. */
export interface DrawdownPoint {
  /** age at the START of the year */
  age: number;
  /** capital carried into the year */
  opening: number;
  /** inflation-adjusted amount withdrawn during the year */
  withdrawal: number;
  /** capital left at year end, floored at 0 so the curve lands on the axis
   * rather than plunging below it */
  closing: number;
}

export interface DrawdownResult {
  /** age during whose year the capital ran out; null = survived to maxAge */
  depletion_age: number | null;
  survives_to_85: boolean;
  survives_to_100: boolean;
  /** year-by-year series, ending at depletion or maxAge */
  series: DrawdownPoint[];
}

/**
 * 极限压力测试 — simulates drawing down capitalAtRetirement year by year from
 * retirementAge, growing at postRetirementRate and withdrawing an
 * inflation-adjusted annual need, until either capital runs out (depletion)
 * or maxAge is reached (survives).
 *
 * `series` exists so the report can plot the 资金耐久曲线; the three scalar
 * fields are unchanged and remain the contract older callers depend on.
 */
export function simulateDrawdown(
  capitalAtRetirement: number,
  annualNeedAtRetirement: number,
  retirementAge: number,
  postRetirementRate: number,
  inflation: number,
  maxAge = 100,
): DrawdownResult {
  let capital = capitalAtRetirement;
  let need = annualNeedAtRetirement;
  let depletionAge: number | null = null;
  const series: DrawdownPoint[] = [];

  for (let age = retirementAge; age < maxAge; age++) {
    const opening = capital;
    capital = capital * (1 + postRetirementRate) - need;
    series.push({
      age,
      opening: round(opening),
      withdrawal: round(need),
      closing: round(Math.max(0, capital)),
    });
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
    series,
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
      .filter((a) => isRetirementCapital(a.asset_type) && !EPF_ASSET_TYPES.includes(a.asset_type))
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
      capital_needed_depletion: 0,
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
      drawdown_baseline: [],
      drawdown_optimized: [],
      drawdown_max_age: DRAWDOWN_MAX_AGE,
      ...base,
    };
  }

  const incomeNeed = b.annual_expenses * r.retirement_replacement_ratio *
    Math.pow(1 + r.inflation, years);
  const capitalNeeded = r.withdrawal_rate > 0 ? incomeNeed / r.withdrawal_rate : 0;
  const capitalNeededDepletion = growingAnnuityPv(
    incomeNeed,
    r.epf_dividend,
    r.inflation,
    retirementYears,
  );

  // P2b 决策 6: when standing items produced a real statutory EPF figure, use
  // it directly (12 × employee + employer) instead of the 23% rule-of-thumb —
  // it already reflects the client's actual wage base, age band and the
  // ≤/>5,000 employer-rate threshold. Falls back to the old estimate when
  // there is no statutory item (actuals path, or has_epf isn't true).
  const statutoryMonthlyEpf = (b.monthly_employee_epf ?? 0) + (b.monthly_employer_epf ?? 0);
  const annualEpfContribution = statutoryMonthlyEpf > 0
    ? 12 * statutoryMonthlyEpf
    : f.client.employment_status === "employed"
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
    DRAWDOWN_MAX_AGE,
  );
  // The optimized curve is the same drawdown once the recommended top-up has
  // closed the gap — by construction that lands the client on capital_needed.
  // Already on track: the two curves are the same line.
  const drawdownOptimized = gap > 0
    ? simulateDrawdown(
      round(capitalNeeded),
      round(incomeNeed),
      b.retirement_age,
      r.epf_dividend,
      r.inflation,
      DRAWDOWN_MAX_AGE,
    )
    : drawdown;

  return {
    insufficient_data: false,
    years_to_retirement: years,
    retirement_years: retirementYears,
    income_need_at_retirement: round(incomeNeed),
    capital_needed: round(capitalNeeded),
    capital_needed_depletion: round(capitalNeededDepletion),
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
    drawdown_baseline: drawdown.series,
    drawdown_optimized: drawdownOptimized.series,
    drawdown_max_age: DRAWDOWN_MAX_AGE,
    ...base,
  };
}
