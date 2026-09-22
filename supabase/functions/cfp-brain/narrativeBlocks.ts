// The report template's named narrative slots.
//
// The 29-page report argues each module in the same three beats: what is wrong
// (后果卡), what to do about it (方案卡), and how urgent it is (严重度). Those
// are page-level slots, not free prose, so they get a shared shape and shared
// instructions here rather than eight near-identical schema blocks that drift
// apart — the same reasoning that produced budgetContext.ts.
//
// COMPLIANCE, and why the shape is what it is:
//
// The model never emits an amount. A consequence card names WHICH gap leads
// (`headline_key`, an enum the module supplies) and writes the prose around it;
// the PDF looks the figure up in `det` and formats it. So the numbers on the
// page are the same deterministic numbers as everywhere else in the report,
// and no rounding, restating or hallucinating can get between them and the
// client. This is a licensing requirement first and a correctness one second.
//
// Every slot is OPTIONAL in the assembled content. Sections generated before
// these existed simply lack the keys, and the PDF skips the card rather than
// printing an empty box — no migration, no backfill.

/** Consequence and solution cards share one shape. */
export interface NarrativeCard {
  headline: string;
  body: string;
  bullets: string[];
}

/**
 * A consequence card additionally names which of the module's own gaps it is
 * leading with, so the PDF can print that gap's figure beside the prose.
 * The allowed values are the module's keys — see each section's prompt.
 */
export interface ConsequenceCard extends NarrativeCard {
  headline_key: string | null;
}

/** How loudly the executive summary should flag this section. */
export type Severity = "critical" | "attention" | "on_track";

export const SEVERITY_VALUES: Severity[] = ["critical", "attention", "on_track"];

const CARD_PROPERTIES = {
  headline: { type: "STRING" },
  body: { type: "STRING" },
  bullets: { type: "ARRAY", items: { type: "STRING" } },
};

/** Gemini schema fragment for a solution card. */
export function solutionSchema() {
  return {
    type: "OBJECT",
    properties: { ...CARD_PROPERTIES },
    required: ["headline", "body", "bullets"],
  };
}

/**
 * Gemini schema fragment for a consequence card. `keys` are the module's own
 * gap identifiers; constraining them to an enum is what keeps the PDF's lookup
 * total — an invented key would render as a missing figure.
 */
export function consequenceSchema(keys: string[]) {
  return {
    type: "OBJECT",
    properties: {
      ...CARD_PROPERTIES,
      headline_key: { type: "STRING", enum: keys },
    },
    required: ["headline", "body", "bullets", "headline_key"],
  };
}

export function severitySchema() {
  return { type: "STRING", enum: SEVERITY_VALUES };
}

/**
 * Prompt instructions for a consequence card.
 *
 * `subject` names what the gap is about ("保障缺口", "传承安排"), and `keys`
 * must match the enum passed to consequenceSchema.
 */
export function consequenceInstructionLines(subject: string, keys: string[]): string[] {
  return [
    "",
    `CONSEQUENCE CARD (\`consequences\`) — the report devotes a full page to what`,
    `happens if the ${subject} is left as it is. Write it as consequence, not as`,
    "description:",
    `- headline_key: which single gap leads the page. One of: ${keys.join(", ")}.`,
    "  Choose the one with the largest real-world consequence, not simply the",
    "  largest number.",
    "- headline: ≤ 14 words naming that consequence in plain words. NO amounts —",
    "  the report prints the figure itself next to your headline, and a number",
    "  written here would appear twice and could disagree.",
    "- body: 2–3 sentences grounded in THIS client's actual situation (the",
    "  mortgage on the home they live in, the children still in school, the",
    "  income that stops). Not a restatement that a gap exists.",
    "- bullets: exactly 3 concrete downstream effects, one line each.",
    "- You may refer to figures that appear in the JSON above, but never compute,",
    "  adjust or invent one.",
  ];
}

/** Prompt instructions for a solution card. */
export function solutionInstructionLines(subject: string): string[] {
  return [
    "",
    "SOLUTION CARD (`solution`) — the page facing the consequence card. It has",
    "to read as the answer to it:",
    `- headline: ≤ 12 words stating the single ${subject} action.`,
    "- body: 2–3 sentences on what changes once it is done, and what it costs.",
    "  Must respect this_section.allocated_annual from budget_context.",
    "- bullets: exactly 3 execution steps in the order they happen.",
    "- Deterministic figures only, quoted verbatim from the JSON above.",
  ];
}

/** Prompt instructions for the executive-summary severity dot. */
export function severityInstructionLines(): string[] {
  return [
    "",
    "SEVERITY (`executive_summary.severity`) — one word driving a status dot on",
    "the report's executive summary page:",
    '- "critical" — a gap that would materially damage the client if it is not',
    "  addressed this year;",
    '- "attention" — off target but not urgent;',
    '- "on_track" — meets the benchmark; no action needed beyond review.',
    "Judge the client's position, not the length of your recommendation list.",
  ];
}
