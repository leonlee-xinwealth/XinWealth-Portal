// 税务师 (tax_strategist) — prompt, response schema, assembly.
// PII whitelist: amounts, ratios, relief labels/keys and demographics only —
// no names, institutions or account details ever reach the LLM.

import type { CfpData, CfpModule, FinancialBaseline } from "../../types.ts";
import { computeTax, type TaxDet } from "./calc.ts";

export interface TaxNarrative {
  executive_summary: {
    findings: string;
    action_plan: string;
    expected_completion_date: string;
    remarks: string;
  };
  tax_position: string;
  optimization: string;
  recommendations: Array<{ title: string; detail: string; priority: number }>;
}

export interface TaxSectionContent extends TaxNarrative, TaxDet {
  version: 1;
  section_type: "tax_planning";
  agent: "tax_expert";
  assumptions: string[];
  disclaimer: string;
}

const DISCLAIMER =
  "本节为一般性税务信息，并非税务代理意见；实际申报以 LHDN 规定及您的税务代理确认为准。";

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
    tax_position: { type: "STRING" },
    optimization: { type: "STRING" },
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
    "tax_position",
    "optimization",
    "recommendations",
  ],
};

export function buildTaxPrompt(
  det: TaxDet,
  b: FinancialBaseline,
  f: CfpData,
): string {
  const context = {
    age: b.age,
    marital_status: b.marital_status,
    dependents: b.dependents,
    employment_status: f.client.employment_status,
    tax: det,
  };
  return [
    "You are the analysis assistant of a licensed financial advisor in Malaysia,",
    "drafting the Tax Planning section of a comprehensive financial plan. Refer",
    'to the client only as "the client" — never invent any name, institution,',
    "or account number.",
    "",
    "IRON RULE: every amount in the JSON below is a final number computed by",
    "deterministic code. You must NOT compute, modify, or infer any amount.",
    "When citing amounts, quote figures verbatim (thousand separators allowed).",
    "",
    "Tasks:",
    "1) executive_summary — one row for the report's EXECUTIVE SUMMARY table:",
    "   findings (2-3 sentences: estimated income, reliefs claimed, chargeable",
    "   income, estimated tax payable, marginal vs effective rate), action_plan",
    "   (concrete next steps), expected_completion_date (a timeframe phrase such",
    '   as "Before year-end"), remarks.',
    "2) tax_position — one flowing paragraph in plain words covering: employment",
    "   income estimate, reliefs already claimed and the chargeable income that",
    "   results, the estimated tax payable, and what the marginal rate vs the",
    "   effective rate means for the client (marginal = rate on the next ringgit",
    "   earned; effective = overall rate paid). Cite the actual figures from the",
    "   JSON verbatim.",
    "3) optimization — one paragraph walking through tax.optimization_opportunities:",
    "   for each opportunity, explain what topping up that relief (by",
    "   additional_claimable) would legally save (quote est_tax_saving verbatim).",
    '   Frame this strictly as making full use of legal reliefs under LHDN rules',
    '   — never use the word "avoidance" or suggest anything outside official',
    "   reliefs. If tax.optimization_opportunities is empty, say plainly that no",
    "   further relief headroom was identified (or that reliefs are not",
    "   applicable, e.g. for a non-resident) and reinforce that this section is",
    "   general information, not tax agent advice.",
    "4) recommendations — 2 to 4 items {title, detail, priority (1 = highest)}.",
    "   Practical, LHDN-relief-grounded moves for THIS client. Never recommend a",
    "   specific financial product or company, and never state a definitive tax",
    "   filing position — always frame as something to confirm with a tax agent.",
    "",
    "If employment_status is 'self_employed', add one sentence noting that",
    "self-employed compensation structure and company-paid expenses can affect",
    "available reliefs and deductions, and that this is worth a dedicated",
    "conversation with a registered tax agent — do not state any numbers or",
    "give a directive on how to structure compensation.",
    "",
    "If tax.insufficient_data is true, say plainly that recurring income records",
    "are missing and the priority is completing the data before any tax estimate",
    "can be relied on.",
    "",
    "MANDATORY: your narrative must make clear this is general tax information,",
    "not the advice of a registered tax agent, and that the client's actual",
    "filing position must be confirmed with LHDN rules and their tax agent.",
    "",
    "Tone: professional, plain English, written so a layperson feels the",
    "real-world stakes. This is a draft the advisor will edit.",
    "",
    "Client tax JSON (sole source of numbers):",
    JSON.stringify(context),
  ].join("\n");
}

export const taxModule: CfpModule<TaxDet, TaxNarrative, TaxSectionContent> = {
  section_type: "tax_planning",
  agent: "tax_expert",
  compute: (f: CfpData, b: FinancialBaseline, _prior, inputs) =>
    computeTax(f, b, inputs?.tax ?? {}),
  buildPrompt: (det, b, f) => ({
    prompt: buildTaxPrompt(det, b, f),
    schema: RESPONSE_SCHEMA,
  }),
  assemble: (det, narrative, _f) => ({
    version: 1,
    section_type: "tax_planning",
    agent: "tax_expert",
    ...det,
    ...narrative,
    assumptions: [
      "税表按 2026 课税年居民个人累进税率常量表，逐年更新",
      "收入以经常性现金流年化估算，未区分免税项",
    ],
    disclaimer: DISCLAIMER,
  }),
  clientViewInput: (content) => ({
    employment_income_est: content.employment_income_est,
    reliefs_detail: content.reliefs_detail,
    chargeable_income: content.chargeable_income,
    tax_payable: content.tax_payable,
    marginal_rate: content.marginal_rate,
    effective_rate: content.effective_rate,
    non_resident: content.non_resident,
    optimization_opportunities: content.optimization_opportunities,
    tax_position: content.tax_position,
    optimization: content.optimization,
    recommendations: content.recommendations,
    disclaimer: content.disclaimer,
  }),
};
