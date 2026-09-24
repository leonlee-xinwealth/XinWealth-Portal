// Dedupe/validation helpers for the client-submitted quarterly review
// payload (api/levelUp.js handleSubmitReview). Split out of that handler so
// the "last duplicate id wins, non-finite/negative values are rejected"
// rules are unit-testable (scripts/__tests__/reviewSubmission.test.ts)
// without a Supabase fixture.
//
// A duplicate asset_id/liability_id surviving into reviews.payload makes the
// advisor's approval (components/advisor/review/approveReview.ts
// buildValuationRows/buildBalanceRows) build an upsert with a repeated
// conflict key, which Postgres rejects with "ON CONFLICT DO UPDATE command
// cannot affect row a second time" — forever, on every retry, since the bad
// row is already stuck in reviews.payload. De-duplicating at submission time
// (here) is the primary fix; approveReview.ts applies the same rule again,
// independently (it's TypeScript, outside api/*.js's only-allowed import,
// api/_lib/taxonomy.mjs), as defence in depth before writing.

/** De-duplicates a list of objects by `idKey`, keeping only the LAST entry
 *  for each id — a later duplicate in the submitted array overrides an
 *  earlier one rather than the review recording the same id twice. Entries
 *  that are missing (null/undefined) or have no usable id are dropped. */
export function dedupeById(list, idKey) {
  const map = new Map();
  for (const item of list || []) {
    if (!item) continue;
    const id = item[idKey];
    if (id == null || id === '') continue;
    map.set(id, item);
  }
  return [...map.values()];
}

/** Strictly parses a monetary/rate value: a missing or blank raw value is
 *  treated as an explicit 0 (matches the tolerant `parseAmount` used to
 *  build the actual payload rows), but a value that IS present must parse to
 *  a finite, non-negative number — otherwise `{ ok: false }` is returned so
 *  the caller can reject the whole request with 400 instead of silently
 *  coercing garbage input (e.g. "abc", NaN, Infinity, a negative balance) to
 *  0 or a bogus number. */
export function parseStrictAmount(raw) {
  if (raw == null || raw === '') return { ok: true, value: 0 };
  const n = parseFloat(String(raw).replace(/RM/gi, '').replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n < 0) return { ok: false, value: null };
  return { ok: true, value: n };
}
