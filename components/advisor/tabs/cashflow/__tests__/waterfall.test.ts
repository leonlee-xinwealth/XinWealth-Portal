import { describe, it, expect } from 'vitest';
import {
  buildWaterfallRows, buildStatutoryBreakdown, hasManualIncomeTaxItem,
  type WaterfallPlanInput,
} from '../waterfall';
import type { StandingItem } from '../../../../../supabase/functions/_shared/cashflow/items';

// 乙 (WEI QI LEE), has_epf=true — the exact figures from
// supabase/functions/_shared/finance/derived.test.ts's own fixture and the
// plan's Verification section: income 2,577, EPF 284, SOCSO/EIS 17.85, tax 0
// (wiped out by the RM400 rebate), living 2,968 → take-home 2,275.15,
// savable/net -692.85.
function weiQiLeePlan(): WaterfallPlanInput {
  return {
    totals: { monthly_income: 2577 },
    monthly_employee_epf: 284,
    monthly_socso_eis: 17.85,
    monthly_income_tax: 0,
    monthly_statutory: 301.85,
    monthly_take_home: 2275.15,
    monthly_living: 2968,
    monthly_savable: -692.85,
    monthly_planned_savings: 0,
    monthly_net_cash_flow: -692.85,
  };
}

describe('buildWaterfallRows', () => {
  it("乙's case: rows carry the engine's own figures and add up exactly", () => {
    const rows = buildWaterfallRows(weiQiLeePlan());
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.amount]));

    expect(byKey.gross_income).toBe(2577);
    expect(byKey.tax_and_statutory).toBeCloseTo(301.85, 2);
    expect(byKey.take_home).toBeCloseTo(2275.15, 2);
    expect(byKey.living).toBe(2968);
    expect(byKey.savable).toBeCloseTo(-692.85, 2);
    expect(byKey.planned_savings).toBe(0);
    expect(byKey.net_cash_flow).toBeCloseTo(-692.85, 2);

    // The chain adds up exactly — no re-derivation drift.
    expect(byKey.gross_income - byKey.tax_and_statutory).toBeCloseTo(byKey.take_home, 2);
    expect(byKey.take_home - byKey.living).toBeCloseTo(byKey.savable, 2);
    expect(byKey.savable - byKey.planned_savings).toBeCloseTo(byKey.net_cash_flow, 2);
  });

  it('returns exactly the 7 compact-waterfall rows, in order', () => {
    const rows = buildWaterfallRows(weiQiLeePlan());
    expect(rows.map((r) => r.key)).toEqual([
      'gross_income', 'tax_and_statutory', 'take_home', 'living', 'savable', 'planned_savings', 'net_cash_flow',
    ]);
  });

  it('marks the headline row as net_cash_flow and the two running totals as subtotal', () => {
    const rows = buildWaterfallRows(weiQiLeePlan());
    expect(rows.find((r) => r.key === 'net_cash_flow')?.kind).toBe('headline');
    expect(rows.find((r) => r.key === 'take_home')?.kind).toBe('subtotal');
    expect(rows.find((r) => r.key === 'savable')?.kind).toBe('subtotal');
  });

  it('a negative net cash flow stays negative (headline turns red in the UI)', () => {
    const rows = buildWaterfallRows(weiQiLeePlan());
    expect(rows.find((r) => r.key === 'net_cash_flow')?.amount).toBeLessThan(0);
  });
});

describe('buildStatutoryBreakdown', () => {
  it("乙's case: EPF and SOCSO/EIS show, the zero tax line is dropped", () => {
    const items = buildStatutoryBreakdown(weiQiLeePlan());
    expect(items).toEqual([
      { key: 'epf_employee', amount: 284 },
      { key: 'socso_eis', amount: 17.85 },
    ]);
  });

  it('drops every zero component — a client with has_epf=false and no tax shows nothing', () => {
    const items = buildStatutoryBreakdown({
      ...weiQiLeePlan(),
      monthly_employee_epf: 0,
      monthly_socso_eis: 0,
      monthly_income_tax: 0,
      monthly_statutory: 0,
    });
    expect(items).toEqual([]);
  });

  it('keeps a manual/estimated income_tax component when the statutory side is zero', () => {
    const items = buildStatutoryBreakdown({
      ...weiQiLeePlan(),
      monthly_employee_epf: 0,
      monthly_socso_eis: 0,
      monthly_statutory: 0,
      monthly_income_tax: 3283,
    });
    expect(items).toEqual([{ key: 'income_tax', amount: 3283 }]);
  });
});

describe('hasManualIncomeTaxItem', () => {
  const today = new Date('2026-06-15T00:00:00Z');

  it('true when an active outflow income_tax standing item exists', () => {
    const items: StandingItem[] = [
      { direction: 'outflow', category: 'income_tax', amount: 600, frequency: 'monthly', effective_from: '2026-01-01' },
    ];
    expect(hasManualIncomeTaxItem(items, today)).toBe(true);
  });

  it('false when the income_tax item has already ended', () => {
    const items: StandingItem[] = [
      {
        direction: 'outflow', category: 'income_tax', amount: 600, frequency: 'monthly',
        effective_from: '2025-01-01', effective_to: '2025-12-01',
      },
    ];
    expect(hasManualIncomeTaxItem(items, today)).toBe(false);
  });

  it('false with no income_tax item at all — the engine estimate is what applies', () => {
    const items: StandingItem[] = [
      { direction: 'inflow', category: 'salary_basic', amount: 2577, frequency: 'monthly', effective_from: '2026-01-01' },
    ];
    expect(hasManualIncomeTaxItem(items, today)).toBe(false);
  });

  it('ignores an inflow row that happens to use the income_tax category', () => {
    const items: StandingItem[] = [
      { direction: 'inflow', category: 'income_tax', amount: 600, frequency: 'monthly', effective_from: '2026-01-01' },
    ];
    expect(hasManualIncomeTaxItem(items, today)).toBe(false);
  });
});
