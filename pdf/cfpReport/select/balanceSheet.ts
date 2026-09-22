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

export interface BalanceTotals {
  assets: number;
  liabilities: number;
  netWorth: number;
  /** per-group asset subtotals, in display order */
  assetGroups: Array<{ group: AssetGroup; zh: string; total: number; share: number }>;
  highInterestTotal: number;
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

  for (const g of totals.assetGroups) {
    out.push({ kind: "group", label: `${ASSET_GROUP_LABELS[g.group][lang]}` });
    for (const a of byValueDesc(assets.filter((x) => assetGroupOf(x.asset_type) === g.group), (x) => x.current_value)) {
      out.push({
        kind: "row",
        label: a.name || assetTypeLabel(a.asset_type, lang),
        meta: a.owner ?? assetTypeLabel(a.asset_type, lang),
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
