// 目标规划师 — deterministic goal funding calculator. Pure, no LLM.
// future_cost = target × (1+inflation)^years
// projected   = saved × (1+r)^years + FV(monthly contributions at r)
// required_monthly = sinking-fund payment closing the gap by target_year.

import type { CfpData, FinancialBaseline } from "../../types.ts";

export interface GoalDet {
  /** row id so the UI can map back to client_goals; excluded from prompts */
  id: string;
  goal_type: string;
  name: string;
  target_year: number;
  years_to_target: number;
  target_amount_today: number;
  inflation_used: number;
  future_cost: number;
  current_saved: number;
  monthly_contribution: number;
  projected_savings: number;
  gap: number;
  required_monthly: number;
  on_track: boolean;
}

export interface GoalsDet {
  goals: GoalDet[];
  total_required_monthly: number;
  /** future education cost total — feeds baseline.goal_education_need so the
   * insurance CNA stops using the per-child constant (coupling fix #2) */
  education_future_cost_total: number;
  return_rate_used: number;
  no_goals: boolean;
}

const round = (n: number) => Math.round(n);

/** Future value of a monthly contribution stream at annual rate r. */
export function fvMonthly(pmt: number, annualRate: number, years: number): number {
  if (pmt <= 0 || years <= 0) return 0;
  const i = annualRate / 12;
  const m = Math.round(years * 12);
  if (i === 0) return pmt * m;
  return pmt * ((Math.pow(1 + i, m) - 1) / i);
}

/** Sinking-fund monthly payment reaching `target` in `years` at annual rate r. */
export function pmtMonthly(target: number, annualRate: number, years: number): number {
  if (target <= 0) return 0;
  const i = annualRate / 12;
  const m = Math.max(1, Math.round(years * 12));
  if (i === 0) return target / m;
  return target * i / (Math.pow(1 + i, m) - 1);
}

export function computeGoals(f: CfpData, b: FinancialBaseline): GoalsDet {
  const r = b.assumptions.client_investment_return;
  const goals: GoalDet[] = f.goals.map((g) => {
    const years = Math.max(0, g.target_year - b.current_year);
    const inflation = g.inflation_override ??
      (g.goal_type === "education"
        ? b.assumptions.education_inflation
        : b.assumptions.inflation);
    const futureCost = g.target_amount * Math.pow(1 + inflation, years);
    const projected = g.current_saved * Math.pow(1 + r, years) +
      fvMonthly(g.monthly_contribution, r, years);
    const gap = Math.max(0, futureCost - projected);
    return {
      id: g.id,
      goal_type: g.goal_type,
      name: g.name,
      target_year: g.target_year,
      years_to_target: years,
      target_amount_today: round(g.target_amount),
      inflation_used: inflation,
      future_cost: round(futureCost),
      current_saved: round(g.current_saved),
      monthly_contribution: round(g.monthly_contribution),
      projected_savings: round(projected),
      gap: round(gap),
      required_monthly: round(pmtMonthly(gap, r, years)),
      on_track: gap <= 0,
    };
  });

  return {
    goals,
    total_required_monthly: round(
      goals.reduce((s, g) => s + g.required_monthly, 0),
    ),
    education_future_cost_total: round(
      goals
        .filter((g) => g.goal_type === "education")
        .reduce((s, g) => s + g.future_cost, 0),
    ),
    return_rate_used: r,
    no_goals: goals.length === 0,
  };
}
