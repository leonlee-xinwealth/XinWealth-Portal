// P23 资金耗尽推演 / P24 现状 vs 优化 — the two drawdown curves.
//
// cfp-brain emits `drawdown_baseline` / `drawdown_optimized` on the retirement
// section (see supabase/functions/cfp-brain/modules/retirement/calc.ts). Reports
// generated before that shipped have only the scalar `depletion_age`, so this
// module reconstructs the series from the assumption values the section already
// records. The reconstruction mirrors `simulateDrawdown` exactly — same loop,
// same zero floor, same depletion semantics — and `retirement.test.ts` asserts
// the two paths agree, which is what keeps them from drifting apart.

import type { CfpReportData } from "../types";

export interface DrawdownPoint {
  age: number;
  opening: number;
  withdrawal: number;
  closing: number;
}

export interface RetirementCurves {
  /** current trajectory */
  baseline: DrawdownPoint[];
  /** after the recommended top-up closes the gap */
  optimized: DrawdownPoint[];
  /** age the money runs out on the current trajectory; null = lasts to maxAge */
  depletionAge: number | null;
  /** age the money runs out after optimisation; null = lasts to maxAge */
  optimizedDepletionAge: number | null;
  retirementAge: number | null;
  maxAge: number;
  /** true when the numbers came from cfp-brain rather than being rebuilt here */
  fromServer: boolean;
  /** false when there is not enough data to draw anything — P23 shows its
   *  empty state rather than an invented flat line */
  hasCurve: boolean;
}

const DEFAULT_MAX_AGE = 100;

const round = (n: number) => Math.round(n);

/**
 * Reproduces cfp-brain's `simulateDrawdown`. Kept deliberately literal rather
 * than "improved" — the point is that both sides draw the same curve.
 */
export function simulateDrawdownLocal(
  capitalAtRetirement: number,
  annualNeedAtRetirement: number,
  retirementAge: number,
  postRetirementRate: number,
  inflation: number,
  maxAge = DEFAULT_MAX_AGE,
): { series: DrawdownPoint[]; depletionAge: number | null } {
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
  return { series, depletionAge };
}

function isSeries(v: unknown): v is DrawdownPoint[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0]?.age === "number";
}

/** Depletion is the last year whose closing balance is zero. */
function depletionOf(series: DrawdownPoint[], maxAge: number): number | null {
  if (series.length === 0) return null;
  const last = series[series.length - 1];
  return last.closing <= 0 && last.age < maxAge ? last.age : null;
}

export function selectRetirementCurves(data: CfpReportData): RetirementCurves {
  const content = data.sections?.find((s) => s.section_type === "retirement_planning")?.content ?? null;
  const retirementAge = data.baseline?.retirement_age ?? null;
  const maxAge = content?.drawdown_max_age ?? DEFAULT_MAX_AGE;

  const empty: RetirementCurves = {
    baseline: [], optimized: [],
    depletionAge: content?.depletion_age ?? null,
    optimizedDepletionAge: null,
    retirementAge, maxAge, fromServer: false, hasCurve: false,
  };

  if (!content || content.insufficient_data) return empty;

  // Preferred path — cfp-brain already ran the simulation.
  if (isSeries(content.drawdown_baseline)) {
    const baseline = content.drawdown_baseline as DrawdownPoint[];
    const optimized = isSeries(content.drawdown_optimized)
      ? (content.drawdown_optimized as DrawdownPoint[])
      : baseline;
    return {
      baseline,
      optimized,
      depletionAge: content.depletion_age ?? depletionOf(baseline, maxAge),
      optimizedDepletionAge: depletionOf(optimized, maxAge),
      retirementAge, maxAge, fromServer: true, hasCurve: true,
    };
  }

  // Fallback — rebuild from the assumptions the section recorded. Every input
  // below has been on RetirementDet since the module shipped.
  const capital = content.total_projected;
  const need = content.income_need_at_retirement;
  const rate = content.post_retirement_rate_used;
  const inflation = content.inflation_used;
  const startAge = retirementAge;

  const usable = [capital, need, rate, inflation, startAge].every(
    (n) => typeof n === "number" && Number.isFinite(n),
  );
  // A zero withdrawal never depletes and a zero capital is already depleted;
  // neither makes a chart worth printing.
  if (!usable || capital <= 0 || need <= 0) return empty;

  const base = simulateDrawdownLocal(capital, need, startAge as number, rate, inflation, maxAge);
  const gap = typeof content.gap === "number" ? content.gap : 0;
  const opt = gap > 0 && typeof content.capital_needed === "number" && content.capital_needed > 0
    ? simulateDrawdownLocal(content.capital_needed, need, startAge as number, rate, inflation, maxAge)
    : base;

  return {
    baseline: base.series,
    optimized: opt.series,
    depletionAge: content.depletion_age ?? base.depletionAge,
    optimizedDepletionAge: opt.depletionAge,
    retirementAge, maxAge, fromServer: false, hasCurve: true,
  };
}

/** Y-axis top for the chart: the highest opening balance across both curves. */
export function curvesPeak(c: RetirementCurves): number {
  return Math.max(0, ...c.baseline.map((p) => p.opening), ...c.optimized.map((p) => p.opening));
}

// ---------------------------------------------------------------------------
// P22 退休目标与定义 — the two definitions of retirement, side by side.
//
// Both capital figures come from cfp-brain's retirement module, which computes
// them from the SAME assumptions as the drawdown curve on P23. Nothing here
// recomputes either one: if this page and that chart ever disagreed, the report
// would be arguing with itself two pages apart.
// ---------------------------------------------------------------------------

export interface RetirementTargets {
  /** 被动收入式 — yield alone covers the cost of living, principal untouched */
  capitalPassive: number | null;
  /** 资金耗尽式 — drawn to zero at life expectancy; always the smaller figure */
  capitalDepletion: number | null;
  projected: number | null;
  gap: number | null;
  requiredMonthlyTopup: number | null;
  lifeExpectancy: number | null;
  /** from 首席规划师's wealth-freedom stage — the client's position today */
  passiveIncomeMonthly: number | null;
  monthlyExpenses: number | null;
  /** passive / expenses; null when expenses are unknown */
  coverage: number | null;
  /** extra monthly passive income needed to cover the cost of living outright */
  toFullCoverageMonthly: number | null;
  hasData: boolean;
}

export function selectRetirementTargets(data: CfpReportData): RetirementTargets {
  const r = data.sections?.find((s) => s.section_type === "retirement_planning")?.content ?? null;
  const wf = data.sections?.find((s) => s.section_type === "financial_health")
    ?.content?.wealth_freedom ?? null;

  const passive = num(wf?.passive_income_monthly);
  const expenses = num(wf?.monthly_expenses);
  // Full coverage is 100% of the cost of living, not the wealth-freedom stage's
  // 2x target — this page is about retirement, not financial independence.
  const toFull = passive != null && expenses != null
    ? Math.max(0, Math.round(expenses - passive))
    : null;

  return {
    capitalPassive: r?.insufficient_data ? null : num(r?.capital_needed),
    capitalDepletion: r?.insufficient_data ? null : num(r?.capital_needed_depletion),
    projected: r?.insufficient_data ? null : num(r?.total_projected),
    gap: r?.insufficient_data ? null : num(r?.gap),
    requiredMonthlyTopup: r?.insufficient_data ? null : num(r?.required_monthly_topup),
    lifeExpectancy: num(r?.life_expectancy_used),
    passiveIncomeMonthly: passive,
    monthlyExpenses: expenses,
    coverage: expenses != null && expenses > 0 && passive != null ? passive / expenses : null,
    toFullCoverageMonthly: toFull,
    hasData: r != null && !r.insufficient_data,
  };
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
