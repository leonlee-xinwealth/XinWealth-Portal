// P8-P10 资产负债 — turns the raw `assets` / `liabilities` rows into the grouped,
// subtotalled table rows the report prints.
//
// The rows arrive with raw enum types (`epf_account_1`, `mortgage`); labels and
// grouping come from labels/enums.ts so the PDF never shows a database value to
// a client.

import type { CfpReportData, CfpReportAsset, CfpReportLiability } from "../types";
import {
  ASSET_TYPES, ASSET_GROUP_LABELS, ASSET_GROUP_ORDER, assetGroupOf,
  assetTypeLabel, liabilityTypeLabel, isHighInterest, type AssetGroup,
} from "../labels/enums";
import type { TableRow } from "../viz/DataTable";
import { money } from "../viz/DataTable";
// P3 决策 3: the 2×2 quadrant labels/order, read-only from the pure taxonomy
// module cfp-brain's baseline.ts itself computes with — same cross-boundary
// import pattern labels/enums.ts already uses for ../../../supabase/functions/
// _shared/taxonomy/*. This file has zero imports of its own besides other
// equally-pure _shared modules, so it is safe in the Vite/browser bundle.
import { QUADRANTS, type Quadrant } from "../../../supabase/functions/_shared/finance/assetQuality";

export interface BalanceTotals {
  assets: number;
  liabilities: number;
  netWorth: number;
  /** per-group asset subtotals, in display order */
  assetGroups: Array<{ group: AssetGroup; zh: string; total: number; share: number }>;
  highInterestTotal: number;
}

export interface AssetQualityRow {
  quadrant: Quadrant;
  labelZh: string;
  labelEn: string;
  count: number;
  value: number;
  netCashFlowMonthly: number;
}

export interface AssetQualityView {
  /** true when at least one asset has been assigned a quadrant */
  hasData: boolean;
  /** compact 2×2 summary, one row per quadrant, always all four in order */
  byQuadrant: AssetQualityRow[];
  /** `assets.id` → this asset's own quadrant/cash-flow/value-change, for the
   *  per-row label on `assetRows`. Only populated for rows `data.assets`
   *  actually carries an `id` for AND `baseline.asset_quality` has a
   *  matching entry — both are optional, so this is empty (not an error)
   *  whenever either is missing, e.g. every report generated before P3, or
   *  before the caller's asset query selects `id`. */
  perAsset: Record<string, { labelZh: string; labelEn: string; netCashFlowMonthly: number; valueChangeAnnual: number | null }>;
}

/**
 * P3 决策 3: per-asset 2×2 quadrant — reads `data.baseline.asset_quality`
 * (`AssessAssetsResult`, computed once by cfp-brain's baseline.ts), never
 * recomputed here. See `CfpReportAsset.id` for why per-row matching is
 * optional-safe rather than guaranteed.
 */
export function selectAssetQuality(data: CfpReportData): AssetQualityView {
  const aq = data.baseline?.asset_quality;
  const byQuadrantRaw = aq?.by_quadrant ?? null;
  const assets: unknown[] = Array.isArray(aq?.assets) ? aq.assets : [];

  const perAsset: AssetQualityView["perAsset"] = {};
  for (const raw of assets) {
    const a = raw as { asset_id?: string; quadrant?: Quadrant | null; net_cash_flow_monthly?: number; value_change_annual?: number | null };
    if (!a || a.quadrant == null || !a.asset_id) continue;
    const meta = QUADRANTS.find((q) => q.id === a.quadrant);
    perAsset[a.asset_id] = {
      labelZh: meta?.label_zh ?? String(a.quadrant),
      labelEn: meta?.label_en ?? String(a.quadrant),
      netCashFlowMonthly: typeof a.net_cash_flow_monthly === "number" ? a.net_cash_flow_monthly : 0,
      valueChangeAnnual: typeof a.value_change_annual === "number" ? a.value_change_annual : null,
    };
  }

  const byQuadrant: AssetQualityRow[] = QUADRANTS.map((q) => {
    const t = (byQuadrantRaw as Record<string, { count?: number; value?: number; net_cash_flow_monthly?: number }> | null)?.[q.id];
    return {
      quadrant: q.id,
      labelZh: q.label_zh,
      labelEn: q.label_en,
      count: typeof t?.count === "number" ? t.count : 0,
      value: typeof t?.value === "number" ? t.value : 0,
      netCashFlowMonthly: typeof t?.net_cash_flow_monthly === "number" ? t.net_cash_flow_monthly : 0,
    };
  });

  return {
    hasData: byQuadrant.some((r) => r.count > 0),
    byQuadrant,
    perAsset,
  };
}

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0);

export function selectBalanceTotals(data: CfpReportData): BalanceTotals {
  const assets = data.assets ?? [];
  const liabilities = data.liabilities ?? [];
  const totalAssets = sum(assets, (a) => a.current_value);
  const totalLiabilities = sum(liabilities, (l) => l.outstanding_balance);

  const assetGroups = ASSET_GROUP_ORDER.map((group) => {
    const total = sum(assets.filter((a) => assetGroupOf(a.asset_type) === group), (a) => a.current_value);
    return {
      group,
      zh: ASSET_GROUP_LABELS[group].zh,
      total,
      share: totalAssets > 0 ? total / totalAssets : 0,
    };
  }).filter((g) => g.total > 0);

  return {
    assets: totalAssets,
    liabilities: totalLiabilities,
    // Derived from the rows actually printed, so the table always foots. Using
    // baseline.net_worth here instead would let the printed rows and the printed
    // total disagree whenever a holding is missing from `assets`.
    netWorth: totalAssets - totalLiabilities,
    assetGroups,
    highInterestTotal: sum(
      liabilities.filter((l) => isHighInterest(l.liability_type)),
      (l) => l.outstanding_balance,
    ),
  };
}

/** Sorts big-to-small so the client reads the material items first. */
function byValueDesc<T>(rows: T[], f: (r: T) => number): T[] {
  return [...rows].sort((a, b) => f(b) - f(a));
}

export function assetRows(data: CfpReportData, lang: "zh" | "en" = "zh"): TableRow[] {
  const assets = data.assets ?? [];
  if (assets.length === 0) return [];
  const out: TableRow[] = [];
  const totals = selectBalanceTotals(data);
  const quality = selectAssetQuality(data);

  for (const g of totals.assetGroups) {
    out.push({ kind: "group", label: `${ASSET_GROUP_LABELS[g.group][lang]}` });
    for (const a of byValueDesc(assets.filter((x) => assetGroupOf(x.asset_type) === g.group), (x) => x.current_value)) {
      const baseMeta = a.owner ?? assetTypeLabel(a.asset_type, lang);
      // P3: append the 2×2 quadrant label when this row's own id matches an
      // assessed asset — additive, never replaces the owner/type meta above.
      const q = a.id ? quality.perAsset[a.id] : undefined;
      out.push({
        kind: "row",
        label: a.name || assetTypeLabel(a.asset_type, lang),
        meta: q ? `${baseMeta} · ${lang === "en" ? q.labelEn : q.labelZh}` : baseMeta,
        value: money(a.current_value),
        indent: true,
      });
    }
    out.push({
      kind: "subtotal",
      label: `${ASSET_GROUP_LABELS[g.group][lang]}小计`,
      meta: `${(g.share * 100).toFixed(0)}%`,
      value: money(g.total),
    });
  }

  out.push({ kind: "total", label: lang === "zh" ? "资产总额" : "Total Assets", value: money(totals.assets) });
  return out;
}

export function liabilityRows(data: CfpReportData, lang: "zh" | "en" = "zh"): TableRow[] {
  const liabilities = data.liabilities ?? [];
  if (liabilities.length === 0) return [];
  const totals = selectBalanceTotals(data);

  const rows: TableRow[] = byValueDesc(liabilities, (l) => l.outstanding_balance).map((l) => ({
    kind: "row" as const,
    label: l.name || liabilityTypeLabel(l.liability_type, lang),
    meta: l.owner ?? liabilityTypeLabel(l.liability_type, lang),
    value: money(l.outstanding_balance),
    // The blueprint asks for 高息负债 to be called out; a dot plus the note
    // under the table, never colour alone.
    flag: isHighInterest(l.liability_type) ? ("bad" as const) : undefined,
  }));

  rows.push({ kind: "total", label: lang === "zh" ? "负债总额" : "Total Liabilities", value: money(totals.liabilities) });
  return rows;
}

/** Net-worth summary rows for the overview page. */
export function netWorthRows(data: CfpReportData, lang: "zh" | "en" = "zh"): TableRow[] {
  const t = selectBalanceTotals(data);
  return [
    { kind: "row", label: lang === "zh" ? "资产总额" : "Total Assets", value: money(t.assets) },
    { kind: "row", label: lang === "zh" ? "负债总额" : "Total Liabilities", value: money(-t.liabilities) },
    { kind: "total", label: lang === "zh" ? "净资产" : "Net Worth", value: money(t.netWorth) },
  ];
}

/**
 * P3 决策 3: the compact 2×2 for the balance-overview page — one row per
 * quadrant, always all four in framework order, so the reader sees the whole
 * grid rather than only whichever buckets happen to be non-zero. Empty
 * (`[]`) when the baseline has no `asset_quality` at all (report generated
 * before P3), so the page can fall back to hiding the block entirely.
 */
export function quadrantSummaryRows(data: CfpReportData, lang: "zh" | "en" = "zh"): TableRow[] {
  const q = selectAssetQuality(data);
  if (!q.hasData) return [];
  return q.byQuadrant.map((r) => ({
    kind: "row" as const,
    label: lang === "en" ? r.labelEn : r.labelZh,
    meta: lang === "en"
      ? `${r.count} · net CF ${money(r.netCashFlowMonthly)}/mo`
      : `${r.count} 项 · 月净现金流 ${money(r.netCashFlowMonthly)}`,
    value: money(r.value),
  }));
}
