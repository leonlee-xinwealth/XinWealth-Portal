// P4 Task A — advisor monitoring alerts.
// spec docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md 决策 5.
//
// Every threshold below is the exact number spec decision 5 states:
//   unexplained_gap        |unexplained_gap| > max(RM 5,000, 5% of net worth)
//   emergency_fund_low     basic_liquidity_ratio (months) < 3
//   dsr_rising             DSR risen ≥ 5 percentage points since the last snapshot
//   dsr_high               DSR > 60%
//   quarterly_review_due   > 92 days since the last APPROVED quarterly review
//   quarterly_review_overdue > 120 days since the last APPROVED quarterly review
//     (overdue supersedes due — a client past 120 days gets ONLY the overdue alert)
//   annual_review_due      > 365 days since the last APPROVED annual review
//   estimated_rate         a liability's interest_rate was D1-estimated, not given
//   review_pending         a review sits in status = 'submitted' (awaiting approval)
//
// review-cadence alerts (quarterly/annual _due/_overdue) only fire once the
// client HAS a prior approved review of that kind — with no baseline date to
// measure from (no "plan start date" concept exists yet), firing on a client
// who has literally never had one would be a guess dressed as a threshold.
// That client instead surfaces however "no review yet" is already shown
// elsewhere (out of scope for this file).
//
// ─────────────────────────────────────────────────────────────────────────────
// Imports: ./loans.ts only (estimateLoan/LoanEstimate/LoanInput) — the same
// D1 estimator derived.ts and assetQuality.ts already use, relative with the
// `.ts` extension.
// ─────────────────────────────────────────────────────────────────────────────

import { estimateLoan, type LoanEstimate, type LoanInput } from "./loans.ts";

export type AlertSeverity = "high" | "medium" | "low";

export interface Alert {
  code:
    | "unexplained_gap"
    | "emergency_fund_low"
    | "dsr_rising"
    | "dsr_high"
    | "quarterly_review_due"
    | "quarterly_review_overdue"
    | "annual_review_due"
    | "estimated_rate"
    | "review_pending";
  severity: AlertSeverity;
  message_zh: string;
  message_en: string;
  client_id: string;
}

export interface AlertSnapshot {
  /** 'YYYY-MM-DD' */
  snapshot_date: string;
  net_worth?: number | null;
  debt_service_ratio?: number | null;
  /** months of coverage — computeSnapshot's `basic_liquidity_ratio` /
   *  `emergency_fund_months` (the same value under either name). */
  basic_liquidity_ratio?: number | null;
  /** reconcile.ts's `unexplained_gap`, when this snapshot has one attached. */
  unexplained_gap?: number | null;
}

export interface AlertReview {
  kind: "quarterly" | "annual";
  status: "draft" | "submitted" | "approved" | "rejected";
  /** 'YYYY-MM-DD' */
  period_end: string;
  approved_at?: string | null;
}

export interface AlertLiability extends LoanInput {
  id?: string | null;
  name?: string | null;
}

export interface ComputeAlertsInput {
  client_id: string;
  /** any order — sorted by snapshot_date internally. */
  snapshots: readonly AlertSnapshot[];
  /** the just-computed (possibly not-yet-persisted) snapshot; compared
   *  against the most recent entry in `snapshots` for the DSR-rising check. */
  latestSnapshot: AlertSnapshot;
  reviews: readonly AlertReview[];
  liabilities?: readonly AlertLiability[];
  /** precomputed estimateLoan() results, index-aligned with `liabilities` —
   *  skips recomputation when the caller already has them (e.g. from the
   *  same planCashflow call that fed computeSnapshot). Falls back to calling
   *  estimateLoan itself when omitted. */
  loanEstimates?: readonly LoanEstimate[];
  asOf: Date | string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const EMERGENCY_FUND_MONTHS_MIN = 3;
const UNEXPLAINED_GAP_FLOOR = 5000;
const UNEXPLAINED_GAP_PCT_OF_NW = 0.05;
const DSR_RISE_THRESHOLD = 0.05; // 5 percentage points, DSR stored as a 0–1 fraction
const DSR_HIGH_THRESHOLD = 0.6;
const QUARTERLY_DUE_DAYS = 92;
const QUARTERLY_OVERDUE_DAYS = 120;
const ANNUAL_DUE_DAYS = 365;

const SEVERITY_RANK: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };

function toUtcMs(d: Date | string): number {
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(d).getTime();
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function daysBetween(from: Date | string, to: Date | string): number {
  return Math.floor((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

function sortedByDate(snapshots: readonly AlertSnapshot[]): AlertSnapshot[] {
  return [...snapshots].sort((a, b) =>
    a.snapshot_date < b.snapshot_date ? -1 : a.snapshot_date > b.snapshot_date ? 1 : 0
  );
}

/** The most recently APPROVED review of `kind`, by period_end. */
function lastApproved(reviews: readonly AlertReview[], kind: "quarterly" | "annual"): AlertReview | null {
  const approved = reviews.filter((r) => r.kind === kind && r.status === "approved");
  if (approved.length === 0) return null;
  return approved.reduce((latest, r) => (r.period_end > latest.period_end ? r : latest));
}

export function computeAlerts(input: ComputeAlertsInput): Alert[] {
  const { client_id, latestSnapshot, reviews, asOf } = input;
  const liabilities = input.liabilities ?? [];
  const alerts: Alert[] = [];

  const push = (
    code: Alert["code"],
    severity: AlertSeverity,
    message_zh: string,
    message_en: string,
  ) => alerts.push({ code, severity, message_zh, message_en, client_id });

  // ---- unexplained_gap ----
  const gap = latestSnapshot.unexplained_gap;
  const netWorth = latestSnapshot.net_worth ?? 0;
  if (gap != null) {
    const threshold = Math.max(UNEXPLAINED_GAP_FLOOR, UNEXPLAINED_GAP_PCT_OF_NW * Math.abs(netWorth));
    if (Math.abs(gap) > threshold) {
      push(
        "unexplained_gap",
        "medium",
        `净资产有 RM ${Math.abs(gap).toLocaleString("en-MY", { maximumFractionDigits: 0 })} 未能解释，请检查本期资产/负债记录`,
        `RM ${Math.abs(gap).toLocaleString("en-MY", { maximumFractionDigits: 0 })} of net worth change is unexplained — review this period's asset/liability entries`,
      );
    }
  }

  // ---- emergency_fund_low ----
  const months = latestSnapshot.basic_liquidity_ratio;
  if (months != null && months < EMERGENCY_FUND_MONTHS_MIN) {
    push(
      "emergency_fund_low",
      "high",
      `紧急预备金仅 ${months.toFixed(1)} 个月，低于 3 个月的最低标准`,
      `Emergency fund covers only ${months.toFixed(1)} months, below the 3-month minimum`,
    );
  }

  // ---- dsr_rising / dsr_high ----
  const history = sortedByDate(input.snapshots);
  const prevSnapshot = history.length > 0 ? history[history.length - 1] : null;
  const currDsr = latestSnapshot.debt_service_ratio;
  const prevDsr = prevSnapshot?.debt_service_ratio;
  if (currDsr != null && prevDsr != null) {
    // Rounded to the same 4dp precision computeSnapshot stores ratios at —
    // without it, e.g. 0.35 - 0.30 === 0.049999999999999996 in IEEE754 and a
    // real 5pp rise would silently miss the >= threshold below.
    const risePp = Math.round((currDsr - prevDsr) * 10000) / 10000;
    if (risePp >= DSR_RISE_THRESHOLD) {
      push(
        "dsr_rising",
        "medium",
        `负债偿还比率较上次快照上升 ${(risePp * 100).toFixed(1)} 个百分点`,
        `Debt service ratio rose ${(risePp * 100).toFixed(1)} percentage points since the last snapshot`,
      );
    }
  }
  if (currDsr != null && currDsr > DSR_HIGH_THRESHOLD) {
    push(
      "dsr_high",
      "high",
      `负债偿还比率达 ${(currDsr * 100).toFixed(1)}%，超过 60%`,
      `Debt service ratio is ${(currDsr * 100).toFixed(1)}%, above 60%`,
    );
  }

  // ---- quarterly_review_due / _overdue ----
  const lastQuarterly = lastApproved(reviews, "quarterly");
  if (lastQuarterly) {
    const since = daysBetween(lastQuarterly.approved_at ?? lastQuarterly.period_end, asOf);
    if (since > QUARTERLY_OVERDUE_DAYS) {
      push(
        "quarterly_review_overdue",
        "high",
        `季度复检已逾期 ${since} 天（上次批准：${lastQuarterly.period_end}）`,
        `Quarterly review is ${since} days overdue (last approved: ${lastQuarterly.period_end})`,
      );
    } else if (since > QUARTERLY_DUE_DAYS) {
      push(
        "quarterly_review_due",
        "medium",
        `季度复检已到期 ${since} 天（上次批准：${lastQuarterly.period_end}）`,
        `Quarterly review is due, ${since} days since last approved (${lastQuarterly.period_end})`,
      );
    }
  }

  // ---- annual_review_due ----
  const lastAnnual = lastApproved(reviews, "annual");
  if (lastAnnual) {
    const since = daysBetween(lastAnnual.approved_at ?? lastAnnual.period_end, asOf);
    if (since > ANNUAL_DUE_DAYS) {
      push(
        "annual_review_due",
        "medium",
        `年度全面复检已到期 ${since} 天（上次批准：${lastAnnual.period_end}）`,
        `Annual full review is due, ${since} days since last approved (${lastAnnual.period_end})`,
      );
    }
  }

  // ---- estimated_rate ----
  if (liabilities.length > 0) {
    const asOfDate = typeof asOf === "string" ? new Date(asOf) : asOf;
    const estimatedNames: string[] = [];
    liabilities.forEach((l, i) => {
      const est = input.loanEstimates?.[i] ?? estimateLoan(l, asOfDate);
      if (est.estimated.includes("interest_rate")) estimatedNames.push(l.name ?? l.liability_type);
    });
    if (estimatedNames.length > 0) {
      push(
        "estimated_rate",
        "low",
        `${estimatedNames.length} 项负债的利率为估算值（${estimatedNames.join("、")}），复检时请更新利率`,
        `${estimatedNames.length} liabilit${estimatedNames.length === 1 ? "y has" : "ies have"} an estimated interest rate (${estimatedNames.join(", ")}) — update it at the next review`,
      );
    }
  }

  // ---- review_pending ----
  for (const r of reviews) {
    if (r.status !== "submitted") continue;
    push(
      "review_pending",
      "low",
      `有一份${r.kind === "quarterly" ? "季度" : "年度"}复检（截至 ${r.period_end}）待审核`,
      `A ${r.kind} review (period ending ${r.period_end}) is awaiting approval`,
    );
  }

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
