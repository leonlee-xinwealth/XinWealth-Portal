// Graceful-degradation helpers for tables/columns that may not exist yet in
// every environment (P4's `reviews`/`liability_balances`, per spec
// docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md — "table
// `reviews` ... may NOT exist in production yet: every read/write must degrade
// gracefully"). Plain-JS mirror of components/advisor/assets/degrade.ts (that
// file is TypeScript and outside api/*.js's only-allowed import,
// api/_lib/taxonomy.mjs) — same detection logic, independently maintained.

const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204']);

export function isMissingColumnError(error) {
  if (!error) return false;
  if (error.code && MISSING_COLUMN_CODES.has(error.code)) return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache'));
}

/** Same idea, for a query against a table that may not exist yet
 *  (reviews/liability_balances before their migration has been applied). */
export function isMissingTableError(error) {
  if (!error) return false;
  if (error.code === '42P01') return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('relation') && msg.includes('does not exist');
}
