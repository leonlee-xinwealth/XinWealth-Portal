// P20 投资适宜性评估 / P21 投资组合盘点 — module 6.
//
// Suitability lives in its own tables (`suitability_assessments` /
// `suitability_results`) because the assessment is also sent standalone to
// prospects. This report READS that data; it never owns it, never recomputes
// it, and must never surface a prospect-only assessment inside a named client's
// plan — those rows carry `client_id = null` and the query filters them out.
//
// Every figure printed here goes through the formatters in
// pdf/suitabilityReport/model.ts rather than being formatted locally. Those
// carry the compliance contract the standalone report is already tested
// against: returns always as a labelled RANGE, never a bare point value; the
// top band as "12%+ p.a."; allocations as ranges. Re-implementing them here
// would silently fork that contract.

import type { CfpReportData, CfpReportLanguage } from "../types";
import {
  BAND_NAME, GAP_TEXT, fmtRange, fmtTarget, fmtAllocation,
} from "../suitabilityBridge";
import type { TableRow } from "../viz/DataTable";
import { money } from "../viz/DataTable";
import type { Slice } from "../viz/Donut";

// --------------------------------------------------------------------------
// Suitability
// --------------------------------------------------------------------------

export interface SuitabilityView {
  /** false whenever no submitted, client-linked assessment exists */
  hasData: boolean;
  profileZh: string;
  finalBand: number;
  capacityBand: number;
  toleranceBand: number;
  horizonCeilingBand: number;
  /** the dimension(s) that actually capped the band */
  bindingZh: string;
  targetReturn: string;
  expectedRange: string;
  gapKey: string;
  gapTextZh: string;
  allocation: { defensive: string; growth: string; diversifier: string };
  redFlags: string[];
  requiresReview: boolean;
  submittedAt: string | null;
}

const EMPTY_SUITABILITY: SuitabilityView = {
  hasData: false, profileZh: "—", finalBand: 0,
  capacityBand: 0, toleranceBand: 0, horizonCeilingBand: 0,
  bindingZh: "—", targetReturn: "—", expectedRange: "—",
  gapKey: "", gapTextZh: "", allocation: { defensive: "—", growth: "—", diversifier: "—" },
  redFlags: [], requiresReview: false, submittedAt: null,
};

export function selectSuitability(data: CfpReportData): SuitabilityView {
  const s = data.suitability ?? null;
  if (!s) return EMPTY_SUITABILITY;

  const lang: CfpReportLanguage = "zh";
  const cfg = s.configSnapshot ?? {};
  const bandRanges = cfg.bandReturnRanges?.[String(s.finalBand)];

  // Which dimension bound the final band is the advisor's talking point — and
  // it is derived, never stored, so it cannot drift from the bands themselves.
  const binding: string[] = [];
  if (s.capacityBand === s.finalBand) binding.push("承受能力");
  if (s.toleranceBand === s.finalBand) binding.push("风险偏好");
  if (s.horizonCeilingBand === s.finalBand) binding.push("投资年期");

  return {
    hasData: true,
    profileZh: BAND_NAME[s.finalBand]?.[lang] ?? s.finalProfile ?? "—",
    finalBand: s.finalBand,
    capacityBand: s.capacityBand,
    toleranceBand: s.toleranceBand,
    horizonCeilingBand: s.horizonCeilingBand,
    bindingZh: binding.length ? binding.join(" + ") : "—",
    targetReturn: fmtTarget(s.targetReturnPct ?? null, lang),
    expectedRange: fmtRange(bandRanges, lang),
    gapKey: s.expectationGap ?? "",
    gapTextZh: GAP_TEXT[s.expectationGap ?? ""]?.[lang] ?? "",
    allocation: {
      defensive: fmtAllocation(cfg.allocationRanges?.[String(s.finalBand)], "defensive"),
      growth: fmtAllocation(cfg.allocationRanges?.[String(s.finalBand)], "growth"),
      diversifier: fmtAllocation(cfg.allocationRanges?.[String(s.finalBand)], "diversifier"),
    },
    redFlags: Array.isArray(s.redFlags) ? s.redFlags.map((f) => String(f?.label ?? f)) : [],
    requiresReview: s.requiresAdvisorReview === true,
    submittedAt: s.submittedAt ?? null,
  };
}

/** The four dimensions, for the risk-spectrum strip. */
export function suitabilityDimensions(v: SuitabilityView) {
  return [
    { label: "风险承受能力", band: v.capacityBand },
    { label: "风险偏好", band: v.toleranceBand },
    { label: "投资年期上限", band: v.horizonCeilingBand },
    { label: "最终画像", band: v.finalBand, isFinal: true },
  ];
}

// --------------------------------------------------------------------------
// Portfolio
// --------------------------------------------------------------------------

const BUCKET_ZH: Record<string, string> = {
  equity: "股票",
  bond: "债券",
  cash: "现金",
  alternatives: "另类资产",
};

export interface PortfolioView {
  hasData: boolean;
  investableTotal: number;
  current: Slice[];
  target: Slice[];
  drift: Array<{ bucket: string; zh: string; currentPct: number | null; targetPct: number; driftPp: number | null }>;
  actions: Array<{ label: string; amount: number }>;
  expectedReturn: number | null;
  expectedVol: number | null;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function selectPortfolio(data: CfpReportData): PortfolioView {
  const c = data.sections?.find((s) => s.section_type === "investment_planning")?.content ?? null;
  const empty: PortfolioView = {
    hasData: false, investableTotal: 0, current: [], target: [], drift: [],
    actions: [], expectedReturn: null, expectedVol: null,
  };
  if (!c || c.no_investable) return empty;

  const alloc = (rows: unknown): Slice[] =>
    Array.isArray(rows)
      ? rows
          .map((r: Record<string, unknown>) => ({
            label: BUCKET_ZH[String(r.bucket)] ?? String(r.bucket),
            value: num(r.amount),
          }))
          .filter((x) => x.value > 0)
      : [];

  return {
    hasData: num(c.investable_total) > 0,
    investableTotal: num(c.investable_total),
    current: alloc(c.current_allocation),
    target: alloc(c.target_allocation),
    drift: Array.isArray(c.drift)
      ? c.drift.map((d: Record<string, unknown>) => ({
          bucket: String(d.bucket),
          zh: BUCKET_ZH[String(d.bucket)] ?? String(d.bucket),
          currentPct: typeof d.current_pct === "number" ? d.current_pct : null,
          targetPct: num(d.target_pct),
          driftPp: typeof d.drift_pp === "number" ? d.drift_pp : null,
        }))
      : [],
    actions: Array.isArray(c.rebalancing_actions)
      ? c.rebalancing_actions.map((a: Record<string, unknown>) => ({
          label: String(a.label ?? a.action ?? ""),
          amount: num(a.amount),
        }))
      : [],
    expectedReturn: typeof c.expected_return === "number" ? c.expected_return : null,
    expectedVol: typeof c.expected_vol === "number" ? c.expected_vol : null,
  };
}

/** Drift table: where the portfolio sits versus where the profile says it should. */
export function driftRows(v: PortfolioView): TableRow[] {
  if (v.drift.length === 0) return [];
  const rows: TableRow[] = v.drift.map((d) => ({
    kind: "row" as const,
    label: d.zh,
    meta: `${d.currentPct != null ? d.currentPct.toFixed(0) : "—"}% → ${d.targetPct.toFixed(0)}%`,
    value: d.driftPp == null ? "—" : `${d.driftPp > 0 ? "+" : ""}${d.driftPp.toFixed(1)} pp`,
    // Anything more than five points off target is worth acting on.
    flag: d.driftPp != null && Math.abs(d.driftPp) >= 5 ? ("warn" as const) : undefined,
  }));
  rows.push({ kind: "total", label: "可投资资产总额", value: money(v.investableTotal) });
  return rows;
}
