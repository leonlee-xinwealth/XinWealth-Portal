// 投资大师 — deterministic asset-allocation & rebalancing calculator. Pure, no LLM.
// Model portfolios are a practical stand-in for full mean-variance optimisation:
// five risk bands, each with a fixed target mix. We diff the client's current
// investable allocation against the band's target and flag rebalancing moves.

import type { CfpData, FinancialBaseline } from "../../types.ts";
import { fvMonthly } from "../goals/calc.ts";

export type AllocationBucket = "equity" | "bond" | "cash" | "alternatives";

export const MODEL_PORTFOLIOS: Record<string, Record<AllocationBucket, number>> = {
  conservative: { equity: 20, bond: 55, cash: 20, alternatives: 5 },
  moderate: { equity: 35, bond: 45, cash: 15, alternatives: 5 },
  balanced: { equity: 50, bond: 35, cash: 10, alternatives: 5 },
  growth: { equity: 65, bond: 25, cash: 5, alternatives: 5 },
  aggressive: { equity: 80, bond: 10, cash: 5, alternatives: 5 },
};

export const EXPECTED_VOL_BY_BAND: Record<string, number> = {
  conservative: 0.05,
  moderate: 0.07,
  balanced: 0.10,
  growth: 0.13,
  aggressive: 0.16,
};

const BUCKETS: AllocationBucket[] = ["equity", "bond", "cash", "alternatives"];

export interface AllocationRow {
  bucket: AllocationBucket;
  amount: number;
  pct: number | null;
}

export interface DriftRow {
  bucket: AllocationBucket;
  current_pct: number | null;
  target_pct: number;
  drift_pp: number | null;
}

export interface RebalancingAction {
  bucket: AllocationBucket;
  action: "increase" | "reduce";
  amount: number;
}

export interface WealthProjectionRow {
  year: number;
  projected: number;
}

const WEALTH_PROJECTION_YEARS = [5, 10, 15];

export interface InvestmentDet {
  risk_band: string;
  risk_band_defaulted: boolean;
  investable_total: number;
  current_allocation: AllocationRow[];
  target_allocation: AllocationRow[];
  drift: DriftRow[];
  rebalancing_actions: RebalancingAction[];
  expected_return: number;
  expected_vol: number;
  monthly_surplus: number;
  no_investable: boolean;
  wealth_projection: WealthProjectionRow[];
}

const round = (n: number) => Math.round(n);

export function computeInvestment(
  f: CfpData,
  b: FinancialBaseline,
): InvestmentDet {
  const riskProfile = f.client.risk_profile;
  const riskBandDefaulted = !riskProfile || !MODEL_PORTFOLIOS[riskProfile];
  const band = !riskBandDefaulted ? riskProfile! : "balanced";

  const equity = f.assets
    .filter((a) => a.asset_type === "stock" || a.asset_type === "etf" || a.asset_type === "unit_trust")
    .reduce((s, a) => s + (a.current_value ?? 0), 0) +
    f.holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
  const bond = f.assets
    .filter((a) => a.asset_type === "bond")
    .reduce((s, a) => s + (a.current_value ?? 0), 0);
  const cash = b.liquid_assets_after_emergency;
  const alternatives = f.assets
    .filter((a) => a.asset_type === "business")
    .reduce((s, a) => s + (a.current_value ?? 0), 0);

  const amounts: Record<AllocationBucket, number> = { equity, bond, cash, alternatives };
  const investableTotal = BUCKETS.reduce((s, k) => s + amounts[k], 0);
  const noInvestable = investableTotal <= 0;

  const currentAllocation: AllocationRow[] = BUCKETS.map((bucket) => ({
    bucket,
    amount: round(amounts[bucket]),
    pct: investableTotal > 0
      ? Number(((amounts[bucket] / investableTotal) * 100).toFixed(1))
      : null,
  }));

  const targetPct = MODEL_PORTFOLIOS[band];
  const targetAllocation: AllocationRow[] = BUCKETS.map((bucket) => ({
    bucket,
    amount: round((targetPct[bucket] / 100) * investableTotal),
    pct: targetPct[bucket],
  }));

  const drift: DriftRow[] = BUCKETS.map((bucket) => {
    const currentPct = currentAllocation.find((r) => r.bucket === bucket)!.pct;
    const target = targetPct[bucket];
    return {
      bucket,
      current_pct: currentPct,
      target_pct: target,
      drift_pp: currentPct != null ? Number((currentPct - target).toFixed(1)) : null,
    };
  });

  const rebalancingActions: RebalancingAction[] = drift
    .filter((d) => d.drift_pp != null && Math.abs(d.drift_pp) > 5)
    .map((d) => ({
      bucket: d.bucket,
      action: d.drift_pp! > 0 ? "reduce" : "increase",
      amount: round((Math.abs(d.drift_pp!) / 100) * investableTotal),
    }));

  const r = b.assumptions.client_investment_return;
  const monthlySurplus = Math.max(0, b.annual_surplus / 12);
  const wealthProjection: WealthProjectionRow[] = WEALTH_PROJECTION_YEARS.map((y) => ({
    year: y,
    projected: round(
      investableTotal * Math.pow(1 + r, y) + fvMonthly(monthlySurplus, r, y),
    ),
  }));

  return {
    risk_band: band,
    risk_band_defaulted: riskBandDefaulted,
    investable_total: round(investableTotal),
    current_allocation: currentAllocation,
    target_allocation: targetAllocation,
    drift,
    rebalancing_actions: rebalancingActions,
    expected_return: b.assumptions.investment_return_by_band[band],
    expected_vol: EXPECTED_VOL_BY_BAND[band],
    monthly_surplus: round(b.annual_surplus / 12),
    no_investable: noInvestable,
    wealth_projection: wealthProjection,
  };
}
