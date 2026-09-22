import { describe, it, expect } from 'vitest';
import {
  annualizeByCategory,
  annualizeCashflow,
  defaultBasis,
  formatBasis,
  monthlyBreakdown,
  TRANSFER_CATEGORIES_INLINE,
  yearToDateTotals,
  type CashflowBasis,
  type PeriodRow,
} from '../../../supabase/functions/_shared/cashflow/periods';
import CASES from '../../../supabase/functions/_shared/cashflow/periods.cases.json';
import { TRANSFER_CATEGORY_CODES } from '../../../supabase/functions/_shared/taxonomy/cashflow';

// The vitest half of the dual-runtime check.
//
// supabase/functions/_shared/cashflow/periods.ts is imported here by the BROWSER
// bundle and by the Deno edge function, from one file with zero imports — the
// only module shape both resolvers agree on. This test and its Deno twin
// (periods.test.ts) run the same periods.cases.json so the advisor's screen and
// the generated report can never disagree about what a client earns.
//
// If this file ever fails to resolve the import, the shared-file arrangement has
// broken and the two runtimes are about to drift apart silently.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsOf(spec: any, all: any[]): PeriodRow[] {
  if (typeof spec === 'string' && spec.startsWith('@case:')) {
    return rowsOf(all[Number(spec.slice(6))].rows, all);
  }
  return spec as PeriodRow[];
}

const NUMERIC = [
  'monthly_income', 'monthly_expenses', 'annual_income', 'annual_expenses',
  'annual_items_income', 'annual_items_expenses',
] as const;

describe('shared cases — the browser must agree with the edge function', () => {
  for (const c of CASES.cases) {
    it(c.name, () => {
      const rows = rowsOf(c.rows, CASES.cases);
      const got = annualizeCashflow(rows, c.basis as CashflowBasis);
      const want = c.expect as Record<string, number | number[]>;

      for (const key of NUMERIC) {
        expect(got[key], key).toBeCloseTo(want[key] as number, 6);
        expect(Number.isFinite(got[key]), `${key} must never be NaN`).toBe(true);
      }
      expect(got.basis_months).toBe(want.basis_months);
      expect(got.months_with_data).toEqual(want.months_with_data);
    });
  }
});

describe('shared cases — year-to-date actuals', () => {
  for (const c of CASES.cases) {
    if (!c.ytd) continue;
    it(c.name, () => {
      expect(yearToDateTotals(rowsOf(c.rows, CASES.cases), c.ytd.year)).toEqual(c.ytd);
    });
  }
});

describe('shared cases — defaultBasis', () => {
  for (const c of CASES.defaultBasis) {
    it(c.name, () => {
      expect(defaultBasis(rowsOf(c.rows, CASES.cases))).toEqual(c.expect);
    });
  }
});

describe('what the advisor screen shows', () => {
  const LEE: PeriodRow[] = rowsOf('@case:0', CASES.cases);

  it('separates the year total from the monthly positions', () => {
    // The 全年 view is the sum of the months; each 单月 view is that month.
    expect(yearToDateTotals(LEE, 2026).expenses).toBe(1548);
    const months = monthlyBreakdown(LEE, 2026);
    expect(months.map(m => [m.month, m.expenses])).toEqual([[6, 1420], [7, 128]]);
  });

  it('exposes how many rows each month holds', () => {
    // Six rows in June against one in July is the difference between a lean
    // month and a half-entered one — visible at a glance, impossible to compute.
    expect(monthlyBreakdown(LEE, 2026).map(m => m.entries)).toEqual([6, 1]);
  });

  it('names the basis the way it will be printed on the report', () => {
    expect(formatBasis({ year: 2026, from_month: 6, to_month: 7 })).toBe('2026 年 6–7 月');
    expect(formatBasis({ year: 2026, from_month: 6, to_month: 7 }, 'en')).toBe('Jun–Jul 2026');
  });
});

describe('shared cases — annualizeByCategory', () => {
  it('uses the taxonomy transfer list', () => {
    expect([...TRANSFER_CATEGORIES_INLINE].sort()).toEqual([...TRANSFER_CATEGORY_CODES]);
  });
  for (const c of CASES.byCategory) {
    it(c.name, () => {
      const rows = c.rows as PeriodRow[];
      const basis = c.basis as CashflowBasis;
      const by = Object.fromEntries(annualizeByCategory(rows, basis).map((x) => [x.category, x]));
      for (const [cat, want] of Object.entries(c.expect)) {
        expect(by[cat]?.monthly_income ?? 0, cat).toBeCloseTo(want.monthly_income, 6);
        expect(by[cat]?.monthly_expenses ?? 0, cat).toBeCloseTo(want.monthly_expenses, 6);
      }
      expect(by.to_savings).toBeUndefined();
      const total = annualizeCashflow(rows, basis);
      const sum = annualizeByCategory(rows, basis).reduce((s, x) => s + x.monthly_expenses, 0);
      expect(sum).toBeCloseTo(total.monthly_expenses, 6);
      const withT = Object.fromEntries(
        annualizeByCategory(rows, basis, { includeTransfers: true }).map((x) => [x.category, x]),
      );
      for (const [cat, want] of Object.entries(c.expectWithTransfers)) {
        expect(withT[cat]?.monthly_expenses ?? 0, cat).toBeCloseTo(want.monthly_expenses, 6);
      }
    });
  }
});
