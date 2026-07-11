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
    scenarios: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          trigger: { type: "STRING" },
          life_impact: { type: "STRING" },
          protection_response: { type: "STRING" },
        },
        required: ["title", "trigger", "life_impact", "protection_response"],
      },
    },
  },
  required: [
    "executive_summary",
    "coverage_review",
    "gap_analysis",
    "recommendations",
    "scenarios",
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
    marital_status: financials.client.marital_status,
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
    // Asset composition by type + value (no names) so scenarios can name the
    // real thing at stake — e.g. a property carrying a mortgage is the family
    // home that could face a forced sale.
    assets: financials.assets.map((a) => ({
      asset_type: a.asset_type,
      current_value: a.current_value,
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
    "3) gap_analysis — one flowing paragraph. Do NOT just restate that the",
    "   client is under-protected; translate each major gap into a concrete",
    "   real-life consequence grounded in THIS client's actual situation:",
    "   - if there is a property asset carrying a mortgage, treat it as the",
    "     family home — an unfunded life gap means the loan cannot be serviced",
    "     and the home the family lives in faces a forced sale / bank auction;",
    "   - with dependents, spell out the hit to their day-to-day living and",
    "     children's education if income stops;",
    "   - an insufficient critical-illness / income gap means a serious illness",
    "     ruptures household cash flow and erodes family wealth built over years.",
    "   Cite the relevant CNA gap figures inline.",
    "4) recommendations — 3 to 5 items {title, detail, priority (1 = highest)}.",
    "   Cite CNA gap figures for cover amounts; discuss premium budget only as a",
    "   share-of-income concept (current total is annual_premium_total, income is",
    "   cna.inputs.annual_income) without computing new numbers. Never recommend",
    "   any specific insurance product, plan or company.",
    "5) scenarios — 2 to 4 real-life 'what if' scenarios that make the impact",
    "   tangible (NOT cold numbers). Choose the ones that matter for this client",
    "   from: premature death, critical illness diagnosis, total & permanent",
    "   disability, prolonged hospitalisation. Each item has:",
    "   - title: short label (e.g. 'Premature Death', 'Critical Illness Diagnosis');",
    "   - trigger: one sentence on what happens;",
    "   - life_impact: the concrete consequence for THIS client's real assets,",
    "     debts and family — name the thing at stake (the mortgaged family home",
    "     facing auction, dependents losing their residence, children's education",
    "     interrupted, savings drained, income stopping). Be specific and human,",
    "     not generic;",
    "   - protection_response: how adequate cover changes the outcome, citing the",
    "     relevant CNA figure (e.g. an extra RM<gap> of life cover clears the",
    "     outstanding home loan so the family keeps their home).",
    "   Ground every scenario in the client context and CNA numbers; never invent",
    "   assets or amounts that are not in the data.",
    "",
    "Tone: professional and objective, but written so a layperson feels the",
    "real-world stakes. Plain English. This is a draft the advisor will edit.",
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
