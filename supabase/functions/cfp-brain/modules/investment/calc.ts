// 投资大师 — deterministic asset-allocation & rebalancing calculator. Pure, no LLM.
// Model portfolios are a practical stand-in for full mean-variance optimisation:
// five risk bands, each with a fixed target mix. We diff the client's current
// investable allocation against the band's target and flag rebalancing moves.

import type { CfpData, FinancialBaseline } from "../../types.ts";
import { fvMonthly } from "../goals/calc.ts";
import {
  allocationOf,
  currentAllocationRows,
  driftAgainst,
  MODEL_PORTFOLIOS,
  type AllocationBucket,
  type AllocationRow,
  type DriftRow,
  type RebalancingAction,
} from "../../../_shared/finance/allocation.ts";

export type { AllocationBucket, AllocationRow, DriftRow, RebalancingAction };
export { MODEL_PORTFOLIOS };

export const EXPECTED_VOL_BY_BAND: Record<string, number> = {
  conservative: 0.05,
  moderate: 0.07,
  balanced: 0.10,
  growth: 0.13,
  aggressive: 0.16,
};

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

  const amounts = allocationOf(f.assets, f.holdings, b.liquid_assets_after_emergency);
  const { investable_total: investableTotal, rows: currentAllocation } = currentAllocationRows(amounts);
  const noInvestable = investableTotal <= 0;

  const targetPct = MODEL_PORTFOLIOS[band];
  const { target_allocation: targetAllocation, drift, rebalancing_actions: rebalancingActions } = driftAgainst(
    targetPct,
    currentAllocation,
  );

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
