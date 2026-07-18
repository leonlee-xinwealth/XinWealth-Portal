// 退休规划师 (investment_master) — prompt, response schema, assembly.
// PII whitelist: amounts, ratios, ages and employment status only — no names,
// institutions or account numbers ever reach the LLM.

import type { CfpData, CfpModule, FinancialBaseline } from "../../types.ts";
import { budgetInstructionLines, sectionBudgetContext } from "../../budgetContext.ts";
import { computeRetirement, type RetirementDet } from "./calc.ts";

export interface RetirementNarrative {
  executive_summary: {
    findings: string;
    action_plan: string;
    expected_completion_date: string;
    remarks: string;
  };
  gap_analysis: string;
  funding_plan: string;
  recommendations: Array<{ title: string; detail: string; priority: number }>;
}

export interface RetirementSectionContent extends RetirementNarrative, RetirementDet {
  version: 1;
  section_type: "retirement_planning";
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
    gap_analysis: { type: "STRING" },
    funding_plan: { type: "STRING" },
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
    "gap_analysis",
    "funding_plan",
    "recommendations",
  ],
};

export function buildRetirementPrompt(
  det: RetirementDet,
  b: FinancialBaseline,
  f: CfpData,
): string {
  const context = {
    age: b.age,
    employment_status: f.client.employment_status,
    dependents: b.dependents,
    monthly_surplus: Math.round(b.annual_surplus / 12),
    retirement: det,
    budget_context: sectionBudgetContext(b, "retirement"),
  };
  return [
    "You are the analysis assistant of a licensed financial advisor in Malaysia,",
    "drafting the Retirement Planning section of a comprehensive financial plan.",
    'Refer to the client only as "the client" — never invent any name, institution',
    "or account number; the JSON below only ever contains amounts, ratios, ages",
    "and employment status.",
    "",
    "IRON RULE: every amount in the JSON below is a final number computed by",
    "deterministic code. You must NOT compute, modify, or infer any amount, and",
    "must NOT introduce any figure that is not already in the JSON. Quote",
    "figures verbatim (thousand separators allowed).",
    "",
    "Tasks:",
    "1) executive_summary — one row for the report's EXECUTIVE SUMMARY table:",
    "   findings (2-3 sentences: capital needed at retirement, total projected",
    "   savings, whether on track), action_plan (concrete next steps),",
    '   expected_completion_date (a timeframe phrase such as "Ongoing until',
    'retirement"), remarks.',
    "2) gap_analysis — one flowing paragraph translating the gap into real",
    "   life: what lifestyle the current projection funds versus what is",
    "   actually needed, and — only using the figures given, never invented —",
    "   what that means if nothing changes (e.g. savings running short partway",
    "   through retirement). If on_track is true, affirm the trajectory instead",
    "   of manufacturing a shortfall.",
    "3) funding_plan — one paragraph laying out the funding order: EPF as the",
    "   base layer, PRS top-up next (PRS enjoys tax relief, without stating a",
    "   number — the Tax Planning section quantifies it), then other savings.",
    "   Compare required_monthly_topup against the monthly surplus provided and",
    "   say plainly whether the surplus alone covers it.",
    "4) recommendations — 3 to 5 items {title, detail, priority (1 = highest)}.",
    "   Practical funding moves (raise EPF voluntary contribution, start or",
    "   increase PRS contribution, review the retirement age or replacement",
    "   ratio assumption). Never recommend any specific product, fund or",
    "   company.",
    "5) Within gap_analysis, narrate the drawdown stress test in real-life",
    "   terms — at what age the money is projected to run out versus living to",
    "   85 or 100. Quote depletion_age verbatim; do not introduce any new",
    "   number.",
    "6) Within funding_plan, describe — qualitatively only, no product names,",
    "   companies or computed numbers — the partial drawdown (部分提款) strategy",
    "   of moving accumulated capital at retirement into capital-guaranteed",
    "   income instruments (e.g. fixed deposits, EPF retained savings) and",
    "   withdrawing only what each year needs.",
    "",
    "If insufficient_data is true, say plainly that a date of birth is missing",
    "so the years-to-retirement horizon cannot be computed, and that this is the",
    "priority before any projection is meaningful; gap_analysis and funding_plan",
    "should not invent a horizon or capital figure in that case.",
    "",
    ...budgetInstructionLines("retirement top-up"),
    "",
    "Tone: professional, plain English, written so a layperson feels the",
    "real-world stakes. This is a draft the advisor will edit.",
    "",
    "Client retirement JSON (sole source of numbers):",
    JSON.stringify(context),
  ].join("\n");
}

export const retirementModule: CfpModule<
  RetirementDet,
  RetirementNarrative,
  RetirementSectionContent
> = {
  section_type: "retirement_planning",
  agent: "investment_master",
  compute: (f, b) => computeRetirement(f, b),
  buildPrompt: (det, b, f) => ({
    prompt: buildRetirementPrompt(det, b, f),
    schema: RESPONSE_SCHEMA,
  }),
  assemble: (det, narrative, _f) => ({
    version: 1,
    section_type: "retirement_planning",
    agent: "investment_master",
    ...det,
    ...narrative,
    assumptions: [
      "EPF 存款按 5.5% 年化股息率推算",
      "退休后所需收入按退休前支出的 66% 替代率计算",
      "退休资本需求按 4% 提领率（4% rule）计算",
      "预期寿命假设为 85 岁",
      "受雇人士 EPF 供款按 23%（雇员 11% + 雇主 12%）计算",
      "压力测试按退休后资金转入保本收息工具、以 EPF 派息率作保守增长假设，逐年扣除通胀调整后的生活费模拟至 100 岁",
    ],
  }),
  clientViewInput: (content) => ({
    years_to_retirement: content.years_to_retirement,
    retirement_years: content.retirement_years,
    income_need_at_retirement: content.income_need_at_retirement,
    capital_needed: content.capital_needed,
    epf_projected: content.epf_projected,
    prs_projected: content.prs_projected,
    other_projected: content.other_projected,
    total_projected: content.total_projected,
    gap: content.gap,
    required_monthly_topup: content.required_monthly_topup,
    on_track: content.on_track,
    depletion_age: content.depletion_age,
    survives_to_85: content.survives_to_85,
    survives_to_100: content.survives_to_100,
    gap_analysis: content.gap_analysis,
    funding_plan: content.funding_plan,
    recommendations: content.recommendations,
  }),
};
