// 投资大师 (investment_master) — prompt, response schema, assembly.
// PII whitelist: risk band, amounts, percentages and demographics only — no
// names, institutions or instrument names ever reach the LLM.

import type { CfpData, CfpModule, FinancialBaseline } from "../../types.ts";
import { computeInvestment, type InvestmentDet } from "./calc.ts";

export interface InvestmentNarrative {
  executive_summary: {
    findings: string;
    action_plan: string;
    expected_completion_date: string;
    remarks: string;
  };
  allocation_review: string;
  rebalancing_plan: string;
  recommendations: Array<{ title: string; detail: string; priority: number }>;
}

export interface InvestmentSectionContent extends InvestmentNarrative, InvestmentDet {
  version: 1;
  section_type: "investment_planning";
  agent: "investment_master";
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
    allocation_review: { type: "STRING" },
    rebalancing_plan: { type: "STRING" },
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
    "allocation_review",
    "rebalancing_plan",
    "recommendations",
  ],
};

export function buildInvestmentPrompt(
  det: InvestmentDet,
  b: FinancialBaseline,
): string {
  const context = {
    age: b.age,
    marital_status: b.marital_status,
    dependents: b.dependents,
    investment: det,
  };
  return [
    "You are the analysis assistant of a licensed financial advisor in Malaysia,",
    "drafting the Investment Planning section of a comprehensive financial plan.",
    'Refer to the client only as "the client" — never invent any name, institution',
    "or instrument name; the JSON below only ever contains risk band, amounts,",
    "percentages and demographics.",
    "",
    "IRON RULE: every amount and percentage in the JSON below is a final figure",
    "computed by deterministic code. You must NOT compute, modify, or infer any",
    "amount. Quote figures verbatim (thousand separators allowed).",
    "",
    "Tasks:",
    "1) executive_summary — one row for the report's EXECUTIVE SUMMARY table:",
    "   findings (2-3 sentences: risk band, current vs target mix at a glance,",
    "   whether rebalancing is needed), action_plan (concrete next steps),",
    '   expected_completion_date (a timeframe phrase such as "Within 1 month"),',
    "   remarks.",
    "2) allocation_review — one flowing paragraph comparing the client's current",
    "   allocation to the target model portfolio for their risk band. Explain",
    "   what the drift means in real life — e.g. an overweight cash position",
    "   sitting idle and losing purchasing power to inflation, or concentration",
    "   in one bucket raising volatility beyond what the client's risk band",
    "   implies. Cite the actual current_pct / target_pct / drift_pp figures.",
    "3) rebalancing_plan — one paragraph. If rebalancing_actions is non-empty,",
    "   lay out the increase/reduce moves and amounts in a practical order. If",
    "   no_investable is true, there is no portfolio to rebalance yet — instead",
    "   give starter-allocation guidance for a first-time investor building a",
    "   portfolio gradually using the monthly surplus figure provided (frame it",
    "   as a starting point, not a specific product).",
    "4) recommendations — 3 to 5 items {title, detail, priority (1 = highest)}.",
    "   Practical portfolio moves grounded in THIS client's numbers. Never",
    "   recommend any specific product, fund, instrument or company.",
    "5) Within allocation_review or rebalancing_plan, narrate the 10-15 year",
    "   compounding trajectory in wealth_projection in plain terms — what the",
    "   portfolio could look like in 5, 10 and 15 years if current contributions",
    "   and allocation continue. Quote the projected figures verbatim.",
    "",
    "Always note that expected_return and expected_vol are long-run planning",
    "assumptions for this risk band, not promised or guaranteed outcomes.",
    "If risk_band_defaulted is true, mention plainly that no risk profile was",
    "on file so a balanced default was used, and recommend completing a risk",
    "assessment.",
    "",
    "Tone: professional, plain English, written so a layperson feels the",
    "real-world stakes. This is a draft the advisor will edit.",
    "",
    "Client investment JSON (sole source of numbers):",
    JSON.stringify(context),
  ].join("\n");
}

export const investmentModule: CfpModule<
  InvestmentDet,
  InvestmentNarrative,
  InvestmentSectionContent
> = {
  section_type: "investment_planning",
  agent: "investment_master",
  compute: (f, b) => computeInvestment(f, b),
  buildPrompt: (det, b) => ({
    prompt: buildInvestmentPrompt(det, b),
    schema: RESPONSE_SCHEMA,
  }),
  assemble: (det, narrative, _f) => ({
    version: 1,
    section_type: "investment_planning",
    agent: "investment_master",
    ...det,
    ...narrative,
    assumptions: [
      "模型组合按风险属性五档配置（马科维茨思想的实务化），非实时均值方差优化",
      "单位信托持仓按股票类资产归类",
      "现金桶为扣除紧急预备金后的可投资流动资产",
    ],
  }),
  clientViewInput: (content) => ({
    risk_band: content.risk_band,
    current_allocation: content.current_allocation,
    target_allocation: content.target_allocation,
    drift: content.drift,
    rebalancing_actions: content.rebalancing_actions,
    expected_return: content.expected_return,
    expected_vol: content.expected_vol,
    wealth_projection: content.wealth_projection,
    allocation_review: content.allocation_review,
    rebalancing_plan: content.rebalancing_plan,
    recommendations: content.recommendations,
  }),
};
