// The single read path for the template's named narrative slots.
//
// The 29-page report reads NAMED slots, never a section's generic `client_view`
// prose. That is deliberate: the named slots are exactly what the advisor sees
// and approves on the review page, so what the export gate governs and what the
// client reads are the same text. If the PDF rendered `client_view` instead,
// the gate would govern one surface and the printed page would show another.
//
// Everything here returns null when the slot is absent, and every caller must
// treat null as "render the empty state". Sections generated before these slots
// existed simply lack the keys — there is no migration and no backfill, so a
// half-filled report is the normal state, not an error.
//
// COMPLIANCE: the model writes prose and picks an enum. It never writes an
// amount. `consequenceOf` returns the model's chosen `headline_key`; the page
// looks that key's figure up in the deterministic output and formats it here.
// See supabase/functions/cfp-brain/narrativeBlocks.ts.

import type { CfpReportData } from "../types";
import { sectionByType } from "../model";

export interface NarrativeCard {
  headline: string;
  body: string;
  bullets: string[];
}

export interface ConsequenceCard extends NarrativeCard {
  headlineKey: string | null;
}

export type Severity = "critical" | "attention" | "on_track";

const SEVERITIES: Severity[] = ["critical", "attention", "on_track"];

/** Trims a slot to the shape the pages expect, or null if it is unusable. */
// deno-lint-ignore no-explicit-any
function card(raw: any): NarrativeCard | null {
  if (!raw || typeof raw !== "object") return null;
  const headline = typeof raw.headline === "string" ? raw.headline.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  // A card with a headline and no body is a heading floating over white space;
  // the empty state reads better than half a card.
  if (!headline || !body) return null;
  const bullets = Array.isArray(raw.bullets)
    ? raw.bullets.filter((b: unknown): b is string => typeof b === "string" && b.trim() !== "")
    : [];
  return { headline, body, bullets };
}

export function solutionOf(
  data: CfpReportData,
  sectionType: string,
): NarrativeCard | null {
  return card(sectionByType(data, sectionType)?.content?.solution);
}

/**
 * `allowedKeys` guards the lookup the caller is about to do: a key outside the
 * module's own set means the figure lookup would miss and the page would print
 * a headline with no number beside it.
 */
export function consequenceOf(
  data: CfpReportData,
  sectionType: string,
  allowedKeys: readonly string[],
): ConsequenceCard | null {
  const raw = sectionByType(data, sectionType)?.content?.consequences;
  const base = card(raw);
  if (!base) return null;
  const key = typeof raw.headline_key === "string" ? raw.headline_key : null;
  return { ...base, headlineKey: key && allowedKeys.includes(key) ? key : null };
}

export function severityOf(
  data: CfpReportData,
  sectionType: string,
): Severity | null {
  const s = sectionByType(data, sectionType)?.content?.executive_summary?.severity;
  return SEVERITIES.includes(s) ? (s as Severity) : null;
}

/** P22 退休目标与定义 — prose only; both capital figures come from the det. */
export function retirementVisionOf(
  data: CfpReportData,
): { depletionBody: string; passiveBody: string } | null {
  const v = sectionByType(data, "retirement_planning")?.content?.vision;
  if (!v || typeof v !== "object") return null;
  const depletionBody = typeof v.depletion_body === "string" ? v.depletion_body.trim() : "";
  const passiveBody = typeof v.passive_body === "string" ? v.passive_body.trim() : "";
  // Both or neither: the page sets the two definitions against each other, and
  // one side alone argues for a choice without showing the alternative.
  if (!depletionBody || !passiveBody) return null;
  return { depletionBody, passiveBody };
}

export interface SwotBoardData {
  strengths: string[];
  warnings: string[];
  opportunities: string[];
}

/** P13 综合财务分析与洞察. */
export function swotOf(data: CfpReportData): SwotBoardData | null {
  const s = sectionByType(data, "financial_health")?.content?.swot;
  if (!s || typeof s !== "object") return null;
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const board = {
    strengths: list(s.strengths),
    warnings: list(s.warnings),
    opportunities: list(s.opportunities),
  };
  // An entirely empty board is the empty state; a board with two of three
  // columns filled is still worth printing — the missing column just means the
  // model found nothing to say there.
  const total = board.strengths.length + board.warnings.length + board.opportunities.length;
  return total > 0 ? board : null;
}
