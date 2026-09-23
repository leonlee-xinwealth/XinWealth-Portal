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
export {
  ALLOCATION_BUCKETS, MODEL_PORTFOLIOS, riskBandFromSuitability, allocationOf, currentAllocationRows, driftAgainst,
} from "../finance/allocation.ts";
export type { AllocationBucket as PortfolioBucket, AllocationRow, DriftRow, RebalancingAction } from "../finance/allocation.ts";

/** True when the stored code is a transfer, in either direction. */
export function isTransferCategory(code: string | null | undefined, direction: CashflowDirection = "outflow"): boolean {
  return wealthEffectOf(code, direction) === "transfer";
}
