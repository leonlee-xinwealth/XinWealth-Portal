// P3 portfolio allocation & drift — model portfolios, suitability → risk-band
// mapping, and the current-vs-target diff. Moved out of
// cfp-brain/modules/investment/calc.ts (P3 决策 4) so the advisor Portfolio
// view can share the exact same target-mix logic the investment_master
// section already uses. calc.ts imports from here now; its own tests are the
// parity check (outputs must stay byte-identical).
//
// Imports are relative-with-`.ts` only, from ../taxonomy/balance.ts — the
// same narrow surface every other _shared/finance file uses.

import { allocationBucketOf, type AllocationBucket as TaxonomyBucket } from "../taxonomy/balance.ts";

export type AllocationBucket = "equity" | "bond" | "cash" | "alternatives";

export const ALLOCATION_BUCKETS: readonly AllocationBucket[] = ["equity", "bond", "cash", "alternatives"];

/**
 * Five risk-band target mixes — a practical stand-in for full mean-variance
 * optimisation. Keys are the bands `riskBandFromSuitability` and
 * `clients.risk_profile` both use ("moderate" has no suitability-profile
 * counterpart; it stays reachable only via a manually-set risk_profile).
 */
export const MODEL_PORTFOLIOS: Record<string, Record<AllocationBucket, number>> = {
  conservative: { equity: 20, bond: 55, cash: 20, alternatives: 5 },
  moderate: { equity: 35, bond: 45, cash: 15, alternatives: 5 },
  balanced: { equity: 50, bond: 35, cash: 10, alternatives: 5 },
  growth: { equity: 65, bond: 25, cash: 5, alternatives: 5 },
  aggressive: { equity: 80, bond: 10, cash: 5, alternatives: 5 },
};

/** Investor Suitability Assessment band → model-portfolio band (spec 决策 4).
 *  `clients.risk_profile` is used as-is elsewhere and already matches the
 *  MODEL_PORTFOLIOS keys directly, so it never goes through this mapping —
 *  this is specifically for translating a `suitability_results` profile. */
export function riskBandFromSuitability(band: string | null | undefined): string | null {
  switch (band) {
    case "STABLE":
      return "conservative";
    case "BALANCED":
      return "balanced";
    case "GROWTH":
      return "growth";
    case "AGGRESSIVE_GROWTH":
      return "aggressive";
    default:
      return null;
  }
}

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

/** Drift beyond this many percentage points triggers a rebalancing action. */
const REBALANCE_THRESHOLD_PP = 5;

const round = (n: number) => Math.round(n);

/**
 * Sums assets (via allocationBucketOf) and holdings market values into
 * equity/bond/alternatives amounts. `cash` is supplied by the caller rather
 * than derived here — it is a baseline concept (liquid assets after the
 * emergency reserve), not an asset-type classification allocationBucketOf
 * can produce — and defaults to 0 for callers that only want the investable
 * buckets.
 */
export function allocationOf(
  assets: ReadonlyArray<{ asset_type: string; current_value?: number | null }> | null | undefined,
  holdings: ReadonlyArray<{ market_value?: number | null }> | null | undefined = [],
  cash = 0,
): Record<AllocationBucket, number> {
  const sumBucket = (bucket: TaxonomyBucket) =>
    (assets ?? [])
      .filter((a) => allocationBucketOf(a.asset_type) === bucket)
      .reduce((s, a) => s + (a.current_value ?? 0), 0);

  const equity = sumBucket("equity") + (holdings ?? []).reduce((s, h) => s + (h.market_value ?? 0), 0);
  const bond = sumBucket("bond");
  const alternatives = sumBucket("alternatives");

  return { equity, bond, cash, alternatives };
}

/** Turns raw bucket amounts into the investable total plus each bucket's
 *  rounded amount/pct row (pct is null across the board when the total is 0,
 *  matching the "no investable assets" UI state rather than dividing by 0). */
export function currentAllocationRows(
  amounts: Record<AllocationBucket, number>,
): { investable_total: number; rows: AllocationRow[] } {
  const investable_total = ALLOCATION_BUCKETS.reduce((s, k) => s + amounts[k], 0);
  const rows: AllocationRow[] = ALLOCATION_BUCKETS.map((bucket) => ({
    bucket,
    amount: round(amounts[bucket]),
    pct: investable_total > 0 ? Number(((amounts[bucket] / investable_total) * 100).toFixed(1)) : null,
  }));
  return { investable_total, rows };
}

/**
 * Diffs a current allocation (as produced by currentAllocationRows) against a
 * model portfolio's target mix: target amounts (split of the same investable
 * total), per-bucket drift in percentage points, and the rebalancing actions
 * for any bucket drifting more than REBALANCE_THRESHOLD_PP.
 */
export function driftAgainst(
  model: Record<AllocationBucket, number>,
  allocation: readonly AllocationRow[],
): { target_allocation: AllocationRow[]; drift: DriftRow[]; rebalancing_actions: RebalancingAction[] } {
  const investable_total = allocation.reduce((s, r) => s + r.amount, 0);

  const target_allocation: AllocationRow[] = ALLOCATION_BUCKETS.map((bucket) => ({
    bucket,
    amount: round((model[bucket] / 100) * investable_total),
    pct: model[bucket],
  }));

  const drift: DriftRow[] = ALLOCATION_BUCKETS.map((bucket) => {
    const currentPct = allocation.find((r) => r.bucket === bucket)?.pct ?? null;
    const target = model[bucket];
    return {
      bucket,
      current_pct: currentPct,
      target_pct: target,
      drift_pp: currentPct != null ? Number((currentPct - target).toFixed(1)) : null,
    };
  });

  const rebalancing_actions: RebalancingAction[] = drift
    .filter((d) => d.drift_pp != null && Math.abs(d.drift_pp) > REBALANCE_THRESHOLD_PP)
    .map((d) => ({
      bucket: d.bucket,
      action: d.drift_pp! > 0 ? "reduce" : "increase",
      amount: round((Math.abs(d.drift_pp!) / 100) * investable_total),
    }));

  return { target_allocation, drift, rebalancing_actions };
}
