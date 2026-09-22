// The single seam between the CFP report and the standalone suitability report.
//
// The suitability assessment is still issued on its own to prospects, so
// pdf/suitabilityReport owns that logic and its tests. The CFP report reuses the
// same formatters rather than re-implementing them, because they carry a
// compliance contract that pdf/suitabilityReport/__tests__/model.test.ts already
// enforces:
//
//   - every return figure is a labelled RANGE, never a bare point value
//   - the top band prints as "12%+ p.a." (targetReturnPct 15 is its sentinel)
//   - allocations print as ranges
//   - the words guarantee / promise / forecast / 保证 / 承诺 / 预测 never appear
//
// Forking these into pdf/cfpReport would let the two documents drift and quietly
// take the CFP report outside the tested contract. Everything the CFP report
// needs re-exports through here, so the dependency is one import to audit.

export {
  BAND_NAME,
  GAP_TEXT,
  fmtRange,
  fmtTarget,
  fmtAllocation,
  DISCLAIMER as SUITABILITY_DISCLAIMER,
} from "../suitabilityReport/model";

export type { Lang as SuitabilityLang } from "../suitabilityReport/model";
