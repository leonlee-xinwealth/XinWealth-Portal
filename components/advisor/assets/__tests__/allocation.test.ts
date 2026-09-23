import { describe, expect, it } from 'vitest';
import {
  buildDonutSlices, buildInvestableAmounts, buildLiquiditySlices, donutBucketColor, donutBucketLabel,
  groupValuationsByAsset, liquidityColor, liquidityLabel,
} from '../allocation';

describe('buildDonutSlices', () => {
  it('splits assets into equity/bond/cash/alternatives/retirement', () => {
    const assets = [
      { asset_type: 'savings', current_value: 10_000 },       // A -> cash
      { asset_type: 'epf_account_1', current_value: 50_000 }, // B -> retirement
      { asset_type: 'stock', current_value: 20_000 },         // C -> equity
      { asset_type: 'bond', current_value: 5_000 },           // C -> bond
      { asset_type: 'gold', current_value: 3_000 },           // C -> alternatives
      { asset_type: 'own_residence', current_value: 900_000 }, // D -> excluded entirely
    ];
    const slices = buildDonutSlices(assets);
    const byBucket = Object.fromEntries(slices.map((s) => [s.bucket, s.amount]));
    expect(byBucket.cash).toBe(10_000);
    expect(byBucket.retirement).toBe(50_000);
    expect(byBucket.equity).toBe(20_000);
    expect(byBucket.bond).toBe(5_000);
    expect(byBucket.alternatives).toBe(3_000);
  });

  it('folds holdings market value into equity, on top of asset amounts', () => {
    const assets = [{ asset_type: 'unit_trust', current_value: 10_000 }];
    const holdings = [{ market_value: 2_000 }, { market_value: 1_000 }];
    const slices = buildDonutSlices(assets, holdings);
    const equity = slices.find((s) => s.bucket === 'equity')!;
    expect(equity.amount).toBe(13_000);
  });

  it('returns all zero-amount slices for an empty portfolio', () => {
    const slices = buildDonutSlices([]);
    expect(slices).toHaveLength(5);
    expect(slices.every((s) => s.amount === 0)).toBe(true);
  });

  it('tolerates null/undefined input', () => {
    expect(buildDonutSlices(null).every((s) => s.amount === 0)).toBe(true);
    expect(buildDonutSlices(undefined).every((s) => s.amount === 0)).toBe(true);
  });
});

describe('buildInvestableAmounts', () => {
  it('excludes retirement (class B) from the 4-bucket total used for drift', () => {
    const assets = [
      { asset_type: 'savings', current_value: 10_000 },
      { asset_type: 'epf_account_1', current_value: 50_000 },
      { asset_type: 'stock', current_value: 20_000 },
    ];
    const amounts = buildInvestableAmounts(assets);
    expect(Object.keys(amounts).sort()).toEqual(['alternatives', 'bond', 'cash', 'equity']);
    expect(amounts.cash).toBe(10_000);
    expect(amounts.equity).toBe(20_000);
  });
});

describe('buildLiquiditySlices', () => {
  it('buckets class A/B/C assets by liquidity level and excludes class D', () => {
    const assets = [
      { asset_type: 'savings', current_value: 10_000 },        // A -> high
      { asset_type: 'unit_trust', current_value: 20_000 },     // C -> medium
      { asset_type: 'bond', current_value: 5_000 },             // C -> low
      { asset_type: 'own_residence', current_value: 900_000 },  // D -> excluded
    ];
    const slices = buildLiquiditySlices(assets);
    const byLevel = Object.fromEntries(slices.map((s) => [s.level, s.amount]));
    expect(byLevel.high).toBe(10_000);
    expect(byLevel.medium).toBe(20_000);
    expect(byLevel.low).toBe(5_000);
    // class D never leaks into any bucket
    expect(byLevel.high + byLevel.medium + byLevel.low).toBe(35_000);
  });

  it('always returns exactly the three levels, even when empty', () => {
    const slices = buildLiquiditySlices([]);
    expect(slices.map((s) => s.level)).toEqual(['high', 'medium', 'low']);
  });
});

describe('groupValuationsByAsset', () => {
  it('groups by asset_id and sorts each list oldest-first', () => {
    const rows = [
      { asset_id: 'a1', valuation_date: '2026-03-01', value: 100 },
      { asset_id: 'a2', valuation_date: '2026-01-01', value: 50 },
      { asset_id: 'a1', valuation_date: '2026-01-01', value: 80 },
      { asset_id: 'a1', valuation_date: '2026-02-01', value: 90 },
    ];
    const grouped = groupValuationsByAsset(rows);
    expect([...grouped.keys()].sort()).toEqual(['a1', 'a2']);
    expect(grouped.get('a1')!.map((v) => v.valuation_date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(grouped.get('a2')!.map((v) => v.value)).toEqual([50]);
  });

  it('drops rows with no asset_id and tolerates null input', () => {
    expect(groupValuationsByAsset(null).size).toBe(0);
    const rows = [{ asset_id: '', valuation_date: '2026-01-01', value: 1 } as any];
    expect(groupValuationsByAsset(rows).size).toBe(0);
  });
});

describe('donutBucketLabel / donutBucketColor', () => {
  const buckets = ['equity', 'bond', 'cash', 'alternatives', 'retirement'] as const;

  it('has a distinct zh and en label for every bucket including retirement', () => {
    for (const b of buckets) {
      expect(donutBucketLabel(b, 'zh')).toBeTruthy();
      expect(donutBucketLabel(b, 'en')).toBeTruthy();
      expect(donutBucketLabel(b, 'zh')).not.toBe(donutBucketLabel(b, 'en'));
    }
  });

  it('gives every bucket a distinct color', () => {
    const colors = new Set(buckets.map((b) => donutBucketColor(b)));
    expect(colors.size).toBe(buckets.length);
  });
});

describe('liquidityLabel / liquidityColor', () => {
  const levels = ['high', 'medium', 'low'] as const;

  it('has a distinct zh and en label for every level', () => {
    for (const l of levels) {
      expect(liquidityLabel(l, 'zh')).toBeTruthy();
      expect(liquidityLabel(l, 'en')).toBeTruthy();
      expect(liquidityLabel(l, 'zh')).not.toBe(liquidityLabel(l, 'en'));
    }
  });

  it('gives every level a distinct color', () => {
    const colors = new Set(levels.map((l) => liquidityColor(l)));
    expect(colors.size).toBe(levels.length);
  });
});
