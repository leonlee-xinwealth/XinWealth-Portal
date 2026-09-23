// CFP P4 Task B — building a reviews.payload from a client's CURRENT
// assets/liabilities. Used by 「顾问代填季度复检」 (advisor fills a quarterly
// review on the client's behalf) and 「年度全面复检」 (the annual checklist's
// final save) — both produce the SAME payload shape approveReview.ts already
// knows how to apply, so an annual review is, as far as the approval math
// goes, just a quarterly one with a longer look-back and a different `kind`.
//
// Prefilling sets both `prev_*` and the editable value to the current DB
// figure — "no change" is the default; the advisor edits only what actually
// moved before submitting.

import type {
  ApproveReviewAsset,
  ApproveReviewLiability,
  ReviewPayload,
  ReviewPayloadAsset,
  ReviewPayloadLiability,
} from "./approveReview";

export function buildPrefilledPayload(
  assets: readonly ApproveReviewAsset[],
  liabilities: readonly ApproveReviewLiability[],
  notes?: string | null,
): ReviewPayload {
  const payloadAssets: ReviewPayloadAsset[] = assets.map((a) => {
    const value = Number(a.current_value) || 0;
    return { asset_id: a.id, prev_value: value, value };
  });

  const payloadLiabilities: ReviewPayloadLiability[] = liabilities.map((l) => {
    const balance = Number(l.outstanding_balance) || 0;
    return {
      liability_id: l.id,
      prev_balance: balance,
      balance,
      prev_rate: l.interest_rate ?? null,
      interest_rate: l.interest_rate ?? null,
      monthly_payment: l.monthly_payment ?? null,
    };
  });

  return { assets: payloadAssets, liabilities: payloadLiabilities, notes: notes ?? null };
}
