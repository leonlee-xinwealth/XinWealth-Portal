export const safeNumber = (v: any): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/**
 * @deprecated for cashflow_entries. A row there records ONE MONTH'S actual
 * amount, so converting it to a "monthly rate" and summing across rows treats
 * June's and July's figures as two concurrent commitments — the mistake that
 * made a real client's RM 1,548 of spending read as RM 128. Use
 * `annualizeCashflow` from supabase/functions/_shared/cashflow/periods.ts.
 *
 * Still correct for genuinely recurring commitments held elsewhere, such as an
 * insurance premium with its own frequency.
 */
export const toMonthly = (amount: number, frequency?: string | null): number => {
  const f = (frequency || 'monthly').toLowerCase();
  const map: Record<string, number> = {
    monthly: 1,
    quarterly: 1 / 3,
    semi_annual: 1 / 6,
    semiannual: 1 / 6,
    annual: 1 / 12,
    yearly: 1 / 12,
    weekly: 4.33,
    one_off: 0,
    oneoff: 0,
    single_premium: 0
  };
  return amount * (map[f] ?? 1);
};

export const firstDayOfCurrentMonth = () => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return d;
};

export const yyyyMmDd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const fmtRM = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const fmtPercent = (n: number) => `${n.toFixed(0)}%`;

export const fmtMultiplier = (n: number) => `${n.toFixed(1)}×`;

