// What a section's narrative was actually written against.
//
// The report is a fixed template that prints approved prose next to freshly
// recomputed numbers. That only holds together if we can tell when the numbers
// have moved out from under the prose. This module answers that question by
// hashing the exact inputs that reached the section's prompt.
//
// WHAT IS HASHED, and why each piece:
//
//   det     the module's own deterministic output. computeAll runs every module
//           in SECTION_ORDER on every invocation, and the updateBaseline hooks
//           have already fired by the time we hash — so a change in 保险 that
//           propagates to 税务 through annual_premium_current shows up in the
//           tax module's own det. That is why there is no hand-written
//           dependency graph here: the orchestrator's existing "recompute
//           everything" semantics already encode the graph, and a hand-written
//           copy would drift the first time someone adds a hook.
//
//   budget  the one line of 首席规划师's waterfall this section was told it may
//           spend. Regenerating any section reallocates the whole waterfall, so
//           this is the coupling that made the fingerprint necessary. Sections
//           with no budget line (税务/传承/综合) hash null.
//
//   demo    the household facts every prompt states in prose — age, dependents,
//           marital status, years to retirement. A birthday genuinely changes
//           the retirement argument, so it should stale.
//
//           It also carries the CASHFLOW BASIS: which months of actuals the
//           whole plan is annualised from. Moving the basis from June to
//           June–July moves every income and expense figure in the report, so
//           an approved section written against the old one is no longer
//           describing this client. This is the single largest thing an advisor
//           can change with one click, and it must withdraw approvals.
//
// WHAT IS DELIBERATELY NOT HASHED:
//
//   raw client data — renaming an asset from "ASB" to "ASB 户口" must not flip
//   eight approved sections back to draft. Only figures that reach a prompt
//   count, and those all arrive through det.
//
//   the prompt string itself — otherwise editing one line of instruction copy
//   and deploying would stale every approved section of every client at once.
//
// PII: this file never sees CfpData. It hashes det and baseline only, both of
// which are already PII-free by construction (see db.ts's select list).

import type { FinancialBaseline, SectionType } from "./types.ts";
import { SECTION_ORDER } from "./types.ts";
import { BUDGET_LINE, sectionBudgetContext } from "./budgetContext.ts";

/**
 * JSON with deterministic key order, so two structurally equal objects always
 * produce the same string. `undefined` members are dropped (matching
 * JSON.stringify) so an explicitly-absent optional field and a missing one
 * hash identically.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v === undefined ? null : v)).join(",")}]`;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const k of Object.keys(o).sort()) {
      if (o[k] === undefined) continue;
      parts.push(`${JSON.stringify(k)}:${stableStringify(o[k])}`);
    }
    return `{${parts.join(",")}}`;
  }
  if (typeof value === "number") {
    // -0 and 0 are the same figure to a reader; make them the same string.
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (value === undefined) return "null";
  return JSON.stringify(value);
}

/** The demographic facts every section's prose asserts, plus the months the
 *  whole plan is built on. */
function demoOf(b: FinancialBaseline) {
  const basis = b.cashflow_basis ?? null;
  return {
    age: b.age ?? null,
    dependents: b.dependents,
    marital_status: b.marital_status ?? null,
    retirement_age: b.retirement_age,
    years_to_retirement: b.years_to_retirement ?? null,
    household_mode: b.household_mode ?? false,
    // Not the derived figures — those already reach the fingerprint through
    // each module's det. This is the CHOICE, so that re-picking the same months
    // a different way still hashes the same.
    cashflow_basis: basis
      ? [basis.year, basis.from_month, basis.to_month]
      : null,
  };
}

/** The exact object that gets hashed. Exported for tests and for debugging a
 *  section that keeps going stale. */
export function fingerprintInput(
  sectionType: SectionType,
  det: unknown,
  b: FinancialBaseline,
): unknown {
  const line = BUDGET_LINE[sectionType];
  return {
    det: det ?? null,
    budget: line ? sectionBudgetContext(b, line) : null,
    demo: demoOf(b),
  };
}

async function sha256Hex(s: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function sectionFingerprint(
  sectionType: SectionType,
  det: unknown,
  b: FinancialBaseline,
): Promise<string> {
  return await sha256Hex(stableStringify(fingerprintInput(sectionType, det, b)));
}

/** Fingerprints for every section in one pass — what staleness.ts sweeps with. */
export async function allFingerprints(
  det: Partial<Record<SectionType, unknown>>,
  b: FinancialBaseline,
): Promise<Record<SectionType, string>> {
  const out = {} as Record<SectionType, string>;
  for (const s of SECTION_ORDER) {
    out[s] = await sectionFingerprint(s, det[s], b);
  }
  return out;
}
