// Malaysian resident individual progressive tax bands, YA2026 — deterministic
// data only, no computation here. Re-check and bump the year comment whenever
// LHDN publishes updated bands/reliefs.
//
// Moved to _shared/finance/incomeTax.ts so the cash-flow estimate (derived.ts)
// and this report share one definition; re-exported here so nothing that
// already imports from this file breaks.

export {
  TAX_BANDS,
  RELIEFS,
  progressiveTax,
  marginalRateFor,
  NON_RESIDENT_FLAT_RATE,
} from "../../../_shared/finance/incomeTax.ts";
export type { TaxBand, ReliefBand, ReliefAutoSource } from "../../../_shared/finance/incomeTax.ts";
