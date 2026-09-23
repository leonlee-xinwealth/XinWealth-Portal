// CFP P4 Task B — small date-math helper shared by approveReview.ts and
// MonitorTab.tsx. Kept in its own file (no React/Supabase imports) so it can
// be unit tested in isolation and reused by both.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** average Gregorian month length — good enough for "how many months apart
 *  are these two review dates", which is all reconcile.ts's `months` input
 *  and the monitor chart's plan-projection line need. Not calendar-exact
 *  (reconcile.ts's own header explains why a caller-supplied approximation
 *  beats fighting exact calendar-month arithmetic here). */
const AVG_DAYS_PER_MONTH = 30.4368;

function toUtcMs(dateStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr ?? '');
  if (!m) {
    const d = new Date(dateStr);
    return d.getTime();
  }
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole days between two 'YYYY-MM-DD' dates (`to` − `from`), may be negative. */
export function daysBetween(fromStr: string, toStr: string): number {
  return Math.round((toUtcMs(toStr) - toUtcMs(fromStr)) / MS_PER_DAY);
}

/** Months between two 'YYYY-MM-DD' dates, rounded to the nearest whole month
 *  and floored at 1 (reconcile.ts needs at least one month of plan to
 *  explain anything; a same-day or backwards gap is treated as one month
 *  rather than zero/negative, which would make every explained component
 *  collapse to 0 and read as a huge unexplained gap). */
export function monthsBetween(fromStr: string, toStr: string): number {
  const days = daysBetween(fromStr, toStr);
  return Math.max(1, Math.round(days / AVG_DAYS_PER_MONTH));
}

/** Fractional months — used by the monitor chart's plan-projection line,
 *  which plots one point per snapshot date rather than per whole month and
 *  should not visually "step" between them. */
export function monthsBetweenFractional(fromStr: string, toStr: string): number {
  return daysBetween(fromStr, toStr) / AVG_DAYS_PER_MONTH;
}
