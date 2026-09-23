// Presentation metadata for the D6 asset-quality 2×2 (NetworthTab) — colors
// and one-line explanations layered on top of the quadrant ids/labels that
// _shared/finance/assetQuality.ts already defines. Kept separate (and free of
// React) so the color/copy mapping is unit-testable on its own.
// Spec docs/superpowers/specs/2026-09-26-cfp-p3-assets-portfolio-design.md 决策 3.

import { QUADRANTS, type Quadrant } from '../../../supabase/functions/_shared/finance/assetQuality';

export interface QuadrantStyle {
  bg: string;
  text: string;
  dot: string;
}

// productive green, yielding_depreciating amber, appreciating_cash_consuming
// blue, consuming red — spec's own color assignment.
export const QUADRANT_STYLES: Record<Quadrant, QuadrantStyle> = {
  productive: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  yielding_depreciating: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  appreciating_cash_consuming: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  consuming: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

/** Grid order for the 2×2 panel: rows = net cash flow (≥0 top, <0 bottom),
 *  columns = value change (≥0 left, <0 right). */
export const QUADRANT_GRID: readonly Quadrant[] = [
  'productive', 'yielding_depreciating',
  'appreciating_cash_consuming', 'consuming',
];

export function quadrantLabel(quadrant: Quadrant, lang: 'zh' | 'en'): string {
  const meta = QUADRANTS.find((q) => q.id === quadrant);
  if (!meta) return quadrant;
  return lang === 'zh' ? meta.label_zh : meta.label_en;
}

const EXPLANATIONS: Record<Quadrant, { zh: string; en: string }> = {
  productive: {
    zh: '现金流为正，价值持平或上升 — 持续创造回报的理想资产。',
    en: 'Positive cash flow and stable-or-rising value — the ideal holding.',
  },
  yielding_depreciating: {
    zh: '现金流为正但价值下降 — 有收益，但留意贬值速度是否吃掉回报。',
    en: 'Positive cash flow but losing value — earning, but watch whether depreciation outpaces it.',
  },
  appreciating_cash_consuming: {
    zh: '价值在上升，但每月要倒贴现金 — 关注现金流压力是否可持续。',
    en: 'Value is rising but it costs cash every month — watch whether that drag is sustainable.',
  },
  consuming: {
    zh: '现金流为负且价值下降 — 双重消耗财富，建议评估是否继续持有。',
    en: 'Negative cash flow and falling value — draining wealth on both fronts; worth a review.',
  },
};

export function quadrantExplanation(quadrant: Quadrant, lang: 'zh' | 'en'): string {
  return EXPLANATIONS[quadrant][lang];
}
