// CFP P4 Task C (client portal) — review due-date math: the period_end a
// client's quarterly submission gets stamped with, and the review_status
// api/health.js reports for the client home's due/pending banner.
// spec docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md
// 决策 5 (92-day quarterly cadence) / 决策 6 (client-home due banner).
// Pure date math, no Supabase — kept separate from api/levelUp.js and
// api/health.js so it is unit-testable without a DB fixture
// (scripts/__tests__/reviewDates.test.ts). Mirrors the day/month arithmetic
// in components/advisor/review/dateMath.ts (that file is TypeScript, outside
// api/*.js's only-allowed import, api/_lib/taxonomy.mjs) and the 92-day
// threshold supabase/functions/_shared/finance/alerts.ts already checks
// approved reviews against.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const QUARTERLY_DUE_DAYS = 92;

function toUtcMs(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr ?? ''));
  if (!m) {
    const d = new Date(dateStr);
    return d.getTime();
  }
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole days between two 'YYYY-MM-DD' (or ISO timestamp) strings (`to` − `from`), may be negative. */
export function daysBetween(fromStr, toStr) {
  return Math.round((toUtcMs(toStr) - toUtcMs(fromStr)) / MS_PER_DAY);
}

function toDateOnly(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' of the last day of the calendar quarter containing `date`
 *  (Jan–Mar → Mar 31, Apr–Jun → Jun 30, Jul–Sep → Sep 30, Oct–Dec → Dec 31). */
export function quarterEndDate(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const quarter = Math.floor(d.getUTCMonth() / 3); // 0-3
  const endMonth = quarter * 3 + 2; // 0-indexed month of the quarter's last month
  const end = new Date(Date.UTC(d.getUTCFullYear(), endMonth + 1, 0)); // day 0 of the next month
  return end.toISOString().slice(0, 10);
}

/**
 * reviews.period_end for a client-submitted quarterly review: the end of the
 * calendar quarter containing `asOf` — the natural reporting boundary a
 * "quarterly" review is stamped with (and what alerts.ts's 92-day cadence
 * check reads back later) — falling back to `asOf` itself on an
 * unparseable date, per spec "period_end: end of the current quarter or
 * today".
 */
export function quarterlyPeriodEnd(asOf = new Date()) {
  try {
    const q = quarterEndDate(asOf);
    if (q && !q.startsWith('NaN')) return q;
  } catch {
    // fall through to the `asOf`-as-is fallback below
  }
  try {
    return toDateOnly(asOf);
  } catch {
    return toDateOnly(new Date());
  }
}

function reviewDate(r) {
  return r?.approved_at || r?.submitted_at || r?.period_end || null;
}

/**
 * review_status for api/health.js's client-portal response: the due banner
 * (>92 days since the last approved/submitted quarterly review, or — with no
 * review history at all — since the client onboarded) vs the
 * 「等待顾问审核」pending state (a submitted review sitting unapproved).
 * `reviews` may be every kind/status the caller has on hand — only
 * kind==='quarterly' rows are considered here.
 */
export function computeReviewStatus({ reviews, onboardedAt, asOf = new Date() } = {}) {
  const asOfStr = toDateOnly(asOf);
  const quarterly = (reviews || []).filter((r) => r && r.kind === 'quarterly');

  const approvedSorted = quarterly
    .filter((r) => r.status === 'approved')
    .sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)));
  const lastApproved = approvedSorted[0] || null;

  // "last approved/submitted quarterly review" (决策 6) — the most recent
  // review that's actually live (not a draft/rejected one), approved or
  // still awaiting approval.
  const relevantSorted = quarterly
    .filter((r) => r.status === 'approved' || r.status === 'submitted')
    .sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)));
  const last = relevantSorted[0] || null;

  const pending = quarterly.some((r) => r.status === 'submitted');

  let due;
  if (last) {
    due = daysBetween(reviewDate(last), asOfStr) > QUARTERLY_DUE_DAYS;
  } else if (onboardedAt) {
    due = daysBetween(toDateOnly(onboardedAt), asOfStr) > QUARTERLY_DUE_DAYS;
  } else {
    due = false;
  }

  return {
    last_approved_at: lastApproved ? reviewDate(lastApproved) : null,
    pending,
    due,
  };
}
