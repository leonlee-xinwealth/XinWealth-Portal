// The second net under the prompt whitelists.
//
// Today every module builds an explicit `context` object listing the fields it
// wants the model to see, and every one of them is written correctly. That is
// seven hand-maintained whitelists, and nothing enforces them: add one field to
// one context, or copy an existing module to start a new one and forget the
// whitelist, and personal data flows to a third-party LLM with no test failing
// and no error logged. The whitelists stay — they are the primary control, and
// they are what keeps the prompt small and on-topic. This file is what catches
// the mistake when someone gets one wrong.
//
// Two mechanisms, both deliberately blunt:
//
//   promptContext()   drops known-identifying keys anywhere in a structure,
//                     however deep, before it is serialised into a prompt.
//
//   scrubPromptText() a last pass over the assembled string for patterns that
//                     cannot be anything but PII.
//
// What scrubPromptText does NOT do is worth stating: it does not redact long
// digit runs. `redactSensitive` in chat.ts does, and that is right for advisor
// free text — but applied to an assembled prompt it would turn a RM 10,000,000
// sum assured into [REDACTED] and break the IRON RULE that the model receives
// every deterministic figure verbatim. Only patterns that cannot collide with a
// financial figure belong here.

/** Exact key names that never belong in a prompt, compared case-insensitively. */
export const DENY_KEYS: readonly string[] = [
  "name",
  "full_name",
  "first_name",
  "last_name",
  "display_name",
  "email",
  "phone",
  "mobile",
  "nric",
  "ic",
  "ic_number",
  "identity_number",
  "passport",
  "address",
  "date_of_birth",
  "dob",
  "policy_number",
  "account_number",
  "provider",
  "insurer",
];

/**
 * Key suffixes that carry the same meaning as the exact names above.
 *
 * `_name` is broad on purpose. Advisor-entered labels — a goal called
 * "Ah Boy 的教育金", an asset called "Mum's ASB" — are free text that regularly
 * carries a real person's name, and no module's narrative needs them: the
 * prompts already instruct the model to refer to goals by type and year.
 */
export const DENY_SUFFIXES: readonly string[] = [
  "_name",
  "_email",
  "_phone",
  "_nric",
  "_number",
  "_address",
];

/**
 * Suffix exceptions, for a key that ends in a denied suffix but is plainly a
 * numeric fact. Empty today, and it should stay that way: every entry is a hole
 * in the net and has to be obviously safe on its own.
 */
const SUFFIX_ALLOW: readonly string[] = [];

export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  if (SUFFIX_ALLOW.includes(k)) return false;
  if (DENY_KEYS.includes(k)) return true;
  return DENY_SUFFIXES.some((suffix) => k.endsWith(suffix));
}

/**
 * Deep-copy `value` with every identifying key removed at any depth.
 *
 * Returns a new structure; the caller's object is untouched, so this is safe to
 * apply to `det` on the way into a prompt without affecting what gets assembled
 * into the section's stored content.
 */
export function promptContext<T>(value: T): T {
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(strip);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(k)) continue;
    out[k] = strip(v);
  }
  return out;
}

/** Malaysian NRIC, with or without dashes, and anything shaped like an email. */
const NRIC = /\b\d{6}-?\d{2}-?\d{4}\b/g;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Final sweep over an assembled prompt.
 *
 * Catches identifiers that arrived as VALUES rather than under a known key —
 * a NRIC typed into a goal's notes, an email pasted into planning_inputs. Key
 * filtering cannot see those, because the key ("notes") is perfectly innocent.
 */
export function scrubPromptText(prompt: string): string {
  return prompt.replace(NRIC, "[REDACTED]").replace(EMAIL, "[REDACTED]");
}

/**
 * Serialise a context object straight into a prompt: strip identifying keys,
 * then scrub what is left. The single call every buildPrompt should use in
 * place of a bare JSON.stringify.
 */
export function promptJson(value: unknown): string {
  return scrubPromptText(JSON.stringify(promptContext(value)));
}
