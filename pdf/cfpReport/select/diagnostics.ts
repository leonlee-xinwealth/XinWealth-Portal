// P11-12 七大财务比率 — derives the blueprint's seven diagnostic ratios from the
// report payload.
//
// Consistency rule: the thresholds below are copied from `getStatus()` in
// components/FinancialHealthCheck.tsx, and the formulas from that page's data
// source (services/apiService.ts) and supabase/functions/cfp-brain/baseline.ts.
// The client can see the portal's Financial Health page and this PDF side by
// side; if the two ever disagree on a verdict they will notice immediately.
// diagnostics.test.ts pins the boundaries so a change on either side is loud.

import type { CfpReportData, CfpReportLanguage } from "../types";
import { assetGroupOf } from "../labels/enums";

export type RatioBand = "good" | "warn" | "bad" | "none";

/** How a ratio's number should be read out. */
export type RatioFormat = "percent" | "months";

export type RatioId =
  | "basicLiquidity"
  | "liquidAssetToNetWorth"
  | "solvency"
  | "debtToAsset"
  | "savings"
  | "investmentAssets"
  | "debtService";

export interface RatioRow {
  id: RatioId;
  zh: string;
  en: string;
  /** null when the denominator is missing — renders as 无数据, never as 0 */
  value: number | null;
  format: RatioFormat;
  band: RatioBand;
  /** verdict word shown beside the colour, so status is never colour-alone */
  verdictZh: string;
  verdictEn: string;
  /** the 达标线 printed beside the dial, in the same unit as `value` */
  benchmark: string;
  /** full-scale end of the gauge, for arc geometry */
  scaleMax: number;
  /** plain-language definition, printed small under the dial so the client can
   *  see what was actually measured rather than trusting a coloured needle */
  basisZh: string;
  /**
   * Replaces the numeric readout when the ratio has left the range where a
   * percentage still says anything. A client whose liabilities are twelve times
   * their assets gets "资不抵债", not "-1116.3%" — the number is arithmetically
   * right and communicatively useless, and reads as a rendering fault.
   */
  readoutZh?: string;
  readoutEn?: string;
}

const NONE = { band: "none" as RatioBand, verdictZh: "无数据", verdictEn: "No data" };

/** Guards every ratio: a zero or missing denominator is "no data", not zero. */
function ratio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  const v = numerator / denominator;
  return Number.isFinite(v) ? v : null;
}

interface BandRule {
  when: (v: number) => boolean;
  band: RatioBand;
  zh: string;
  en: string;
}

function verdict(
  value: number | null,
  rules: BandRule[],
): Pick<RatioRow, "band" | "verdictZh" | "verdictEn"> {
  if (value == null) return NONE;
  for (const r of rules) {
    if (r.when(value)) return { band: r.band, verdictZh: r.zh, verdictEn: r.en };
  }
  return NONE;
}

/**
 * 投资资产 = wealth-building assets: unit trusts, shares, bonds, ETFs plus EPF
 * and PRS. Deliberately excludes cash (that is the liquidity ratio's job) and
 * the home and car (they do not compound). This is the conventional Malaysian
 * reading, and P11 prints the basis under the dial so the client can see it.
 *
 * Note this is NOT investment_planning.content.investable_total — that figure
 * includes the cash bucket because it drives asset allocation, so reusing it
 * here would double-count cash against the liquidity ratio.
 */
export function investmentAssetsOf(data: CfpReportData): number {
  return (data.assets ?? []).reduce((sum, a) => {
    const g = assetGroupOf(a.asset_type);
    return g === "investment" || g === "retirement" ? sum + (a.current_value ?? 0) : sum;
  }, 0);
}

export function selectRatios(data: CfpReportData): RatioRow[] {
  const b = data.baseline ?? null;
  const liquid = b?.liquid_assets_total ?? null;
  // baseline sets monthly_essential_expenses = annual_expenses / 12, i.e. total
  // monthly outgoings — the same denominator the portal's page uses.
  const monthlyExpenses = b?.monthly_essential_expenses ?? null;
  const netWorth = b?.net_worth ?? null;
  const investmentAssets = b ? investmentAssetsOf(data) : null;

  const basicLiquidity = ratio(liquid, monthlyExpenses);
  const liquidToNet = ratio(liquid, netWorth);
  const solvency = b?.solvency_ratio ?? null;
  // Mirror of solvency by construction, so the two can never contradict each
  // other on facing rows of the same table.
  const debtToAsset = solvency == null ? null : 1 - solvency;
  // Negative net worth is a state, not a percentage. Both ratios cross out of
  // their meaningful range at the same moment, so they are named together.
  const insolvent = solvency != null && solvency < 0;
  const savings = b?.savings_ratio ?? null;
  const investRatio = ratio(investmentAssets, netWorth);
  const debtService = b?.debt_service_ratio ?? null;

  return [
    {
      id: "basicLiquidity",
      zh: "基本流动性比率",
      en: "Basic Liquidity Ratio",
      value: basicLiquidity,
      format: "months",
      scaleMax: 12,
      benchmark: "≥ 6",
      basisZh: "流动资产 ÷ 每月支出",
      ...verdict(basicLiquidity, [
        { when: (v) => v >= 6, band: "good", zh: "健康", en: "Healthy" },
        { when: (v) => v >= 3, band: "warn", zh: "正常", en: "Adequate" },
        { when: () => true, band: "bad", zh: "危险", en: "At risk" },
      ]),
    },
    {
      id: "liquidAssetToNetWorth",
      zh: "流动资产对净资产比率",
      en: "Liquid Assets to Net Worth",
      value: liquidToNet,
      format: "percent",
      scaleMax: 0.4,
      benchmark: "15% – 20%",
      basisZh: "流动资产 ÷ 净资产",
      ...verdict(liquidToNet, [
        { when: (v) => v >= 0.15 && v <= 0.2, band: "good", zh: "理想", en: "Ideal" },
        { when: (v) => v > 0.2, band: "warn", zh: "资金闲置", en: "Idle cash" },
        { when: () => true, band: "bad", zh: "风险大", en: "Thin buffer" },
      ]),
    },
    {
      id: "solvency",
      zh: "偿付能力比率",
      en: "Solvency Ratio",
      value: solvency,
      format: "percent",
      scaleMax: 1,
      benchmark: "> 50%",
      basisZh: "净资产 ÷ 总资产",
      ...(insolvent ? { readoutZh: "资不抵债", readoutEn: "Insolvent" } : {}),
      ...verdict(solvency, [
        { when: (v) => v > 0.5, band: "good", zh: "良好", en: "Sound" },
        { when: () => true, band: "bad", zh: "危险", en: "At risk" },
      ]),
    },
    {
      id: "debtToAsset",
      zh: "负债对资产比率",
      en: "Debt to Asset Ratio",
      value: debtToAsset,
      format: "percent",
      scaleMax: 1,
      benchmark: "< 50%",
      basisZh: "总负债 ÷ 总资产",
      ...(insolvent ? { readoutZh: "负债超出资产", readoutEn: "Debt exceeds assets" } : {}),
      ...verdict(debtToAsset, [
        { when: (v) => v < 0.5, band: "good", zh: "良好", en: "Sound" },
        { when: () => true, band: "bad", zh: "偏高", en: "Elevated" },
      ]),
    },
    {
      id: "savings",
      zh: "储蓄率",
      en: "Savings Ratio",
      value: savings,
      format: "percent",
      scaleMax: 0.5,
      benchmark: "> 20%",
      basisZh: "年结余 ÷ 年收入",
      ...verdict(savings, [
        { when: (v) => v > 0.2, band: "good", zh: "优秀", en: "Strong" },
        { when: () => true, band: "warn", zh: "需提升", en: "Below target" },
      ]),
    },
    {
      id: "investmentAssets",
      zh: "投资资产比率",
      en: "Investment Assets Ratio",
      value: investRatio,
      format: "percent",
      scaleMax: 1,
      benchmark: "> 50%",
      basisZh: "投资及退休资产 ÷ 净资产",
      ...verdict(investRatio, [
        { when: (v) => v > 0.5, band: "good", zh: "良好", en: "Sound" },
        { when: () => true, band: "warn", zh: "偏低", en: "Below target" },
      ]),
    },
    {
      id: "debtService",
      zh: "债务还本付息比率",
      en: "Debt Service Ratio",
      value: debtService,
      format: "percent",
      scaleMax: 0.7,
      benchmark: "< 35%",
      basisZh: "每月还债 ÷ 每月收入",
      ...verdict(debtService, [
        { when: (v) => v < 0.35, band: "good", zh: "优秀", en: "Strong" },
        { when: (v) => v <= 0.5, band: "warn", zh: "可接受", en: "Acceptable" },
        { when: () => true, band: "bad", zh: "危险", en: "At risk" },
      ]),
    },
  ];
}

/** Formats a ratio for display. Null renders as a dash, never as "0%". */
export function formatRatio(row: RatioRow, lang: CfpReportLanguage): string {
  const override = lang === "zh" ? row.readoutZh : row.readoutEn;
  if (override) return override;
  if (row.value == null) return "—";
  if (row.format === "months") {
    const n = row.value.toFixed(1).replace(/\.0$/, "");
    return lang === "zh" ? `${n} 个月` : `${n} mo`;
  }
  return `${(row.value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}
