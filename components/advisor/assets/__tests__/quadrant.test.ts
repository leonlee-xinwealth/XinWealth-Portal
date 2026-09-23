import { describe, expect, it } from 'vitest';
import type { Quadrant } from '../../../../supabase/functions/_shared/finance/assetQuality';
import { QUADRANT_GRID, QUADRANT_STYLES, quadrantExplanation, quadrantLabel } from '../quadrant';

const ALL_QUADRANTS: Quadrant[] = [
  'productive', 'yielding_depreciating', 'appreciating_cash_consuming', 'consuming',
];

describe('QUADRANT_STYLES', () => {
  it('has a style for every quadrant, matching the spec colors', () => {
    expect(QUADRANT_STYLES.productive.text).toContain('emerald');
    expect(QUADRANT_STYLES.yielding_depreciating.text).toContain('amber');
    expect(QUADRANT_STYLES.appreciating_cash_consuming.text).toContain('blue');
    expect(QUADRANT_STYLES.consuming.text).toContain('red');
  });
});

describe('QUADRANT_GRID', () => {
  it('lists all four quadrants exactly once', () => {
    expect([...QUADRANT_GRID].sort()).toEqual([...ALL_QUADRANTS].sort());
  });
});

describe('quadrantLabel', () => {
  it('returns the Chinese and English labels for every quadrant', () => {
    for (const q of ALL_QUADRANTS) {
      expect(quadrantLabel(q, 'zh')).toBeTruthy();
      expect(quadrantLabel(q, 'en')).toBeTruthy();
      expect(quadrantLabel(q, 'zh')).not.toBe(quadrantLabel(q, 'en'));
    }
  });
});

describe('quadrantExplanation', () => {
  it('gives a distinct one-line explanation per quadrant, in both languages', () => {
    const zhExplanations = new Set(ALL_QUADRANTS.map((q) => quadrantExplanation(q, 'zh')));
    const enExplanations = new Set(ALL_QUADRANTS.map((q) => quadrantExplanation(q, 'en')));
    expect(zhExplanations.size).toBe(ALL_QUADRANTS.length);
    expect(enExplanations.size).toBe(ALL_QUADRANTS.length);
  });
});
