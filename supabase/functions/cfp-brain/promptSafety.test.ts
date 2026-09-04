import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  isSensitiveKey,
  promptContext,
  promptJson,
  scrubPromptText,
} from "./promptSafety.ts";
import { computeAll } from "./orchestrator.ts";
import { ORDERED_MODULES } from "./modules/registry.ts";
import { makeCfpData } from "./baseline.test.ts";
import { buildChatPrompt, buildRevisePrompt } from "./chat.ts";
import type { CfpData, SectionType } from "./types.ts";

// ---------------------------------------------------------------------------
// The leak test.
//
// Every module builds an explicit whitelist for its prompt context, and today
// every one of them is written correctly. Nothing enforces that. Add a field to
// one context, or copy a module and forget its whitelist, and personal data
// reaches a third-party LLM with no error and no failing test.
//
// This test asks a different question from a whitelist review. A review asks
// "is this list right?"; this asks "did anything get out?" — so a new module, a
// new field, or a new cross-module summary is covered the day it is written,
// without anyone remembering to extend a list.
// ---------------------------------------------------------------------------

/**
 * Values that exist nowhere else in the fixture. Any one of them appearing in
 * a prompt is a leak, and the assertion message names which.
 */
const SENTINELS: Record<string, string> = {
  goal_name: "SENTINEL-GOAL-NAME",
  provider: "SENTINEL-INSURER",
  policy_number: "SENTINEL-POLICY-NO",
  nric_in_free_text: "901231-14-5678",
  email_in_free_text: "sentinel.person@example.com",
};

const NOW = new Date("2026-07-16T00:00:00Z");

/** A client whose every identifying field is a sentinel. */
function pollutedData(): CfpData {
  return makeCfpData({
    goals: [{
      id: "SENTINEL-GOAL-ID",
      goal_type: "education",
      name: SENTINELS.goal_name,
      target_amount: 100_000,
      target_year: 2036,
      current_saved: 5_000,
      monthly_contribution: 300,
      inflation_override: null,
      priority: 1,
    }],
    policies: [{
      policy_type: "life",
      provider: SENTINELS.provider,
      sum_assured: 250_000,
      premium: 3_600,
      premium_frequency: "annual",
      policy_number: SENTINELS.policy_number,
      cash_value: 12_000,
      start_date: "2018-03-01",
      end_date: null,
      policy_riders: [
        { category: "critical_illness", sum_assured: 100_000 },
        { category: "medical", sum_assured: null, room_board_daily: 250, annual_limit: 150_000 },
      ],
    }],
  });
}

const SECTION_TYPES: SectionType[] = [
  "cashflow_planning",
  "goals_planning",
  "insurance_planning",
  "investment_planning",
  "retirement_planning",
  "tax_planning",
  "legacy_planning",
  "financial_health",
];

function assertClean(prompt: string, where: string) {
  for (const [field, value] of Object.entries(SENTINELS)) {
    assert(
      !prompt.includes(value),
      `${where}: leaked ${field} ("${value}") into the prompt sent to the LLM`,
    );
  }
}

Deno.test("no module leaks an identifying field into its section prompt", () => {
  const f = pollutedData();
  const { baseline, det } = computeAll(ORDERED_MODULES, f, {}, NOW);

  const covered: SectionType[] = [];
  for (const m of ORDERED_MODULES) {
    const { prompt } = m.buildPrompt(det[m.section_type], baseline, f);
    assertClean(prompt, m.section_type);
    covered.push(m.section_type);
  }

  // The test is only as good as its coverage: a module that stops being
  // registered must fail here rather than silently drop out of the sweep.
  assertEquals(
    [...covered].sort(),
    [...SECTION_TYPES].sort(),
    "every registered section must be swept",
  );
});

Deno.test("no module leaks an identifying field into its chat prompt", () => {
  const f = pollutedData();
  const { baseline, det } = computeAll(ORDERED_MODULES, f, {}, NOW);

  for (const m of ORDERED_MODULES) {
    // The content the chat context is drawn from is the real assembled section,
    // which DOES carry provider and policy numbers by design — they belong in
    // the advisor's on-screen tables. The question is whether the chat
    // whitelist lets them through to the model.
    const content = m.assemble(
      det[m.section_type],
      stubFromSchema(m.buildPrompt(det[m.section_type], baseline, f).schema),
      f,
    );
    const context = m.chatContext
      ? m.chatContext(content)
      : m.clientViewInput
      ? m.clientViewInput(content)
      : {};
    const prompt = buildChatPrompt(
      m.section_type,
      m.agent,
      det[m.section_type],
      baseline,
      context,
      [{ role: "advisor", message: "why this recommendation?" }],
      "please explain",
    );
    assertClean(prompt, `${m.section_type} chat`);
  }
});

Deno.test("no module leaks an identifying field into a revise prompt", () => {
  const f = pollutedData();
  const { baseline, det } = computeAll(ORDERED_MODULES, f, {}, NOW);

  for (const m of ORDERED_MODULES) {
    const { prompt, schema } = m.buildPrompt(det[m.section_type], baseline, f);
    const content = m.assemble(det[m.section_type], stubFromSchema(schema), f);
    const context = m.chatContext?.(content) ?? m.clientViewInput?.(content) ?? {};
    assertClean(
      buildRevisePrompt(prompt, context, "make the tone warmer"),
      `${m.section_type} revise`,
    );
  }
});

Deno.test("free-text identifiers are scrubbed even when the key is innocent", () => {
  // Key filtering cannot help here: the key is "remarks", which is exactly the
  // sort of field an advisor pastes a NRIC or an email into.
  const prompt = promptJson({
    remarks: `client ${SENTINELS.nric_in_free_text}, reachable at ${SENTINELS.email_in_free_text}`,
  });
  assertClean(prompt, "free text");
  assert(prompt.includes("[REDACTED]"));
});

Deno.test("the scrub does NOT touch financial figures", () => {
  // This is why scrubPromptText is narrower than chat.ts's redactSensitive: a
  // RM 10,000,000 sum assured is an eight-digit run, and redacting it would
  // break the IRON RULE that the model receives every computed figure verbatim.
  const json = promptJson({ sum_assured: 10_000_000, capital_needed: 4_320_000 });
  assert(json.includes("10000000"), json);
  assert(json.includes("4320000"), json);
  assert(!json.includes("[REDACTED]"));
});

Deno.test("NRIC is caught with or without dashes", () => {
  assertEquals(scrubPromptText("ic 901231145678 here"), "ic [REDACTED] here");
  assertEquals(scrubPromptText("ic 901231-14-5678 here"), "ic [REDACTED] here");
});

// ---------------------------------------------------------------------------
// The key filter itself
// ---------------------------------------------------------------------------

Deno.test("identifying keys are dropped at any depth", () => {
  const out = promptContext({
    keep: 1,
    name: "x",
    nested: { policy_number: "y", provider: "z", sum_assured: 100 },
    list: [{ full_name: "a", amount: 5 }],
  });
  assertEquals(out, {
    keep: 1,
    nested: { sum_assured: 100 },
    list: [{ amount: 5 }],
  });
});

Deno.test("the caller's object is not mutated", () => {
  const original = { name: "x", amount: 1 };
  promptContext(original);
  assertEquals(original.name, "x");
});

Deno.test("key matching is case-insensitive and suffix-aware", () => {
  for (const k of ["Name", "FULL_NAME", "beneficiary_name", "epf_account_number", "home_address"]) {
    assert(isSensitiveKey(k), `${k} should be treated as identifying`);
  }
});

Deno.test("keys that merely contain a denied word are kept", () => {
  // number_of_dependants, name_count and the like are facts, not identifiers;
  // an over-eager filter that ate them would quietly degrade every narrative.
  for (const k of ["number_of_dependants", "policy_type", "provider_count", "nickname"]) {
    assertEquals(isSensitiveKey(k), false, k);
  }
});

Deno.test("nulls and primitives pass through untouched", () => {
  assertEquals(promptContext(null), null);
  assertEquals(promptContext(42), 42);
  assertEquals(promptContext("plain"), "plain");
  assertEquals(promptContext([1, null, "a"]), [1, null, "a"]);
});

/**
 * A minimal narrative that satisfies a module's own Gemini response schema.
 *
 * Derived from the schema rather than hand-written on purpose: a hand-written
 * stub goes stale the first time a module adds a narrative field, and this test
 * would then start failing for a reason that has nothing to do with PII —
 * which is how a safety test gets disabled.
 */
// deno-lint-ignore no-explicit-any
function stubFromSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return null;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  switch (schema.type) {
    case "OBJECT": {
      // deno-lint-ignore no-explicit-any
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(schema.properties ?? {})) {
        out[k] = stubFromSchema(v);
      }
      return out;
    }
    // One element, so array-shaped narrative fields are exercised rather than
    // skipped — an empty array would let a leaking map() go unnoticed.
    case "ARRAY":
      return [stubFromSchema(schema.items)];
    case "NUMBER":
    case "INTEGER":
      // 0 also happens to be the right value for the `index` fields that map a
      // commentary back onto the first goal / holding.
      return 0;
    case "BOOLEAN":
      return false;
    default:
      return "stub";
  }
}
