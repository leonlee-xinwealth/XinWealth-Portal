// 传承顾问 (legacy_advisor) — prompt, response schema, assembly.
// PII whitelist: amounts, ratios, distribution shares/labels and demographics
// only — no names, institutions or account details ever reach the LLM.

import type { CfpData, CfpModule, FinancialBaseline } from "../../types.ts";
import { computeLegacy, type LegacyDet } from "./calc.ts";

export interface LegacyNarrative {
  executive_summary: {
    findings: string;
    action_plan: string;
    expected_completion_date: string;
    remarks: string;
  };
  estate_review: string;
  readiness: string;
  recommendations: Array<{ title: string; detail: string; priority: number }>;
}

export interface LegacySectionContent extends LegacyNarrative, LegacyDet {
  version: 1;
  section_type: "legacy_planning";
  agent: "asset_expert";
  assumptions: string[];
}

const RESPONSE_SCHEMA = {
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
      required: [
        "findings",
        "action_plan",
        "expected_completion_date",
        "remarks",
      ],
    },
    estate_review: { type: "STRING" },
    readiness: { type: "STRING" },
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
  },
  required: [
    "executive_summary",
    "estate_review",
    "readiness",
    "recommendations",
  ],
};

export function buildLegacyPrompt(
  det: LegacyDet,
  b: FinancialBaseline,
): string {
  const context = {
    age: b.age,
    marital_status: b.marital_status,
    dependents: b.dependents,
    legacy: det,
  };
  return [
    "You are the analysis assistant of a licensed financial advisor in Malaysia,",
    "drafting the Legacy & Estate Planning section of a comprehensive financial",
    'plan. Refer to the client only as "the client" — never invent any name,',
    "institution, or account number.",
    "",
    "IRON RULE: every amount in the JSON below is a final number computed by",
    "deterministic code. You must NOT compute, modify, or infer any amount, and",
    "you must NEVER state a specific faraid (Syariah inheritance) share — that",
    "figure does not exist in the JSON on purpose and must come only from a",
    "qualified Syariah authority.",
    "",
    "IMPORTANT CONTEXT: Malaysia has no estate duty / inheritance tax. This",
    "section is about estate LIQUIDITY (can debts and costs be settled without",
    "forcing a sale of assets) and DISTRIBUTION readiness — never frame it as",
    "a tax topic.",
    "",
    "Tasks:",
    "1) executive_summary — one row for the report's EXECUTIVE SUMMARY table:",
    "   findings (2-3 sentences: net estate, the liquidity verdict, and",
    "   will/nomination readiness), action_plan (concrete next steps),",
    '   expected_completion_date (a timeframe phrase such as "Within 6',
    '   months"), remarks.',
    "2) estate_review — one flowing paragraph covering: the net estate figure,",
    "   and the liquidity verdict translated into real-life terms. If",
    "   legacy.estate_liquidity.status is 'shortfall', explain plainly that",
    "   without action the family may be forced to sell assets — potentially",
    "   including the family home — during probate just to settle debts and",
    "   settlement costs, and quote the shortfall figure verbatim. If",
    "   'covered', affirm that obligations can be met without a forced sale.",
    "3) readiness — one paragraph on will status and nominations. If will_status",
    "   is not 'has_will', explain the practical cost of dying intestate",
    "   (delays, court process, distribution outside the client's control). If",
    "   nominations.epf or nominations.insurance is false or null, explain",
    "   plainly that EPF savings without a valid nomination go through a slower",
    "   administration process before dependents can access them. If",
    "   legacy.distribution.faraid_flagged is true, state clearly that the",
    "   estate will follow faraid (Islamic inheritance law) and suggest the",
    "   client discuss hibah (lifetime gift) or wasiat (Islamic will) options",
    "   with a qualified Syariah advisor — you must NOT state any specific",
    "   faraid share or fraction anywhere in this section.",
    "4) recommendations — 2 to 4 items {title, detail, priority (1 = highest)}.",
    "   Choose from, and ground in this client's data: make or update a will,",
    "   complete EPF/insurance nominations, review life cover as a source of",
    "   estate liquidity, and — only when legacy.trust_consideration is true —",
    "   consider a trust structure for dependents. Never recommend a specific",
    "   financial product, institution, or law firm.",
    "",
    "If legacy.asset_isolation_flag is true, add a qualitative note (no share",
    "or amount computation) describing policy absolute assignment (保单绝对转让)",
    "and trust structures as creditor-isolation tools available to business",
    "owners, and recommend the client seek legal advice — never phrase this as",
    "a directive to take a specific action.",
    "",
    "If legacy.insufficient_data is true, say plainly that asset records are",
    "missing and the priority is completing the data before any estate",
    "liquidity verdict can be relied on.",
    "",
    "Tone: professional, plain English, written so a layperson feels the",
    "real-world stakes. This is a draft the advisor will edit.",
    "",
    "Client legacy JSON (sole source of numbers):",
    JSON.stringify(context),
  ].join("\n");
}

export const legacyModule: CfpModule<
  LegacyDet,
  LegacyNarrative,
  LegacySectionContent
> = {
  section_type: "legacy_planning",
  agent: "asset_expert",
  compute: (f: CfpData, b: FinancialBaseline, _prior, inputs) =>
    computeLegacy(f, b, inputs?.estate ?? {}),
  buildPrompt: (det, b) => ({
    prompt: buildLegacyPrompt(det, b),
    schema: RESPONSE_SCHEMA,
  }),
  assemble: (det, narrative, _f) => ({
    version: 1,
    section_type: "legacy_planning",
    agent: "asset_expert",
    ...det,
    ...narrative,
    assumptions: [
      "遗产清算费用按总资产 5% 估算",
      "分配法定份额为 1958 年分配法令简化示意（假设无在世父母），实际以法律意见为准",
      "回教徒遗产受 faraid 约束，本报告不计算份额",
    ],
  }),
  clientViewInput: (content) => ({
    life_cover_total: content.life_cover_total,
    net_estate: content.net_estate,
    estate_obligations: content.estate_obligations,
    estate_liquidity: content.estate_liquidity,
    distribution: content.distribution,
    nominations: content.nominations,
    trust_consideration: content.trust_consideration,
    asset_isolation_flag: content.asset_isolation_flag,
    estate_review: content.estate_review,
    readiness: content.readiness,
    recommendations: content.recommendations,
  }),
};
