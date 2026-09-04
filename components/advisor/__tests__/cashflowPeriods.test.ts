import { describe, it, expect } from 'vitest';
import {
  annualizeCashflow,
  defaultBasis,
  formatBasis,
  monthlyBreakdown,
  yearToDateTotals,
  type CashflowBasis,
  type PeriodRow,
} from '../../../supabase/functions/_shared/cashflow/periods';
import CASES from '../../../supabase/functions/_shared/cashflow/periods.cases.json';

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
