// LLM narrative for the CFP Insurance Planning section (English — matches the
// advisor's report template). Provider-abstracted: phase uses Gemini free
// tier; swap generateSectionNarrative's implementation to move to Claude.
// The LLM narrates deterministic CNA numbers — it must never compute them.

import type { CnaResult } from "./cna.ts";
import type { CfpFinancials } from "./mapping.ts";
import { annualPremiumTotal } from "./mapping.ts";
import type { SectionNarrative } from "./assemble.ts";

// flash-lite has separate (and roomier) free-tier quota than flash — the
// funnel engine's extraction step already relies on it staying available.
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const COVERAGE_CATEGORIES = [
  "life",
  "critical_illness",
  "medical",
  "accident",
  "disability_income",
  "savings_retirement",
];

const SECTION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    executive_summary: {
      type: "OBJECT",
      properties: {
        findings: { type: "STRING" },
        action_plan: { type: "STRING" },
        expected_completion_date: { type: "STRING" },
        remarks: { type: "STRING" },
      },
      required: ["findings", "action_plan", "expected_completion_date", "remarks"],
    },
    coverage_review: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING", enum: COVERAGE_CATEGORIES },
          level: {
            type: "STRING",
            enum: ["adequate", "fair", "insufficient", "none", "unknown"],
          },
          commentary: { type: "STRING" },
        },
        required: ["category", "level", "commentary"],
      },
    },
    gap_analysis: { type: "STRING" },
    recommendations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          detail: { type: "STRING" },
          priority: { type: "INTEGER" },
        },
        required: ["title", "detail", "priority"],
      },
    },
    death_scenario_note: { type: "STRING" },
  },
  required: [
    "executive_summary",
    "coverage_review",
    "gap_analysis",
    "recommendations",
    "death_scenario_note",
  ],
};

/** Builds the LLM prompt. PII rule: only the whitelisted, non-identifying
 * fields below may appear — no name/NRIC/email/phone/DOB/provider/
 * policy_number/free-text labels. Enforced by section.test.ts sentinels. */
export function buildSectionPrompt(
  cna: CnaResult,
  financials: CfpFinancials,
): string {
  const age = financials.client.date_of_birth
    ? Math.floor(
      (Date.now() - new Date(financials.client.date_of_birth).getTime()) /
        (365.25 * 24 * 3600 * 1000),
    )
    : null;
  const clientContext = {
    age,
    occupation: financials.client.occupation,
    dependents: financials.client.number_of_dependants,
    retirement_age: financials.client.retirement_age,
    annual_premium_total: annualPremiumTotal(financials.policies),
    policies: financials.policies.map((p) => ({
      policy_type: p.policy_type,
      sum_assured: p.sum_assured,
      premium: p.premium,
      premium_frequency: p.premium_frequency,
    })),
    liabilities: financials.liabilities.map((l) => ({
      liability_type: l.liability_type,
      outstanding_balance: l.outstanding_balance,
    })),
  };
  return [
    "You are the analysis assistant of a licensed financial advisor in Malaysia,",
    "drafting the Insurance Planning section of a comprehensive financial plan.",
    "The client has provided full financial data. Refer to the client only as",
    '"the client" — never invent or use any name.',
    "",
    "IRON RULE: every amount in the CNA JSON below is a final number computed",
    "by deterministic code. You must NOT compute, modify, or infer any amount.",
    "When citing amounts, quote CNA figures verbatim (thousand separators allowed).",
    "",
    "Tasks:",
    "1) executive_summary — one row for the report's EXECUTIVE SUMMARY table:",
    "   findings (2-3 sentences, current insurance position incl. key gap figures),",
    '   action_plan (concrete next steps), expected_completion_date (a timeframe',
    '   phrase such as "Within 3 months" — the advisor will adjust), remarks.',
    "2) coverage_review — one entry per category (life, critical_illness, medical,",
    "   accident, disability_income, savings_retirement). level is one of",
    "   adequate/fair/insufficient/none/unknown; commentary ≤ 80 words. life and",
    "   critical_illness MUST cite the CNA need/covered/gap figures. Categories",
    "   with no data get level unknown.",
    "3) gap_analysis — one paragraph synthesising the protection gaps against the",
    "   client's age, dependents and liabilities.",
    "4) recommendations — 3 to 5 items {title, detail, priority (1 = highest)}.",
    "   Cite CNA gap figures for cover amounts; discuss premium budget only as a",
    "   share-of-income concept (current total is annual_premium_total, income is",
    "   cna.inputs.annual_income) without computing new numbers. Never recommend",
    "   any specific insurance product, plan or company.",
    "5) death_scenario_note — 2-3 sentences: existing cover plus liquid assets",
    "   versus total need, using CNA numbers only.",
    "",
    "Tone: professional, objective, plain English. This is a draft the advisor",
    "will review and edit.",
    "",
    "Client context JSON:",
    JSON.stringify(clientContext),
    "",
    "CNA JSON (sole source of numbers):",
    JSON.stringify(cna),
  ].join("\n");
}

async function callGemini(
  prompt: string,
  apiKey: string,
): Promise<SectionNarrative> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SECTION_RESPONSE_SCHEMA,
        temperature: 0.3,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(
      `Gemini empty response, finishReason=${
        j.candidates?.[0]?.finishReason ?? "n/a"
      }`,
    );
  }
  return JSON.parse(text) as SectionNarrative;
}

/** Generate the section narrative; retries twice, throws on final failure. */
export async function generateSectionNarrative(
  cna: CnaResult,
  financials: CfpFinancials,
  apiKey: string,
): Promise<SectionNarrative> {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const prompt = buildSectionPrompt(cna, financials);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callGemini(prompt, apiKey);
    } catch (e) {
      lastErr = e;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
