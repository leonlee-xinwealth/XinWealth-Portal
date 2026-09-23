// Graceful-degradation helpers for P3 columns/tables that may not exist yet
// in every environment (investment_accounts.asset_id, asset_valuations —
// spec docs/superpowers/specs/2026-09-26-cfp-p3-assets-portfolio-design.md).
// A write that references a column PostgREST/Postgres doesn't know about
// should be retried without it rather than surfacing a hard error to the
// advisor; this is the shared test for "was that the reason it failed".

export interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204']);

export function isMissingColumnError(error: PostgrestLikeError | null | undefined): boolean {
  if (!error) return false;
  if (error.code && MISSING_COLUMN_CODES.has(error.code)) return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache'));
}

/** Same idea, for a query against a table that may not exist yet
 *  (asset_valuations before its migration has been applied). */
export function isMissingTableError(error: PostgrestLikeError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('relation') && msg.includes('does not exist');
}
