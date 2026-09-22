// P25-P26 税务规划 — reads tax_planning.content.
//
// The blueprint wants this module to land one number: what the client is
// currently leaving on the table. Everything else on these pages is the working
// that justifies it.

import type { CfpReportData } from "../types";
import type { TableRow } from "../viz/DataTable";
import { money } from "../viz/DataTable";

export interface ReliefRow {
  key: string;
  label: string;
  claimed: number;
  cap: number;
  headroom: number;
  /** advisor-entered and detected figures are trustworthy; "auto" is an
   *  assumption the client should be told about */
  source: "advisor" | "auto" | "detected" | "none";
}

export interface TaxOpportunity {
  key: string;
  label: string;
  additionalClaimable: number;
  estTaxSaving: number;
}

export interface TaxView {
  hasData: boolean;
  employmentIncome: number;
  chargeableIncome: number;
  taxPayable: number;
  marginalRate: number;
  effectiveRate: number | null;
  nonResident: boolean;
  reliefs: ReliefRow[];
  opportunities: TaxOpportunity[];
  /** total tax saved if every opportunity is taken */
  totalSaving: number;
  /** tax payable once the opportunities are claimed */
  optimizedTaxPayable: number;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function selectTax(data: CfpReportData): TaxView {
  const c = data.sections?.find((s) => s.section_type === "tax_planning")?.content ?? null;
  const empty: TaxView = {
    hasData: false, employmentIncome: 0, chargeableIncome: 0, taxPayable: 0,
    marginalRate: 0, effectiveRate: null, nonResident: false,
    reliefs: [], opportunities: [], totalSaving: 0, optimizedTaxPayable: 0,
  };
  if (!c || c.insufficient_data) return empty;

  const reliefs: ReliefRow[] = Array.isArray(c.reliefs_detail)
    ? c.reliefs_detail.map((r: Record<string, unknown>) => ({
        key: String(r.key ?? ""),
        label: String(r.label ?? r.key ?? ""),
        claimed: num(r.claimed),
        cap: num(r.cap),
        headroom: num(r.headroom),
        source: (r.source as ReliefRow["source"]) ?? "none",
      }))
    : [];

  // `content` is deliberately `any` (each module has its own shape), so the
  // mapped array has to be annotated before chaining or the callbacks below
  // pick up implicit any.
  const mapped: TaxOpportunity[] = Array.isArray(c.optimization_opportunities)
    ? c.optimization_opportunities.map((o: Record<string, unknown>) => ({
        key: String(o.key ?? ""),
        label: String(o.label ?? o.key ?? ""),
        additionalClaimable: num(o.additional_claimable),
        estTaxSaving: num(o.est_tax_saving),
      }))
    : [];
  const opportunities = mapped
    .filter((o) => o.estTaxSaving > 0)
    .sort((a, b) => b.estTaxSaving - a.estTaxSaving);

  const totalSaving = opportunities.reduce((s, o) => s + o.estTaxSaving, 0);
  const taxPayable = num(c.tax_payable);

  return {
    hasData: true,
    employmentIncome: num(c.employment_income_est),
    chargeableIncome: num(c.chargeable_income),
    taxPayable,
    marginalRate: num(c.marginal_rate),
    effectiveRate: typeof c.effective_rate === "number" ? c.effective_rate : null,
    nonResident: c.non_resident === true,
    reliefs,
    opportunities,
    totalSaving,
    // Cannot save more tax than is owed.
    optimizedTaxPayable: Math.max(0, taxPayable - totalSaving),
  };
}

/** P25: every relief, with what is still claimable. */
export function reliefRows(v: TaxView): TableRow[] {
  if (v.reliefs.length === 0) return [];
  const rows: TableRow[] = v.reliefs
    .slice()
    .sort((a, b) => b.headroom - a.headroom)
    .map((r) => ({
      kind: "row" as const,
      label: r.label,
      meta: `${money(r.claimed)} / ${money(r.cap)}`,
      value: r.headroom > 0 ? money(r.headroom) : "—",
      // Unused headroom is the whole point of the page.
      flag: r.headroom > 0 ? ("warn" as const) : undefined,
    }));
  rows.push({
    kind: "total",
    label: "尚可扣除总额",
    value: money(v.reliefs.reduce((s, r) => s + r.headroom, 0)),
  });
  return rows;
}

/** P26: before and after, with the saving as the closing line. */
export function optimizationRows(v: TaxView): TableRow[] {
  if (!v.hasData) return [];
  const rows: TableRow[] = [
    { kind: "group", label: "优化前" },
    { kind: "row", label: "应课税收入", indent: true, value: money(v.chargeableIncome) },
    { kind: "row", label: "应缴税额", indent: true, value: money(v.taxPayable) },
    { kind: "group", label: "可采取的行动" },
    ...v.opportunities.map((o) => ({
      kind: "row" as const,
      label: o.label,
      indent: true,
      meta: `多扣 ${money(o.additionalClaimable)}`,
      value: money(o.estTaxSaving),
    })),
    { kind: "subtotal", label: "预估节税合计", value: money(v.totalSaving) },
    { kind: "total", label: "优化后应缴税额", value: money(v.optimizedTaxPayable) },
  ];
  return rows;
}
