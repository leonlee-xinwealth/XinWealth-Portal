// CFP P4 Task B — advisor-side review approval.
// spec docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md 决策 1, 2, 3, 4.
//
// "批准才生效" (D5): a submitted review changes nothing on its own. Approving
// one, in order (决策 2):
//   1. upsert asset_valuations (source='review', valuation_date=period_end)
//   2. update assets.current_value / valuation_date
//   3. upsert liability_balances (source='review', balance_date=period_end)
//   4. update liabilities.outstanding_balance / interest_rate / monthly_payment
//   5. computeSnapshot() on the now-updated assets/liabilities
//   6. reconcile() against the previous health_snapshot (when one exists)
//   7. insert/upsert health_snapshots (snapshot_date=period_end, review_id,
//      unexplained_gap, raw_metrics carrying the reconciliation detail)
//   8. set reviews.status/approved_by/approved_at
//
// This module does the writes but takes every READ as input (`assets`,
// `liabilities`, `items`, `policies`, `client`, `previousSnapshot`,
// `valuationsByAsset`) rather than querying for them itself — that keeps it
// "pure-ish": the payload → DB-operations mapping is a deterministic function
// of its arguments, so a unit test can hand it fixed context data and a mock
// Supabase client, and assert exactly what got written, without needing to
// fake a whole read path too. The caller (ReviewTab.tsx) already has (or
// cheaply loads) all of this.
//
// Every write that touches a P4/P3 table degrades instead of throwing when
// that table/column isn't there yet (spec: "these tables may NOT exist in
// production yet") — EXCEPT `assets`, `liabilities` and `reviews` themselves,
// which are old enough that their absence really is a hard error worth
// surfacing.

import {
  computeSnapshot,
  type SnapshotAsset,
  type SnapshotPolicy,
  type SnapshotResult,
} from "../../../supabase/functions/_shared/finance/snapshot";
import {
  reconcile,
  type ReconcileResult,
} from "../../../supabase/functions/_shared/finance/reconcile";
import type { LiabilityRow } from "../../../supabase/functions/_shared/finance/derived";
import type { StandingItem } from "../../../supabase/functions/_shared/cashflow/items";
import type { StatutoryClientInfo } from "../../../supabase/functions/_shared/finance/statutory";
import type { Valuation } from "../../../supabase/functions/_shared/finance/valuation";
import { isMissingColumnError, isMissingTableError, type PostgrestLikeError } from "../assets/degrade";
import { monthsBetween } from "./dateMath";

// ---------------------------------------------------------------------------
// Minimal structural Supabase client — just enough of the query-builder shape
// this module calls, so a unit test can pass a small hand-built fake instead
// of the real @supabase/supabase-js client.
// ---------------------------------------------------------------------------

export interface SupabaseQueryResult {
  data?: unknown;
  error?: PostgrestLikeError | null;
}

export interface SupabaseUpdateBuilder {
  eq(column: string, value: unknown): PromiseLike<SupabaseQueryResult>;
}

export interface SupabaseTableBuilder {
  upsert(rows: Record<string, unknown>[], options?: { onConflict?: string }): PromiseLike<SupabaseQueryResult>;
  update(fields: Record<string, unknown>): SupabaseUpdateBuilder;
}

export interface SupabaseLike {
  from(table: string): SupabaseTableBuilder;
}

// ---------------------------------------------------------------------------
// Review / payload shapes — public.reviews per the P4 migration.
// ---------------------------------------------------------------------------

export interface ReviewPayloadAsset {
  asset_id: string;
  prev_value?: number | null;
  value: number;
}

export interface ReviewPayloadLiability {
  liability_id: string;
  prev_balance?: number | null;
  balance: number;
  prev_rate?: number | null;
  interest_rate?: number | null;
  monthly_payment?: number | null;
}

export interface ReviewPayload {
  assets?: ReviewPayloadAsset[];
  liabilities?: ReviewPayloadLiability[];
  notes?: string | null;
}

export type ReviewKind = "quarterly" | "annual";
export type ReviewStatus = "draft" | "submitted" | "approved" | "rejected";

export interface ReviewRow {
  id: string;
  client_id: string;
  kind: ReviewKind;
  /** 'YYYY-MM-DD' */
  period_end: string;
  status: ReviewStatus;
  payload: ReviewPayload;
  advisor_note?: string | null;
}

// ---------------------------------------------------------------------------
// approveReview
// ---------------------------------------------------------------------------

export interface ApproveReviewAsset {
  id: string;
  asset_type: string;
  current_value?: number | null;
  ownership_pct?: number | null;
}

export interface ApproveReviewLiability extends LiabilityRow {
  id: string;
}

export interface PreviousSnapshotRef {
  /** 'YYYY-MM-DD' */
  snapshot_date: string;
  net_worth: number;
}

export interface ApproveReviewContext {
  review: ReviewRow;
  /** every one of the client's assets, current DB values (pre-approval). */
  assets: ApproveReviewAsset[];
  /** every one of the client's liabilities, current DB values (pre-approval). */
  liabilities: ApproveReviewLiability[];
  items?: StandingItem[];
  policies?: SnapshotPolicy[];
  client?: StatutoryClientInfo;
  /** the most recent health_snapshot strictly before `review.period_end`, or
   *  null/undefined when this is the client's first snapshot — reconcile is
   *  skipped in that case (nothing to reconcile against). */
  previousSnapshot?: PreviousSnapshotRef | null;
  /** each asset's valuation history BEFORE this approval's writes, keyed by
   *  asset id — used by reconcile() for the "prev" side and (merged with the
   *  values this approval is about to write) the "curr" side. */
  valuationsByAsset?: Record<string, Valuation[]>;
  /** advisor performing the approval — written to reviews.approved_by. */
  approvedBy: string;
  now?: Date;
}

export interface ApproveReviewResult {
  ok: boolean;
  error?: string;
  snapshot: SnapshotResult | null;
  reconciliation: ReconcileResult | null;
  /** non-fatal degrade notices (a P3/P4 table/column wasn't there yet, so
   *  that particular write was skipped) — surfaced so the caller can show
   *  them, never thrown. */
  notes: string[];
}

class ApproveReviewFailure extends Error {}

function errMessage(error: PostgrestLikeError | null | undefined, fallback: string): string {
  return error?.message || error?.code || fallback;
}

function buildValuationRows(clientId: string, periodEnd: string, assets: ReviewPayloadAsset[]) {
  return assets.map((a) => ({
    asset_id: a.asset_id,
    client_id: clientId,
    valuation_date: periodEnd,
    value: a.value,
    source: "review" as const,
  }));
}

function buildBalanceRows(clientId: string, periodEnd: string, liabilities: ReviewPayloadLiability[]) {
  return liabilities.map((l) => ({
    liability_id: l.liability_id,
    client_id: clientId,
    balance_date: periodEnd,
    balance: l.balance,
    interest_rate: l.interest_rate ?? null,
    monthly_payment: l.monthly_payment ?? null,
    source: "review" as const,
  }));
}

/** Merges this review's payload into the pre-approval asset/liability lists,
 *  producing the post-approval lists computeSnapshot should score. Exported
 *  so callers (and tests) that only need "what would the numbers look like"
 *  without touching the DB can call it directly. */
export function applyReviewPayload(
  assets: readonly ApproveReviewAsset[],
  liabilities: readonly ApproveReviewLiability[],
  payload: ReviewPayload,
): { assets: SnapshotAsset[]; liabilities: LiabilityRow[] } {
  const assetMap = new Map((payload.assets ?? []).map((a) => [a.asset_id, a] as const));
  const updatedAssets: SnapshotAsset[] = assets.map((a) => {
    const p = assetMap.get(a.id);
    if (!p) return a;
    return { ...a, current_value: p.value };
  });

  const liabMap = new Map((payload.liabilities ?? []).map((l) => [l.liability_id, l] as const));
  const updatedLiabilities: LiabilityRow[] = liabilities.map((l) => {
    const p = liabMap.get(l.id);
    if (!p) return l;
    return {
      ...l,
      outstanding_balance: p.balance,
      interest_rate: p.interest_rate ?? l.interest_rate,
      monthly_payment: p.monthly_payment ?? l.monthly_payment,
    };
  });

  return { assets: updatedAssets, liabilities: updatedLiabilities };
}

export async function approveReview(
  supabase: SupabaseLike,
  ctx: ApproveReviewContext,
): Promise<ApproveReviewResult> {
  const notes: string[] = [];
  const { review } = ctx;

  if (review.status !== "submitted") {
    return {
      ok: false,
      error: "只有待审核（submitted）的复检才能批准",
      snapshot: null,
      reconciliation: null,
      notes,
    };
  }

  const payloadAssets = review.payload?.assets ?? [];
  const payloadLiabilities = review.payload?.liabilities ?? [];
  const periodEnd = review.period_end;
  const clientId = review.client_id;

  try {
    // 1. asset_valuations (决策 2, step 1) — degrade if the P3 table isn't there.
    if (payloadAssets.length > 0) {
      const rows = buildValuationRows(clientId, periodEnd, payloadAssets);
      const { error } = await supabase.from("asset_valuations").upsert(rows, { onConflict: "asset_id,valuation_date" });
      if (error) {
        if (isMissingTableError(error)) {
          notes.push("asset_valuations 表尚未升级，跳过估值历史记录");
        } else {
          throw new ApproveReviewFailure(`写入资产估值失败：${errMessage(error, "unknown error")}`);
        }
      }
    }

    // 2. assets.current_value / valuation_date (决策 2, step 2).
    await Promise.all(
      payloadAssets.map(async (a) => {
        const { error } = await supabase
          .from("assets")
          .update({ current_value: a.value, valuation_date: periodEnd })
          .eq("id", a.asset_id);
        if (error) throw new ApproveReviewFailure(`更新资产 ${a.asset_id} 失败：${errMessage(error, "unknown error")}`);
      }),
    );

    // 3. liability_balances (决策 2, step 3) — degrade if the P4 table isn't there.
    if (payloadLiabilities.length > 0) {
      const rows = buildBalanceRows(clientId, periodEnd, payloadLiabilities);
      const { error } = await supabase.from("liability_balances").upsert(rows, { onConflict: "liability_id,balance_date" });
      if (error) {
        if (isMissingTableError(error)) {
          notes.push("liability_balances 表尚未升级，跳过负债余额历史记录");
        } else {
          throw new ApproveReviewFailure(`写入负债余额失败：${errMessage(error, "unknown error")}`);
        }
      }
    }

    // 4. liabilities.outstanding_balance / interest_rate / monthly_payment (决策 2, step 4).
    await Promise.all(
      payloadLiabilities.map(async (l) => {
        const fields: Record<string, unknown> = { outstanding_balance: l.balance };
        if (l.interest_rate != null) fields.interest_rate = l.interest_rate;
        if (l.monthly_payment != null) fields.monthly_payment = l.monthly_payment;
        const { error } = await supabase.from("liabilities").update(fields).eq("id", l.liability_id);
        if (error) throw new ApproveReviewFailure(`更新负债 ${l.liability_id} 失败：${errMessage(error, "unknown error")}`);
      }),
    );

    // 5. computeSnapshot on the merged (post-approval) assets/liabilities.
    const merged = applyReviewPayload(ctx.assets, ctx.liabilities, review.payload ?? {});
    const snapshot = computeSnapshot({
      assets: merged.assets,
      liabilities: merged.liabilities,
      items: ctx.items ?? [],
      policies: ctx.policies ?? [],
      client: ctx.client,
      asOf: periodEnd,
    });

    // 6. reconcile against the previous snapshot, when there is one.
    let reconciliation: ReconcileResult | null = null;
    if (ctx.previousSnapshot) {
      const months = monthsBetween(ctx.previousSnapshot.snapshot_date, periodEnd);
      const valuationsByAsset: Record<string, Valuation[]> = { ...(ctx.valuationsByAsset ?? {}) };
      // Fold this approval's own just-written valuations in, so reconcile's
      // "curr" side (valueAt at periodEnd) sees the value it just wrote,
      // not stale pre-approval history.
      for (const a of payloadAssets) {
        const existing = valuationsByAsset[a.asset_id] ?? [];
        valuationsByAsset[a.asset_id] = [
          ...existing.filter((v) => v.valuation_date !== periodEnd),
          { valuation_date: periodEnd, value: a.value },
        ];
      }

      const employeeEpf = Number(snapshot.raw_metrics.monthly_employee_epf) || 0;
      reconciliation = reconcile({
        prev: { net_worth: ctx.previousSnapshot.net_worth, asOf: ctx.previousSnapshot.snapshot_date },
        curr: { net_worth: snapshot.net_worth, asOf: periodEnd },
        months,
        plan: {
          monthly_surplus: snapshot.monthly_surplus,
          monthly_principal: snapshot.monthly_principal,
          monthly_employer_epf: snapshot.monthly_employer_epf,
          monthly_employee_epf: employeeEpf,
        },
        assets: merged.assets
          .filter((a): a is SnapshotAsset & { id: string } => a.id != null)
          .map((a) => ({ id: a.id, asset_type: a.asset_type })),
        valuationsByAsset,
        items: ctx.items ?? [],
      });
    }

    // 7. health_snapshots upsert — degrade the review_id/unexplained_gap
    // columns away if that ALTER TABLE hasn't landed yet, rather than
    // failing the whole approval over two optional columns.
    const fullPayload: Record<string, unknown> = {
      client_id: clientId,
      snapshot_date: periodEnd,
      net_worth: snapshot.net_worth,
      total_assets: snapshot.total_assets,
      total_liabilities: snapshot.total_liabilities,
      basic_liquidity_ratio: snapshot.basic_liquidity_ratio,
      liquid_asset_to_net_worth: snapshot.liquid_asset_to_net_worth,
      solvency_ratio: snapshot.solvency_ratio,
      debt_service_ratio: snapshot.debt_service_ratio,
      non_mortgage_dsr: snapshot.non_mortgage_dsr,
      savings_ratio: snapshot.savings_ratio,
      life_insurance_coverage: snapshot.life_insurance_coverage,
      invest_assets_to_net_worth: snapshot.invest_assets_to_net_worth,
      passive_income_coverage: snapshot.passive_income_coverage,
      review_id: review.id,
      unexplained_gap: reconciliation ? reconciliation.unexplained_gap : null,
      raw_metrics: { ...snapshot.raw_metrics, reconciliation },
    };

    let { error: snapErr } = await supabase
      .from("health_snapshots")
      .upsert([fullPayload], { onConflict: "client_id,snapshot_date" });
    if (snapErr && isMissingColumnError(snapErr)) {
      notes.push("health_snapshots.review_id/unexplained_gap 列尚未升级，快照已保存但未关联复检");
      const { review_id: _reviewId, unexplained_gap: _gap, ...trimmed } = fullPayload;
      ({ error: snapErr } = await supabase
        .from("health_snapshots")
        .upsert([trimmed], { onConflict: "client_id,snapshot_date" }));
    }
    if (snapErr) throw new ApproveReviewFailure(`写入健康快照失败：${errMessage(snapErr, "unknown error")}`);

    // 8. reviews.status/approved_by/approved_at.
    const { error: reviewErr } = await supabase
      .from("reviews")
      .update({
        status: "approved",
        approved_by: ctx.approvedBy,
        approved_at: (ctx.now ?? new Date()).toISOString(),
      })
      .eq("id", review.id);
    if (reviewErr) throw new ApproveReviewFailure(`更新复检状态失败：${errMessage(reviewErr, "unknown error")}`);

    return { ok: true, snapshot, reconciliation, notes };
  } catch (e) {
    const message = e instanceof ApproveReviewFailure ? e.message : e instanceof Error ? e.message : String(e);
    return { ok: false, error: message, snapshot: null, reconciliation: null, notes };
  }
}

// ---------------------------------------------------------------------------
// rejectReview — the simple half of 批准/退回. No snapshot/valuation writes;
// just records the advisor's note and flips status.
// ---------------------------------------------------------------------------

export interface RejectReviewInput {
  reviewId: string;
  note?: string | null;
}

export interface RejectReviewResult {
  ok: boolean;
  error?: string;
}

export async function rejectReview(supabase: SupabaseLike, input: RejectReviewInput): Promise<RejectReviewResult> {
  const { error } = await supabase
    .from("reviews")
    .update({ status: "rejected", advisor_note: input.note ?? null })
    .eq("id", input.reviewId);
  if (error) return { ok: false, error: errMessage(error, "unknown error") };
  return { ok: true };
}
