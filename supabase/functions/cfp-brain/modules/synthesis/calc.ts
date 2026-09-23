// 首席规划师 (chief_planner) — deterministic synthesis. Pure, no LLM.
// The "避免顾此失彼" reconciliation: every module states its own need; this
// module ranks them against ONE annual surplus with a fixed priority waterfall
// (保障 → 紧急预备金 → 退休 → 目标 → 财富增值) and never rewrites any other
// section's numbers. Also tracks the 投资大师 wealth-freedom stages (passive
// income vs 2× monthly expenses).

import type { CfpData, FinancialBaseline, ModuleOutputs } from "../../types.ts";
import {
  annualizeCashflow,
  type CashflowBasis,
} from "../../../_shared/cashflow/periods.ts";
import { groupOf } from "../../../_shared/taxonomy/cashflow.ts";
import type { CashflowDet } from "../cashflow/calc.ts";
import type { GoalsDet } from "../goals/calc.ts";
import type { InsuranceDet } from "../insurance/module.ts";
import type { RetirementDet } from "../retirement/calc.ts";
import type { LegacyDet } from "../legacy/calc.ts";

export type BudgetKey =
  | "protection"
  | "emergency"
  | "retirement"
  | "goals"
  | "wealth";

export interface BudgetLine {
  key: BudgetKey;
  label_zh: string;
  label_en: string;
  required_annual: number;
  allocated_annual: number;
  deferred_annual: number;
}

export interface ScoreComponent {
  key: "emergency" | "savings" | "debt" | "protection" | "retirement";
  label_zh: string;
  /** 0-100, null when the underlying data is unavailable */
  score: number | null;
  weight: number;
}

export interface WealthFreedom {
  passive_income_monthly: number;
  monthly_expenses: number;
  /** passive / expenses; null when expenses are 0 */
  ratio: number | null;
  /** 1: <25% · 2: ≥25% · 3: ≥100% (财务独立) · 4: ≥200% (财务自由) */
  stage: 1 | 2 | 3 | 4 | null;
  /** extra monthly passive income needed to reach the next stage (0 at S4) */
  next_stage_gap_monthly: number | null;
}

/**
 * The cross-module figures the SWOT page argues from.
 *
 * 综合's prompt is the only one that has to reason across the whole plan —
 * "储蓄率健康，但保障缺口 RM 2.21M，退休金 81 岁见底" is a sentence no single
 * module can write. Until now its prompt context carried none of those numbers,
 * so the SWOT could only be written from the budget waterfall.
 *
 * Strictly a SELECTION. Every value below is copied from another module's
 * deterministic output or from the baseline — nothing is recomputed here, so
 * this can never disagree with the page that owns the figure. It also never
 * touches `f`: raw client data has no business in a cross-module summary, and
 * keeping the rule mechanical is what keeps the PII boundary honest.
 */
export interface SynthesisHeadlines {
  savings_ratio: number | null;
  debt_service_ratio: number | null;
  solvency_ratio: number | null;
  liquid_to_net_worth: number | null;
  emergency_months_covered: number | null;
  emergency_shortfall: number;
  life_gap: number | null;
  ci_gap: number | null;
  medical_covered: boolean | null;
  retirement_gap: number;
  depletion_age: number | null;
  retirement_on_track: boolean | null;
  goals_shortfall_monthly: number;
  goals_off_track_count: number;
  has_will: boolean | null;
  estate_liquidity_shortfall: number;
  net_worth: number;
  total_liabilities: number;
}

export interface SynthesisDet {
  health_score: number | null;
  headlines: SynthesisHeadlines;
  score_components: ScoreComponent[];
  budget: {
    annual_surplus: number;
    required_total: number;
    over_budget: boolean;
    lines: BudgetLine[];
  };
  wealth_freedom: WealthFreedom;
  /** section_types whose deterministic output was unavailable (treated as 0) */
  missing_modules: string[];
  ratios_summary: {
    savings_ratio: number | null;
    debt_service_ratio: number | null;
    solvency_ratio: number | null;
    emergency_months_target: number;
  };
}

const round = (n: number) => Math.round(n);
const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Passive income per month: the taxonomy's I2 被动收入 group (rent, dividends,
 * interest, royalties, pensions, policy payouts), on the SAME basis as every
 * other cashflow figure.
 *
 * The subset is filtered by category first, then run through the shared
 * annualiser — so rental income recorded for June and July is averaged across
 * those two months, exactly as salary is. Doing it row-by-row instead treated
 * each month's figure as a separate standing income stream.
 */
export function passiveIncomeMonthly(
  f: CfpData,
  basis: CashflowBasis | null,
): number {
  const passive = f.cashflow.filter((r) =>
    r.direction === "inflow" && groupOf(r.category)?.id === "I2"
  );
  return round(annualizeCashflow(passive, basis).monthly_income);
}

export function wealthFreedomStage(
  passive: number,
  monthlyExpenses: number,
): WealthFreedom {
  if (monthlyExpenses <= 0) {
    return {
      passive_income_monthly: passive,
      monthly_expenses: 0,
      ratio: null,
      stage: null,
      next_stage_gap_monthly: null,
    };
  }
  const ratio = passive / monthlyExpenses;
  const stage = ratio >= 2 ? 4 : ratio >= 1 ? 3 : ratio >= 0.25 ? 2 : 1;
  const nextThreshold = stage === 1 ? 0.25 : stage === 2 ? 1 : stage === 3 ? 2 : null;
  return {
    passive_income_monthly: passive,
    monthly_expenses: round(monthlyExpenses),
    ratio: Number(ratio.toFixed(4)),
    stage: stage as 1 | 2 | 3 | 4,
    next_stage_gap_monthly: nextThreshold === null
      ? 0
      : round(nextThreshold * monthlyExpenses - passive),
  };
}

/** Pure selection — see SynthesisHeadlines. No arithmetic beyond a ratio of two
 *  baseline figures that no module owns. */
function selectHeadlines(
  b: FinancialBaseline,
  cashflow: CashflowDet | undefined,
  insurance: InsuranceDet | undefined,
  retirement: RetirementDet | undefined,
  goals: GoalsDet | undefined,
  legacy: LegacyDet | undefined,
): SynthesisHeadlines {
  // Every read below is fully optional-chained. Synthesis already tolerates a
  // module being absent (missing_modules); tolerating a PARTIAL one costs
  // nothing and keeps a summary field from being able to break the whole
  // reconciliation, which is the one section that must always render.
  const gapOf = (key: string) =>
    insurance?.cna?.gaps?.find((g) => g.key === key) ?? null;
  const life = gapOf("life");
  const ci = gapOf("ci");
  const medical = gapOf("medical");

  return {
    savings_ratio: b.savings_ratio,
    debt_service_ratio: b.debt_service_ratio,
    solvency_ratio: b.solvency_ratio,
    // The one derived value, and only because it spans two baseline fields that
    // no module claims. Negative net worth yields null rather than a ratio that
    // reads backwards.
    liquid_to_net_worth: b.net_worth > 0 ? b.liquid_assets_total / b.net_worth : null,
    emergency_months_covered: cashflow?.emergency_fund?.months_covered ?? null,
    emergency_shortfall: cashflow?.emergency_fund?.shortfall ?? 0,
    life_gap: life?.gap ?? null,
    ci_gap: ci?.gap ?? null,
    medical_covered: medical?.has_cover ?? null,
    retirement_gap: retirement?.gap ?? 0,
    depletion_age: retirement?.depletion_age ?? null,
    retirement_on_track: retirement?.on_track ?? null,
    goals_shortfall_monthly: goals?.total_required_monthly ?? 0,
    goals_off_track_count: goals?.goals?.filter((g) => !g.on_track).length ?? 0,
    has_will: legacy?.distribution ? legacy.distribution.will_status === "has_will" : null,
    estate_liquidity_shortfall: legacy?.estate_liquidity?.shortfall ?? 0,
    net_worth: b.net_worth,
    total_liabilities: b.total_liabilities,
  };
}

export function computeSynthesis(
  f: CfpData,
  b: FinancialBaseline,
  prior: ModuleOutputs,
): SynthesisDet {
  const cashflow = prior.cashflow_planning as CashflowDet | undefined;
  const insurance = prior.insurance_planning as InsuranceDet | undefined;
  const retirement = prior.retirement_planning as RetirementDet | undefined;
  const goals = prior.goals_planning as GoalsDet | undefined;
  const legacy = prior.legacy_planning as LegacyDet | undefined;

  const missing: string[] = [];
  if (!cashflow) missing.push("cashflow_planning");
  if (!insurance) missing.push("insurance_planning");
  if (!retirement) missing.push("retirement_planning");
  if (!goals) missing.push("goals_planning");

  // --- budget reconciliation waterfall (fixed priority) ---
  const requirements: Array<[BudgetKey, string, string, number]> = [
    [
      "protection",
      "保障缺口（估算保费）",
      "Protection top-up (est. premium)",
      insurance?.premium_topup_estimate ?? 0,
    ],
    [
      "emergency",
      "紧急预备金补足（一年内建成）",
      "Emergency fund build-up (within 1 year)",
      Math.max(0, b.emergency_fund_need_high - b.emergency_fund_actual),
    ],
    [
      "retirement",
      "退休储蓄",
      "Retirement top-up",
      (retirement?.required_monthly_topup ?? 0) * 12,
    ],
    [
      "goals",
      "人生目标储蓄",
      "Goal funding",
      (goals?.total_required_monthly ?? 0) * 12,
    ],
  ];

  // P2b 决策 6: forced EPF savings (annual_disposable_surplus already nets it
  // out) can't be redirected to protection/emergency/retirement/goals — the
  // waterfall must allocate what's actually free to move, not the raw
  // surplus. Falls back to annual_surplus itself on the actuals path, where
  // the two are equal anyway (monthly_employee_epf is 0).
  const surplus = Math.max(0, b.annual_disposable_surplus ?? b.annual_surplus);
  let remaining = surplus;
  const lines: BudgetLine[] = requirements.map(
    ([key, label_zh, label_en, required]) => {
      const req = round(Math.max(0, required));
      const allocated = round(Math.min(req, remaining));
      remaining -= allocated;
      return {
        key,
        label_zh,
        label_en,
        required_annual: req,
        allocated_annual: allocated,
        deferred_annual: req - allocated,
      };
    },
  );
  lines.push({
    key: "wealth",
    label_zh: "财富增值（余量投资）",
    label_en: "Wealth building (remaining surplus)",
    required_annual: 0,
    allocated_annual: round(remaining),
    deferred_annual: 0,
  });
  const requiredTotal = lines.reduce((s, l) => s + l.required_annual, 0);

  // --- health score (weights renormalised over available components) ---
  const lifeGap = insurance?.cna?.gaps?.find((g) => g.key === "life");
  const ciGap = insurance?.cna?.gaps?.find((g) => g.key === "ci");
  const coverageScores: number[] = [];
  for (const g of [lifeGap, ciGap]) {
    if (g && (g.need ?? 0) > 0) {
      coverageScores.push(clamp100(((g.covered ?? 0) / g.need!) * 100));
    }
  }

  const components: ScoreComponent[] = [
    {
      key: "emergency",
      label_zh: "紧急预备金",
      weight: 0.20,
      score: b.emergency_fund_need_high > 0
        ? clamp100((b.emergency_fund_actual / b.emergency_fund_need_high) * 100)
        : null,
    },
    {
      key: "savings",
      label_zh: "储蓄率",
      weight: 0.15,
      score: b.savings_ratio != null
        ? clamp100((b.savings_ratio / 0.2) * 100)
        : null,
    },
    {
      key: "debt",
      label_zh: "偿债压力",
      weight: 0.15,
      score: b.debt_service_ratio != null
        ? clamp100(((0.6 - b.debt_service_ratio) / (0.6 - 0.35)) * 100)
        : null,
    },
    {
      key: "protection",
      label_zh: "保障覆盖度",
      weight: 0.25,
      score: coverageScores.length
        ? clamp100(
          coverageScores.reduce((s, x) => s + x, 0) / coverageScores.length,
        )
        : null,
    },
    {
      key: "retirement",
      label_zh: "退休资金覆盖度",
      weight: 0.25,
      score: retirement && retirement.capital_needed > 0 &&
          !retirement.insufficient_data
        ? clamp100(
          (retirement.total_projected / retirement.capital_needed) * 100,
        )
        : null,
    },
  ];

  const available = components.filter((c) => c.score != null);
  const totalWeight = available.reduce((s, c) => s + c.weight, 0);
  const healthScore = totalWeight > 0
    ? clamp100(
      available.reduce((s, c) => s + c.score! * (c.weight / totalWeight), 0),
    )
    : null;

  return {
    health_score: healthScore,
    score_components: components,
    headlines: selectHeadlines(b, cashflow, insurance, retirement, goals, legacy),
    budget: {
      annual_surplus: round(surplus),
      required_total: round(requiredTotal),
      over_budget: requiredTotal > surplus,
      lines,
    },
    wealth_freedom: wealthFreedomStage(
      passiveIncomeMonthly(f, b.cashflow_basis),
      b.annual_expenses / 12,
    ),
    missing_modules: missing,
    ratios_summary: {
      savings_ratio: b.savings_ratio,
      debt_service_ratio: b.debt_service_ratio,
      solvency_ratio: b.solvency_ratio,
      emergency_months_target: b.assumptions.emergency_months_high,
    },
  };
}
