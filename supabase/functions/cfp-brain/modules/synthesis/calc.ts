// 首席规划师 (chief_planner) — deterministic synthesis. Pure, no LLM.
// The "避免顾此失彼" reconciliation: every module states its own need; this
// module ranks them against ONE annual surplus with a fixed priority waterfall
// (保障 → 紧急预备金 → 退休 → 目标 → 财富增值) and never rewrites any other
// section's numbers. Also tracks the 投资大师 wealth-freedom stages (passive
// income vs 2× monthly expenses).

import type { CfpData, FinancialBaseline, ModuleOutputs } from "../../types.ts";
import { CASHFLOW_ANNUALIZE, isAssetTransfer } from "../../baseline.ts";
import type { CashflowDet } from "../cashflow/calc.ts";
import type { GoalsDet } from "../goals/calc.ts";
import type { InsuranceDet } from "../insurance/module.ts";
import type { RetirementDet } from "../retirement/calc.ts";

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

export interface SynthesisDet {
  health_score: number | null;
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

const PASSIVE_KEYWORDS = [
  "dividend",
  "rental",
  "rent",
  "interest",
  "passive",
  "股息",
  "租金",
  "利息",
];

export function passiveIncomeMonthly(f: CfpData): number {
  return round(
    f.cashflow
      .filter((r) =>
        r.direction === "inflow" &&
        !isAssetTransfer(r) &&
        PASSIVE_KEYWORDS.some((k) =>
          (r.category ?? "").toLowerCase().includes(k)
        )
      )
      .reduce(
        (s, r) => s + r.amount * (CASHFLOW_ANNUALIZE[r.frequency] ?? 12) / 12,
        0,
      ),
  );
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

export function computeSynthesis(
  f: CfpData,
  b: FinancialBaseline,
  prior: ModuleOutputs,
): SynthesisDet {
  const cashflow = prior.cashflow_planning as CashflowDet | undefined;
  const insurance = prior.insurance_planning as InsuranceDet | undefined;
  const retirement = prior.retirement_planning as RetirementDet | undefined;
  const goals = prior.goals_planning as GoalsDet | undefined;

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

  const surplus = Math.max(0, b.annual_surplus);
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
  const lifeGap = insurance?.cna.gaps.find((g) => g.key === "life");
  const ciGap = insurance?.cna.gaps.find((g) => g.key === "ci");
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
    budget: {
      annual_surplus: round(surplus),
      required_total: round(requiredTotal),
      over_budget: requiredTotal > surplus,
      lines,
    },
    wealth_freedom: wealthFreedomStage(
      passiveIncomeMonthly(f),
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
