import { describe, it, expect } from 'vitest';
import {
  isItemEnded,
  monthLabel,
  visibleStandingItems,
  type StandingItemRow,
} from '../standingItemRows';

// Minimal fixtures — only the fields visibleStandingItems/isItemEnded read.
function item(overrides: Partial<StandingItemRow>): StandingItemRow {
  return {
    id: 'x',
    direction: 'outflow',
    category: 'groceries',
    amount: 100,
    frequency: 'monthly',
    effective_from: '2026-01-01',
    effective_to: null,
    ...overrides,
  };
}

describe('visibleStandingItems', () => {
  it('filters by direction', () => {
    const items = [
      item({ id: 'a', direction: 'inflow' }),
      item({ id: 'b', direction: 'outflow' }),
    ];
    expect(visibleStandingItems(items, 'outflow', '2026-06-01', false).map((i) => i.id)).toEqual(['b']);
    expect(visibleStandingItems(items, 'inflow', '2026-06-01', false).map((i) => i.id)).toEqual(['a']);
  });

  it('excludes one_off items — they belong in the separate one-off list', () => {
    const items = [
      item({ id: 'a', frequency: 'one_off', effective_from: '2026-06-01', effective_to: '2026-06-01' }),
      item({ id: 'b', frequency: 'monthly' }),
    ];
    expect(visibleStandingItems(items, 'outflow', '2026-06-01', false).map((i) => i.id)).toEqual(['b']);
    expect(visibleStandingItems(items, 'outflow', '2026-06-01', true).map((i) => i.id)).toEqual(['b']);
  });

  it('active-only view hides items ended before asOf, or not yet started', () => {
    const items = [
      item({ id: 'ended', effective_from: '2026-01-01', effective_to: '2026-03-01' }),
      item({ id: 'future', effective_from: '2026-09-01' }),
      item({ id: 'current', effective_from: '2026-01-01', effective_to: null }),
    ];
    expect(visibleStandingItems(items, 'outflow', '2026-06-01', false).map((i) => i.id)).toEqual(['current']);
  });

  it('history view shows everything, latest version first within a category', () => {
    const items = [
      item({ id: 'old', category: 'rent', effective_from: '2026-01-01', effective_to: '2026-03-01' }),
      item({ id: 'new', category: 'rent', effective_from: '2026-04-01', effective_to: null, previous_id: 'old' }),
    ];
    const rows = visibleStandingItems(items, 'outflow', '2026-06-01', true);
    expect(rows.map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('sorts by category code, then name within the same effective_from', () => {
    const items = [
      item({ id: 'b', category: 'utilities', name: 'Zeta' }),
      item({ id: 'a', category: 'groceries', name: 'Alpha' }),
      item({ id: 'c', category: 'groceries', name: 'Beta' }),
    ];
    const rows = visibleStandingItems(items, 'outflow', '2026-06-01', false);
    expect(rows.map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('isItemEnded', () => {
  it('is false when effective_to is null/undefined', () => {
    expect(isItemEnded({ effective_to: null }, '2026-06-01')).toBe(false);
    expect(isItemEnded({}, '2026-06-01')).toBe(false);
  });

  it('is true only once effective_to is strictly before asOf\'s month', () => {
    expect(isItemEnded({ effective_to: '2026-05-01' }, '2026-06-01')).toBe(true);
    expect(isItemEnded({ effective_to: '2026-06-01' }, '2026-06-01')).toBe(false);
    expect(isItemEnded({ effective_to: '2026-07-01' }, '2026-06-01')).toBe(false);
  });
});

describe('monthLabel', () => {
  it('slices YYYY-MM out of a full date', () => {
    expect(monthLabel('2026-04-01')).toBe('2026-04');
  });
  it('returns "" for a missing/unusable value', () => {
    expect(monthLabel(null)).toBe('');
    expect(monthLabel(undefined)).toBe('');
    expect(monthLabel('garbage')).toBe('');
  });
});
