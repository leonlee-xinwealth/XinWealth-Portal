// 首席规划师 (chief_planner) — prompt, response schema, assembly.
// Narrates the deterministic reconciliation: ONE budget, fixed priorities,
// explicit deferrals, wealth-freedom stage — the section that keeps the seven
// specialists from talking past each other.

import type { CfpData, CfpModule, FinancialBaseline } from "../../types.ts";
import { computeSynthesis, type SynthesisDet } from "./calc.ts";

export interface SynthesisNarrative {
  executive_summary: {
    findings: string;
    action_plan: string;
    expected_completion_date: string;
    remarks: string;
  };
  overall_assessment: string;
  priority_plan: string;
  recommendations: Array<{ title: string; detail: string; priority: number }>;
}

export interface SynthesisSectionContent extends SynthesisNarrative, SynthesisDet {
  version: 1;
  section_type: "financial_health";
  agent: "chief_planner";
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
    overall_assessment: { type: "STRING" },
    priority_plan: { type: "STRING" },
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
    "overall_assessment",
    "priority_plan",
    "recommendations",
  ],
};

export function buildSynthesisPrompt(
  det: SynthesisDet,
  b: FinancialBaseline,
): string {
  const context = {
    age: b.age,
    marital_status: b.marital_status,
    dependents: b.dependents,
    years_to_retirement: b.years_to_retirement,
    synthesis: det,
  };
  return [
    "You are the chief planner of a licensed financial advisor's paraplanner",
    "team in Malaysia, writing the OVERALL FINANCIAL HEALTH section that closes",
    "a comprehensive financial plan. The seven specialist sections each stated",
    "their own needs; your job is the reconciliation — one budget, explicit",
    'priorities, no wishful thinking. Refer to the client only as "the client".',
    "",
    "IRON RULE: every amount in the JSON below is a final number computed by",
    "deterministic code. You must NOT compute, modify, or infer any amount.",
    "Quote figures verbatim (thousand separators allowed).",
    "",
    "Tasks:",
    "1) executive_summary — one row for the report's EXECUTIVE SUMMARY table:",
    "   findings (2-3 sentences: health score, biggest funded/deferred items,",
    "   wealth-freedom stage), action_plan, expected_completion_date (a",
    "   timeframe phrase), remarks.",
    "2) overall_assessment — one paragraph: what the health score and its",
    "   components say about this household's resilience, in plain human terms.",
    "   Mention the wealth-freedom stage (stage 1-4; stage 4 = passive income",
    "   covers 2× monthly expenses, the long-run goal) and the next-stage gap.",
    "3) priority_plan — narrate the budget reconciliation table faithfully:",
    "   the annual surplus, each line's required vs allocated amount IN THE",
    "   GIVEN PRIORITY ORDER (protection → emergency fund → retirement → goals",
    "   → wealth building). If over_budget is true, state plainly which items",
    "   are deferred and why the order protects the family first — never",
    "   pretend everything is affordable at once. If over_budget is false,",
    "   celebrate that every need is funded with surplus to invest.",
    "4) recommendations — exactly the top 3 priority actions, {title, detail,",
    "   priority}. Each must reference a figure from the JSON. Never recommend",
    "   any specific product, plan or company.",
    "",
    "If missing_modules is non-empty, note that those sections have not been",
    "generated yet and their needs were treated as zero — advise generating",
    "them for a complete picture.",
    "",
    "Tone: senior, calm, decisive. Plain English. Draft for the advisor.",
    "",
    "Synthesis JSON (sole source of numbers):",
    JSON.stringify(context),
  ].join("\n");
}

export const synthesisModule: CfpModule<
  SynthesisDet,
  SynthesisNarrative,
  SynthesisSectionContent
> = {
  section_type: "financial_health",
  agent: "chief_planner",
  compute: (f, b, prior) => computeSynthesis(f, b, prior),
  buildPrompt: (det, b) => ({
    prompt: buildSynthesisPrompt(det, b),
    schema: RESPONSE_SCHEMA,
  }),
  assemble: (det, narrative, _f) => ({
    version: 1,
    section_type: "financial_health",
    agent: "chief_planner",
    ...det,
    ...narrative,
    assumptions: [
      "预算对账按固定优先级分配年度盈余：保障 → 紧急预备金 → 退休 → 目标 → 财富增值",
      "健康分由紧急预备金(20%)、储蓄率(15%)、偿债压力(15%)、保障覆盖度(25%)、退休资金覆盖度(25%)加权，缺数据组件按权重重归一",
      "财务自由四阶段以被动收入对月支出的倍数划分，最终目标为 2 倍（含通胀安全边际）",
    ],
  }),
  clientViewInput: (content) => ({
    health_score: content.health_score,
    score_components: content.score_components,
    budget: content.budget,
    wealth_freedom: content.wealth_freedom,
    overall_assessment: content.overall_assessment,
    priority_plan: content.priority_plan,
    recommendations: content.recommendations,
  }),
};
