// Pure helpers for the advisor Portfolio tab's allocation donut, liquidity
// bar and per-asset valuation history — kept free of React/Supabase so they
// are unit-testable and PortfolioTab.tsx doesn't re-derive this grouping
// logic by hand.
// Spec docs/superpowers/specs/2026-09-26-cfp-p3-assets-portfolio-design.md 决策 4.

import {
  assetClassOf, liquidityLevel, type LiquidityLevel,
} from '../../../supabase/functions/_shared/taxonomy/balance';
import {
  allocationOf, ALLOCATION_BUCKETS, type AllocationBucket,
} from '../../../supabase/functions/_shared/finance/allocation';
import type { Valuation } from '../../../supabase/functions/_shared/finance/valuation';

export type DonutBucket = AllocationBucket | 'retirement';

export interface DonutSlice {
  bucket: DonutBucket;
  amount: number;
}

export interface AssetLike {
  asset_type: string;
  current_value?: number | null;
}

export interface HoldingLike {
  market_value?: number | null;
}

const classValue = (assets: readonly AssetLike[], cls: 'A' | 'B') =>
  assets.filter((a) => assetClassOf(a.asset_type) === cls)
    .reduce((s, a) => s + (Number(a.current_value) || 0), 0);

/**
 * Allocation donut population — class A (cash), B (retirement) and C
 * (investment) assets, per spec 决策 4: "配置...over investment + retirement +
 * cash assets". The shared `allocationOf` only classifies class C asset types
 * into equity/bond/alternatives; class A is summed here and passed as the
 * `cash` argument it expects, and class B has no taxonomy allocation bucket
 * at all (an EPF-style account isn't equity/bond/cash in the model-portfolio
 * sense) so it is surfaced as its own 'retirement' slice rather than being
 * silently dropped from the picture.
 */
export function buildDonutSlices(
  assets: readonly AssetLike[] | null | undefined,
  holdings: readonly HoldingLike[] | null | undefined = [],
): DonutSlice[] {
  const list = assets ?? [];
  const cash = classValue(list, 'A');
  const retirement = classValue(list, 'B');
  const amounts = allocationOf(list, holdings, cash);
  const slices: DonutSlice[] = ALLOCATION_BUCKETS.map((bucket) => ({ bucket, amount: amounts[bucket] }));
  slices.push({ bucket: 'retirement', amount: retirement });
  return slices;
}

/** Just the 4 taxonomy buckets (no retirement) — this is what feeds
 *  currentAllocationRows/driftAgainst, since MODEL_PORTFOLIOS has no
 *  retirement key. */
export function buildInvestableAmounts(
  assets: readonly AssetLike[] | null | undefined,
  holdings: readonly HoldingLike[] | null | undefined = [],
): Record<AllocationBucket, number> {
  const list = assets ?? [];
  return allocationOf(list, holdings, classValue(list, 'A'));
}

export interface LiquiditySlice {
  level: LiquidityLevel;
  amount: number;
}

const LIQUIDITY_LEVELS: readonly LiquidityLevel[] = ['high', 'medium', 'low'];

/** Liquidity bar population: class A/B/C (the same "portfolio" scope as the
 *  donut). Class D (own residence, vehicle, jewelry…) is always illiquid by
 *  construction and would just pad the "low" bucket without telling an
 *  advisor anything about the *investable* portfolio's liquidity. */
export function buildLiquiditySlices(assets: readonly AssetLike[] | null | undefined): LiquiditySlice[] {
  const list = (assets ?? []).filter((a) => assetClassOf(a.asset_type) !== 'D');
  return LIQUIDITY_LEVELS.map((level) => ({
    level,
    amount: list
      .filter((a) => liquidityLevel(a.asset_type) === level)
      .reduce((s, a) => s + (Number(a.current_value) || 0), 0),
  }));
}

const DONUT_META: Record<DonutBucket, { zh: string; en: string; color: string }> = {
  equity: { zh: '股票', en: 'Equity', color: '#0c2e4a' },
  bond: { zh: '固收', en: 'Bond', color: '#d8c195' },
  cash: { zh: '现金', en: 'Cash', color: '#94a3b8' },
  alternatives: { zh: '另类', en: 'Alternatives', color: '#a855f7' },
  retirement: { zh: '退休专户', en: 'Retirement', color: '#0ea5e9' },
};

export function donutBucketLabel(bucket: DonutBucket, lang: 'zh' | 'en'): string {
  return lang === 'zh' ? DONUT_META[bucket].zh : DONUT_META[bucket].en;
}

export function donutBucketColor(bucket: DonutBucket): string {
  return DONUT_META[bucket].color;
}

const LIQUIDITY_META: Record<LiquidityLevel, { zh: string; en: string; color: string }> = {
  high: { zh: '高流动性', en: 'High liquidity', color: '#10b981' },
  medium: { zh: '中等流动性', en: 'Medium liquidity', color: '#f59e0b' },
  low: { zh: '低流动性', en: 'Low liquidity', color: '#ef4444' },
};

export function liquidityLabel(level: LiquidityLevel, lang: 'zh' | 'en'): string {
  return lang === 'zh' ? LIQUIDITY_META[level].zh : LIQUIDITY_META[level].en;
}

export function liquidityColor(level: LiquidityLevel): string {
  return LIQUIDITY_META[level].color;
}

export interface AssetValuationRow extends Valuation {
  asset_id: string;
}

/** Groups a client's whole asset_valuations result set by asset_id, each
 *  list sorted oldest→newest (the order twr() and the value-history chart
 *  both want). Rows with no asset_id (shouldn't happen, but the table has no
 *  NOT NULL guarantee from this side of the boundary) are dropped. */
export function groupValuationsByAsset(
  valuations: readonly AssetValuationRow[] | null | undefined,
): Map<string, Valuation[]> {
  const map = new Map<string, Valuation[]>();
  for (const v of valuations ?? []) {
    if (!v.asset_id) continue;
    const list = map.get(v.asset_id) ?? [];
    list.push(v);
    map.set(v.asset_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.valuation_date.localeCompare(b.valuation_date));
  }
  return map;
}
