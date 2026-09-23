// Bundle entry for api/_lib/taxonomy.mjs (scripts/build-taxonomy.mjs).
// Deno and the browser import the individual modules, not this file.
import { wealthEffectOf, type CashflowDirection } from "./cashflow.ts";

export * from "./cashflow.ts";
export * from "./balance.ts";
export * from "./legacy.ts";
export * from "../finance/loans.ts";
export * from "../finance/derived.ts";
export * from "../cashflow/items.ts";
export * from "../finance/statutory.ts";
export * from "../finance/valuation.ts";
export * from "../finance/assetQuality.ts";
export { computeSnapshot } from "../finance/snapshot.ts";
export type { SnapshotInput, SnapshotResult, SnapshotAsset, SnapshotPolicy } from "../finance/snapshot.ts";
export { reconcile } from "../finance/reconcile.ts";
export type { ReconcileInput, ReconcileResult, ReconcilePlan, ReconcileAsset, SnapshotRef, AssetMarketChange, MarketChangeSource } from "../finance/reconcile.ts";
export { computeAlerts } from "../finance/alerts.ts";
export type { Alert, AlertSeverity, AlertSnapshot, AlertReview, AlertLiability, ComputeAlertsInput } from "../finance/alerts.ts";
// P5 决策 1: the one canonical insurance CNA formula — api/health.js and the
// client portal read this (via api/_lib/taxonomy.mjs) instead of computing
// their own gap math. No name collisions with anything else re-exported here
// (checked against every module above) — see cfp-p5-insurance-design.md §A.
export * from "../insurance/cna.ts";
export * from "../insurance/mapping.ts";
export {
  ALLOCATION_BUCKETS, MODEL_PORTFOLIOS, riskBandFromSuitability, allocationOf, currentAllocationRows, driftAgainst,
} from "../finance/allocation.ts";
export type { AllocationBucket as PortfolioBucket, AllocationRow, DriftRow, RebalancingAction } from "../finance/allocation.ts";

/** True when the stored code is a transfer, in either direction. */
export function isTransferCategory(code: string | null | undefined, direction: CashflowDirection = "outflow"): boolean {
  return wealthEffectOf(code, direction) === "transfer";
}
