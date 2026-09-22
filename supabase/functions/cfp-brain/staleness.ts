// Detects sections whose approved prose no longer describes the current
// numbers, and demotes them.
//
// The decision is a pure function (`planStaleness`) so it can be tested without
// a database; `sweepStaleness` is the thin layer that reads the rows, applies
// the plan and reports what moved.
//
// Two rules carry all the weight:
//
//   A null fingerprint is never touched. It means "generated before this
//   pipeline existed", i.e. we have no idea what the prose was written
//   against — and silently demoting every historical approval on the first
//   deploy would be worse than leaving them alone. They pick up a fingerprint
//   the next time they are generated.
//
//   A demotion is never silent. `stale_reason` is what the review page shows
//   the advisor, and it survives until the section is regenerated or
//   re-approved — including when the numbers happen to swing back to their old
//   values. Clearing the reason on a coincidental match would leave a section
//   demoted with nothing on screen explaining why.

import type { FinancialBaseline, SectionType } from "./types.ts";
import { allFingerprints } from "./fingerprint.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

export const STALE_BASIS_CHANGED = "basis_changed";

export interface SectionReviewRow {
  id: string;
  section_type: SectionType;
  status: string;
  /** null = never generated; nothing to stale */
  content: unknown;
  input_fingerprint: string | null;
}

export interface StaleAction {
  id: string;
  section_type: SectionType;
  /** demote: an approval is being withdrawn. flag: a draft is marked only. */
  kind: "demote" | "flag";
}

/**
 * Which rows the new fingerprints invalidate.
 *
 * `next` is keyed by section type; a section missing from it (module not
 * registered yet) is left alone rather than treated as changed.
 */
export function planStaleness(
  rows: SectionReviewRow[],
  next: Partial<Record<SectionType, string>>,
): StaleAction[] {
  const actions: StaleAction[] = [];
  for (const row of rows) {
    if (row.content == null) continue;
    // Unknown provenance — see the header.
    if (!row.input_fingerprint) continue;
    // A run is in flight (generating) or there is nothing to preserve
    // (failed); either way its own saveDraft will settle the fingerprint.
    if (row.status !== "approved" && row.status !== "draft") continue;

    const fresh = next[row.section_type];
    if (!fresh || fresh === row.input_fingerprint) continue;

    actions.push({
      id: row.id,
      section_type: row.section_type,
      kind: row.status === "approved" ? "demote" : "flag",
    });
  }
  return actions;
}

export async function applyStaleness(
  db: Db,
  actions: StaleAction[],
  now = new Date(),
): Promise<void> {
  const stamp = now.toISOString();
  for (const a of actions) {
    const patch: Record<string, unknown> = {
      stale_reason: STALE_BASIS_CHANGED,
      stale_at: stamp,
    };
    if (a.kind === "demote") {
      // Withdraw the approval outright. Leaving status 'approved' with a stale
      // flag would let the export gate open on prose nobody has re-read.
      patch.status = "draft";
      patch.approved_at = null;
      patch.approved_by = null;
    }
    await db.from("report_sections").update(patch).eq("id", a.id);
  }
}

export interface SweepResult {
  demoted: SectionType[];
  flagged: SectionType[];
}

/**
 * Recompute every section's fingerprint against the current basis and demote
 * whatever no longer matches. Safe to call whenever the basis may have moved —
 * it makes no LLM calls and writes only to rows that actually changed.
 *
 * `skip` excludes the section the caller just regenerated: its fingerprint was
 * written moments ago and matching it again is pure noise.
 */
export async function sweepStaleness(
  db: Db,
  reportId: string,
  det: Partial<Record<SectionType, unknown>>,
  baseline: FinancialBaseline,
  skip?: SectionType,
): Promise<SweepResult> {
  const next = await allFingerprints(det, baseline);

  const { data: rows } = await db
    .from("report_sections")
    .select("id, section_type, status, content, input_fingerprint")
    .eq("report_id", reportId);

  const candidates = ((rows ?? []) as SectionReviewRow[])
    .filter((r) => r.section_type !== skip);

  const actions = planStaleness(candidates, next);
  await applyStaleness(db, actions);

  return {
    demoted: actions.filter((a) => a.kind === "demote").map((a) => a.section_type),
    flagged: actions.filter((a) => a.kind === "flag").map((a) => a.section_type),
  };
}
