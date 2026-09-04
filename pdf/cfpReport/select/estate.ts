// P17-P19 遗嘱与财富传承 — reads legacy_planning.content.
//
// This page group was text-only in the old report despite the module emitting a
// full estate picture. The blueprint's demand here is the same as insurance:
// the CONSEQUENCE of dying intestate has to be shown, not described.

import type { CfpReportData } from "../types";
import type { TableRow } from "../viz/DataTable";
import { money } from "../viz/DataTable";

/**
 * The exposures P18's consequence card may lead with. Mirrors
 * LEGACY_EXPOSURE_KEYS in supabase/functions/cfp-brain/modules/legacy/section.ts.
 */
export const ESTATE_EXPOSURE_KEYS = [
  "no_will",
  "estate_liquidity",
  "nomination_gap",
  "faraid_distribution",
  "creditor_exposure",
] as const;

export type WillStatus = "has_will" | "no_will" | "unknown";
export type EstateRegime = "conventional" | "syariah" | "unknown";

export interface EstateView {
  hasData: boolean;
  grossEstate: number;
  netEstate: number;
  settlementCosts: number;
  obligations: number;
  liquidity: { available: number; status: "covered" | "shortfall"; shortfall: number } | null;
  willStatus: WillStatus;
  regime: EstateRegime;
  faraidFlagged: boolean;
  /** who inherits what if the client dies without a will */
  intestateSplit: Array<{ beneficiary: string; share: string }>;
  nominations: { epf: boolean | null; insurance: boolean | null };
  trustConsideration: boolean;
  assetIsolationFlag: boolean;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function selectEstate(data: CfpReportData): EstateView {
  const c = data.sections?.find((s) => s.section_type === "legacy_planning")?.content ?? null;
  const empty: EstateView = {
    hasData: false, grossEstate: 0, netEstate: 0, settlementCosts: 0, obligations: 0,
    liquidity: null, willStatus: "unknown", regime: "unknown", faraidFlagged: false,
    intestateSplit: [], nominations: { epf: null, insurance: null },
    trustConsideration: false, assetIsolationFlag: false,
  };
  if (!c || c.insufficient_data) return empty;

  const d = c.distribution ?? {};
  const liq = c.estate_liquidity ?? null;

  return {
    hasData: true,
    grossEstate: num(c.gross_estate),
    netEstate: num(c.net_estate),
    settlementCosts: num(c.settlement_costs_est),
    obligations: num(c.estate_obligations),
    liquidity: liq
      ? {
          available: num(liq.available),
          status: liq.status === "shortfall" ? "shortfall" : "covered",
          shortfall: num(liq.shortfall),
        }
      : null,
    willStatus: (d.will_status as WillStatus) ?? "unknown",
    regime: (d.regime as EstateRegime) ?? "unknown",
    faraidFlagged: d.faraid_flagged === true,
    intestateSplit: Array.isArray(d.intestate_conventional_split)
      ? d.intestate_conventional_split.map((x: Record<string, unknown>) => ({
          beneficiary: String(x.beneficiary ?? ""),
          share: String(x.share ?? ""),
        }))
      : [],
    nominations: {
      epf: typeof c.nominations?.epf === "boolean" ? c.nominations.epf : null,
      insurance: typeof c.nominations?.insurance === "boolean" ? c.nominations.insurance : null,
    },
    trustConsideration: c.trust_consideration === true,
    assetIsolationFlag: c.asset_isolation_flag === true,
  };
}

/** P18: what the estate is actually worth once obligations are settled. */
export function estateRows(v: EstateView): TableRow[] {
  if (!v.hasData) return [];
  return [
    { kind: "row", label: "遗产总值", value: money(v.grossEstate) },
    { kind: "row", label: "应清偿债务", value: money(-v.obligations) },
    { kind: "row", label: "遗产处理费用（估）", value: money(-v.settlementCosts) },
    { kind: "total", label: "可分配净遗产", value: money(v.netEstate) },
  ];
}

/**
 * The testate/intestate comparison the blueprint asks for as a flowchart.
 * Rendered as two parallel tracks rather than a node graph — an auto-laid-out
 * flowchart in react-pdf costs far more than it returns, and the story here is
 * a sequence, not a branching topology.
 */
export interface TrackStep {
  label: string;
  detail: string;
}

export const TESTATE_TRACK: TrackStep[] = [
  { label: "遗嘱生效", detail: "由指定执行人依遗嘱办理" },
  { label: "申请遗嘱认证", detail: "Grant of Probate，约 6–12 个月" },
  { label: "按意愿分配", detail: "受益人、比例、时点均由本人决定" },
];

export const INTESTATE_TRACK: TrackStep[] = [
  { label: "资产冻结", detail: "银行户口、投资、房产暂停处置" },
  { label: "申请遗产管理令", detail: "Letters of Administration，需两名担保人" },
  { label: "法定分配", detail: "依《1958 年遗产分配法令》比例，非本人意愿" },
];

/** Nomination checklist — the cheapest fix in the whole report. */
export function nominationRows(v: EstateView): TableRow[] {
  const state = (b: boolean | null) => (b === true ? "已提名" : b === false ? "未提名" : "待确认");
  const flag = (b: boolean | null) => (b === true ? undefined : ("bad" as const));
  return [
    { kind: "row", label: "EPF 受益人提名", value: state(v.nominations.epf), flag: flag(v.nominations.epf) },
    { kind: "row", label: "保单受益人提名", value: state(v.nominations.insurance), flag: flag(v.nominations.insurance) },
  ];
}
