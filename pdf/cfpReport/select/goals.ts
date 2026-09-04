// P27-P28 专项财务目标 — reads goals_planning.content.
//
// Each goal carries two numbers that matter to the client: what it will actually
// cost in the year they need it (inflated, not today's price), and what they
// have to put aside every month to get there. The gap between what they are
// contributing now and that figure is the whole page.

import type { CfpReportData } from "../types";
import type { TableRow } from "../viz/DataTable";
import { money } from "../viz/DataTable";

export interface GoalRow {
  id: string;
  name: string;
  type: string;
  targetYear: number;
  yearsToTarget: number;
  /** cost in today's money */
  targetToday: number;
  /** cost in the target year, after inflation */
  futureCost: number;
  currentSaved: number;
  monthlyContribution: number;
  projectedSavings: number;
  gap: number;
  requiredMonthly: number;
  onTrack: boolean;
  /** 0..1 — how much of the future cost is already funded on trajectory */
  fundedFraction: number;
}

export interface GoalsView {
  hasData: boolean;
  goals: GoalRow[];
  totalRequiredMonthly: number;
  /** what the client is already putting aside across all goals */
  totalCurrentMonthly: number;
  returnRateUsed: number;
  educationFutureCostTotal: number;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function selectGoals(data: CfpReportData): GoalsView {
  const c = data.sections?.find((s) => s.section_type === "goals_planning")?.content ?? null;
  const empty: GoalsView = {
    hasData: false, goals: [], totalRequiredMonthly: 0, totalCurrentMonthly: 0,
    returnRateUsed: 0, educationFutureCostTotal: 0,
  };
  if (!c || c.no_goals || !Array.isArray(c.goals) || c.goals.length === 0) return empty;

  const goals: GoalRow[] = c.goals.map((g: Record<string, unknown>) => {
    const futureCost = num(g.future_cost);
    const projected = num(g.projected_savings);
    return {
      id: String(g.id ?? ""),
      name: String(g.name ?? "").trim() || "未命名目标",
      type: String(g.goal_type ?? ""),
      targetYear: num(g.target_year),
      yearsToTarget: num(g.years_to_target),
      targetToday: num(g.target_amount_today),
      futureCost,
      currentSaved: num(g.current_saved),
      monthlyContribution: num(g.monthly_contribution),
      projectedSavings: projected,
      gap: num(g.gap),
      requiredMonthly: num(g.required_monthly),
      onTrack: g.on_track === true,
      // Clamped: a goal that is over-funded is 100% funded, not 130%, or the
      // progress bar runs past its own track.
      fundedFraction: futureCost > 0 ? Math.min(1, Math.max(0, projected / futureCost)) : 0,
    };
  });

  // Soonest first — the ordering the client can actually act on.
  goals.sort((a, b) => a.targetYear - b.targetYear);

  return {
    hasData: true,
    goals,
    totalRequiredMonthly: num(c.total_required_monthly),
    totalCurrentMonthly: goals.reduce((s, g) => s + g.monthlyContribution, 0),
    returnRateUsed: num(c.return_rate_used),
    educationFutureCostTotal: num(c.education_future_cost_total),
  };
}

/** P28: what each goal needs per month versus what is going in today. */
export function goalFundingRows(v: GoalsView): TableRow[] {
  if (!v.hasData) return [];
  const rows: TableRow[] = v.goals.map((g) => ({
    kind: "row" as const,
    label: `${g.name}（${g.targetYear}）`,
    meta: `现投 ${money(g.monthlyContribution)}`,
    value: money(g.requiredMonthly),
    flag: g.onTrack ? undefined : ("warn" as const),
  }));
  rows.push({ kind: "total", label: "每月合计所需", value: money(v.totalRequiredMonthly) });
  return rows;
}

/**
 * The monthly shortfall across all goals — the single number the funding page
 * is arguing about. Never negative: being ahead is not a negative shortfall.
 */
export function monthlyShortfall(v: GoalsView): number {
  return Math.max(0, v.totalRequiredMonthly - v.totalCurrentMonthly);
}
