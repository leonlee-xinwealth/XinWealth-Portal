// LLM narrative for the CFP Insurance Planning section (English — matches the
// advisor's report template). Provider-abstracted: phase uses Gemini free
// tier; swap generateSectionNarrative's implementation to move to Claude.
// The LLM narrates deterministic CNA numbers — it must never compute them.

import type { CnaResult } from "../../../_shared/insurance/cna.ts";
import type { CfpFinancials } from "../../../_shared/insurance/mapping.ts";
import { annualPremiumTotal } from "../../../_shared/insurance/mapping.ts";
import type { SectionNarrative } from "./assemble.ts";
import { callGeminiJson } from "../../../_shared/llm/gemini.ts";
import {
  budgetInstructionLines,
  type SectionBudgetContext,
} from "../../budgetContext.ts";
import { promptJson } from "../../promptSafety.ts";
import {
  consequenceInstructionLines,
  consequenceSchema,
  severityInstructionLines,
  severitySchema,
  solutionInstructionLines,
  solutionSchema,
} from "../../narrativeBlocks.ts";

/**
 * The CNA's own gap keys — NOT COVERAGE_CATEGORIES, which are the four review
 * categories the narrative writes commentary for. The consequence card's
 * headline_key is used to look a GAP up in cna.gaps, so it has to be drawn from
 * that list: "critical_illness" would be a perfectly valid coverage category
 * and a lookup miss, printing a headline with no figure beside it.
 * See CnaGap in _shared/insurance/cna.ts, and the PDF's mirror in
 * pdf/cfpReport/select/insurance.ts.
 */
export const CNA_GAP_KEYS = ["life", "ci", "medical"] as const;

const COVERAGE_CATEGORIES = [
  "life",
  "critical_illness",
  "medical",
  "accident",
];

export const SECTION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    executive_summary: {
      type: "OBJECT",
      properties: {
        findings: { type: "STRING" },
        action_plan: { type: "STRING" },
        expected_completion_date: { type: "STRING" },
        remarks: { type: "STRING" },
        severity: severitySchema(),
      },
      required: [
        "findings",
        "action_plan",
        "expected_completion_date",
        "remarks",
        "severity",
      ],
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
    // Joint reports only — omitted by the model on individual plans.
    household_review: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          role: { type: "STRING", enum: ["primary", "partner"] },
          commentary: { type: "STRING" },
        },
        required: ["role", "commentary"],
      },
    },
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
    consequences: consequenceSchema([...CNA_GAP_KEYS]),
    solution: solutionSchema(),
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
    "consequences",
    "solution",
  ],
};

/** Builds the LLM prompt. PII rule: only the whitelisted, non-identifying
 * fields below may appear — no name/NRIC/email/phone/DOB/provider/
 * policy_number/free-text labels. Enforced by section.test.ts sentinels. */
/** Joint report: one CNA per spouse. Roles only — never names (PII rule). */
export interface HouseholdCnaContext {
  per_person: Array<{ role: "primary" | "partner"; cna: CnaResult }>;
}

export function buildSectionPrompt(
  cna: CnaResult,
  financials: CfpFinancials,
  budgetContext: SectionBudgetContext | null = null,
  household: HouseholdCnaContext | null = null,
  /**
   * The client's age, from the baseline.
   *
   * This used to be derived here from financials.client.date_of_birth, which
   * meant a birth date — an identity document field, and one of the strongest
   * identifiers a client has — crossed into the module that talks to the LLM
   * purely so it could be divided by 365.25. The prompt only ever needed the
   * age, and computeBaseline already has it. Passing the answer instead of the
   * raw fact also removes a second, independently-drifting age calculation.
   */
  age: number | null = null,
): string {
  const clientContext = {
    age,
    occupation: financials.client.occupation,
    marital_status: financials.client.marital_status,
    dependents: financials.client.number_of_dependants,
    retirement_age: financials.client.retirement_age,
    annual_premium_total: annualPremiumTotal(financials.policies),
    // policy_type is the BASE plan's benefit (usually death/TPD). Riders carry
    // the rest of the coverage by category — non-identifying fields only (no
    // rider/product names) so this stays within the PII discipline.
    policies: financials.policies.map((p) => ({
      policy_type: p.policy_type,
      sum_assured: p.sum_assured,
      premium: p.premium,
      premium_frequency: p.premium_frequency,
      riders: (p.policy_riders ?? []).map((r) => ({
        category: r.category,
        sum_assured: r.sum_assured,
        room_board_daily: r.room_board_daily,
        annual_limit: r.annual_limit,
      })),
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
    "   accident). level is one of adequate/fair/insufficient/none/unknown;",
    "   commentary ≤ 80 words. Attribute coverage from BOTH the base policy_type",
    "   AND its riders[] (each rider's category maps to a review category:",
    "   critical_illness/cancer→critical_illness, medical→medical, accident→accident).",
    "   A category with a matching rider or base policy is NOT none. life and",
    "   critical_illness MUST cite the CNA need/covered/gap figures. Only categories",
    "   with no base policy and no rider get level unknown.",
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
    ...consequenceInstructionLines("protection gap", [...CNA_GAP_KEYS]),
    ...solutionInstructionLines("protection"),
    ...severityInstructionLines(),
    "",
    ...budgetInstructionLines("protection top-up"),
    "- Protection sits FIRST in the priority order: downside risk is secured",
    "  before any upside planning, so lead your recommendations with the",
    "  allocated protection budget as the plan's first call on surplus.",
    "",
    ...(household
      ? [
        "",
        "THIS IS A JOINT PLAN FOR A MARRIED COUPLE. Refer to them as",
        '"the client" (primary) and "the spouse" (partner) — never invent names.',
        "The client context above (income, assets, liabilities, dependants) is the",
        "COMBINED household position. Protection need, however, is per life: the",
        "household CNA JSON below holds a separate CNA for each of them, each",
        "computed against their OWN income and OWN policies but the SAME household",
        "liabilities and dependants.",
        "6) household_review — exactly one entry per role (primary, partner),",
        "   commentary ≤ 100 words, citing that person's own CNA need/covered/gap",
        "   figures. State plainly whose protection is the weaker of the two.",
        "   coverage_review, gap_analysis, recommendations and scenarios must cover",
        "   the household as a whole and make clear which spouse each gap belongs to.",
        "",
        "Household CNA JSON (per-life, sole source of per-person numbers):",
        promptJson(household.per_person),
      ]
      : []),
    "",
    "Tone: professional and objective, but written so a layperson feels the",
    "real-world stakes. Plain English. This is a draft the advisor will edit.",
    "",
    "Client context JSON:",
    promptJson({ ...clientContext, budget_context: budgetContext }),
    "",
    "CNA JSON (sole source of numbers):",
    promptJson(cna),
  ].join("\n");
}

/** Generate the section narrative; retries twice, throws on final failure. */
export function generateSectionNarrative(
  cna: CnaResult,
  financials: CfpFinancials,
  apiKey: string,
): Promise<SectionNarrative> {
  return callGeminiJson<SectionNarrative>(
    buildSectionPrompt(cna, financials),
    SECTION_RESPONSE_SCHEMA,
    apiKey,
  );
}
