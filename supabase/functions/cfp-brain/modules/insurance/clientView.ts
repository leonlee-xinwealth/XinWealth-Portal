// LLM "simplify pass" for the Insurance Planning section. Takes the already-
// generated advisor prose (PII-free) plus the deterministic CNA numbers and
// rewrites everything into warm, plain, layman language in a target language,
// organized to feed a 3-part client PDF (Data Gathering → Finding →
// Recommendation). Mirrors section.ts: same Gemini model, structured output,
// retry/backoff, PII discipline, and the IRON RULE that the LLM must NEVER
// compute or alter any number — it only rephrases and quotes figures verbatim.

import type { CnaResult } from "../../../_shared/insurance/cna.ts";
import type { SectionNarrative } from "./assemble.ts";
import { callGeminiJson } from "../../../_shared/llm/gemini.ts";

/** Final layman-facing view. `version` and `language` are stamped in code;
 * every prose field is produced by the LLM from PII-free input. */
export interface ClientView {
  version: 1;
  language: "en" | "zh";
  data_gathering_intro: string;
  finding_intro: string;
  gap_analysis_plain: string;
  coverage_review_plain: Array<{ category: string; plain: string }>;
  scenarios_plain: Array<{ title: string; plain: string }>;
  recommendation_intro: string;
  recommendations_plain: Array<{ title: string; plain: string }>;
  glossary: Array<{ term: string; plain: string }>;
  disclaimer: string;
}

/** The prose the LLM returns — ClientView minus the code-stamped fields. */
type ClientViewProse = Omit<ClientView, "version" | "language">;

const CLIENT_VIEW_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    data_gathering_intro: { type: "STRING" },
    finding_intro: { type: "STRING" },
    gap_analysis_plain: { type: "STRING" },
    coverage_review_plain: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING" },
          plain: { type: "STRING" },
        },
        required: ["category", "plain"],
      },
    },
    scenarios_plain: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          plain: { type: "STRING" },
        },
        required: ["title", "plain"],
      },
    },
    recommendation_intro: { type: "STRING" },
    recommendations_plain: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          plain: { type: "STRING" },
        },
        required: ["title", "plain"],
      },
    },
    glossary: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          term: { type: "STRING" },
          plain: { type: "STRING" },
        },
        required: ["term", "plain"],
      },
    },
    disclaimer: { type: "STRING" },
  },
  required: [
    "data_gathering_intro",
    "finding_intro",
    "gap_analysis_plain",
    "coverage_review_plain",
    "scenarios_plain",
    "recommendation_intro",
    "recommendations_plain",
    "glossary",
    "disclaimer",
  ],
};

/** Builds the simplify-pass prompt. PII rule: only the whitelisted narrative
 * prose fields and the CNA numbers may appear — never a name, email, phone,
 * date_of_birth, provider, policy_number, or rider/product name. The base
 * narrative was already authored PII-free; we pick fields explicitly here so a
 * future identifying field on SectionNarrative cannot silently leak. Enforced
 * by clientView.test.ts sentinels. */
export function buildClientViewPrompt(
  narrative: SectionNarrative,
  cna: CnaResult,
  language: "en" | "zh",
): string {
  // Explicit whitelist — copy only non-identifying prose fields.
  const narrativePayload = {
    executive_summary: {
      findings: narrative.executive_summary.findings,
      action_plan: narrative.executive_summary.action_plan,
      remarks: narrative.executive_summary.remarks,
    },
    coverage_review: narrative.coverage_review.map((c) => ({
      category: c.category,
      level: c.level,
      commentary: c.commentary,
    })),
    gap_analysis: narrative.gap_analysis,
    recommendations: narrative.recommendations.map((r) => ({
      title: r.title,
      detail: r.detail,
      priority: r.priority,
    })),
    scenarios: narrative.scenarios.map((s) => ({
      title: s.title,
      trigger: s.trigger,
      life_impact: s.life_impact,
      protection_response: s.protection_response,
    })),
  };

  const coverageCount = narrativePayload.coverage_review.length;
  const scenarioCount = narrativePayload.scenarios.length;
  const recommendationCount = narrativePayload.recommendations.length;

  const languageInstruction = language === "zh"
    ? [
      "OUTPUT LANGUAGE: Simplified Chinese (简体中文). EVERY string in your JSON",
      "output — every intro, every plain field, every glossary term and",
      "definition, and the disclaimer — MUST be written in Simplified Chinese,",
      "for an ordinary Malaysian-Chinese layperson with no insurance knowledge.",
      "Warm, clear, everyday words. Do not output English prose except where a",
      "product term has no natural Chinese equivalent (then keep it short and",
      "explain it in the glossary). Amounts stay as-is (e.g. RM500,000).",
    ]
    : [
      "OUTPUT LANGUAGE: plain English. EVERY string in your JSON output MUST be",
      "written in simple, warm English for an ordinary layperson with no",
      "insurance knowledge. Short sentences, everyday words, no jargon except",
      "where the glossary defines it.",
    ];

  return [
    "You are helping a licensed Malaysian financial advisor turn a technical",
    "insurance review into a friendly, easy-to-read summary FOR THE CLIENT",
    "themselves — an ordinary member of the public, not a finance professional.",
    'Refer to the reader warmly as "you"/"your" (在中文里用「您」). Refer to any',
    "other person only in general terms. Never invent or use any name.",
    "",
    "IRON RULE: Every monetary amount below is final, computed by deterministic",
    "code. Quote amounts verbatim (thousand separators allowed). NEVER compute,",
    "modify, infer, or invent any amount. If a figure is not in the input below,",
    "do not state a figure — describe it in words instead.",
    "",
    "PRIVACY: The input is already free of personal details. Do NOT add any",
    "names, companies, product names, policy numbers, dates or contact details —",
    "you have none, and must not invent any.",
    "",
    ...languageInstruction,
    "",
    "The summary supports a 3-part client PDF:",
    "  Part 1 — Data Gathering: the information we collected about you & your policies.",
    "  Part 2 — Finding: what we found — your protection health-check.",
    "  Part 3 — Recommendation: what we suggest doing next.",
    "",
    "Produce this JSON:",
    "1) data_gathering_intro — ONE short, warm plain paragraph introducing Part 1,",
    '   in the first person plural ("we gathered ..."). No numbers required.',
    "2) finding_intro — ONE short plain paragraph introducing Part 2 (your",
    "   protection health-check). Reassuring, not alarming. No numbers required.",
    "3) gap_analysis_plain — rewrite the gap_analysis in plain, warm, non-jargon",
    "   language. KEEP the real-life consequences (what it would mean for your",
    "   family, home and everyday life). Quote any gap figure verbatim from the",
    "   input; never recompute one.",
    `4) coverage_review_plain — EXACTLY ${coverageCount} item(s), ONE per input`,
    "   coverage_review entry, in the SAME ORDER. Reuse the SAME category value",
    "   verbatim. Rewrite the commentary into one plain sentence or two (<= 60",
    "   words) an ordinary person understands.",
    `5) scenarios_plain — EXACTLY ${scenarioCount} item(s), ONE per input scenario,`,
    "   in the SAME ORDER. Reuse the input title (you may simplify the wording).",
    "   For `plain`, merge that scenario's trigger + life_impact +",
    "   protection_response into 2-4 warm, human sentences the reader can FEEL —",
    "   what happens, what it would mean for your family/home, and how the right",
    "   cover changes the outcome. Quote the relevant figure verbatim if the",
    "   scenario cites one.",
    "6) recommendation_intro — ONE short plain paragraph introducing Part 3,",
    "   encouraging and non-pushy. No numbers required.",
    `7) recommendations_plain — EXACTLY ${recommendationCount} item(s), ONE per`,
    "   input recommendation, in the SAME ORDER. `title` may be simplified into",
    "   plain words. `plain` rewrites the detail plainly and ties it to",
    "   protecting your family and your goals. Quote cover figures verbatim; do",
    "   NOT name any specific product, plan or company.",
    "8) glossary — 4 to 8 jargon terms that actually appear in this report (e.g.",
    "   Sum Assured, Critical Illness, CNA / Capital Need Analysis, Premium,",
    "   Rider). Each: {term, plain} where plain is a single friendly sentence a",
    "   layperson understands.",
    "9) disclaimer — 1-2 plain sentences: this is a general protection review, not",
    "   personalised investment advice, and the figures are estimates based on the",
    "   information you provided.",
    "",
    "Tone: warm, plain, encouraging, jargon-free. Preserve every number exactly;",
    "leak zero personal data; keep all output in the requested language.",
    "",
    "Advisor narrative (source prose — rephrase, do not copy verbatim):",
    JSON.stringify(narrativePayload),
    "",
    "CNA JSON (sole source of numbers — quote verbatim, never recompute):",
    JSON.stringify(cna),
  ].join("\n");
}

/** Generate the layman client view; retries twice, throws on final failure.
 * `version` and `language` are stamped here — the LLM never sets them. */
export async function generateClientView(
  narrative: SectionNarrative,
  cna: CnaResult,
  language: "en" | "zh",
  apiKey: string,
): Promise<ClientView> {
  const prose = await callGeminiJson<ClientViewProse>(
    buildClientViewPrompt(narrative, cna, language),
    CLIENT_VIEW_RESPONSE_SCHEMA,
    apiKey,
  );
  return { version: 1, language, ...prose };
}
