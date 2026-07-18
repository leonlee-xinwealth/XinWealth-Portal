// 目标规划师 (goal_planner) — prompt, response schema, assembly.
// PII rule: advisor-entered goal NAMES may contain family member names, so
// prompts carry only {goal_type, target_year, figures}; real names are merged
// back into the content by code AFTER the LLM call.

import type { CfpData, CfpModule, FinancialBaseline } from "../../types.ts";
import { budgetInstructionLines, sectionBudgetContext } from "../../budgetContext.ts";
import { computeGoals, type GoalsDet } from "./calc.ts";

export interface GoalsNarrative {
  executive_summary: {
    findings: string;
    action_plan: string;
    expected_completion_date: string;
    remarks: string;
  };
  overview: string;
  goal_commentaries: Array<{ index: number; commentary: string }>;
  recommendations: Array<{ title: string; detail: string; priority: number }>;
}

import type { GoalDet } from "./calc.ts";

export interface GoalsSectionContent extends GoalsDet {
  version: 1;
  section_type: "goals_planning";
  agent: "goal_planner";
  goals: Array<GoalDet & { commentary: string }>;
  executive_summary: GoalsNarrative["executive_summary"];
  overview: string;
  /** goal_commentaries re-keyed onto the goals rows by code */
  recommendations: GoalsNarrative["recommendations"];
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
    overview: { type: "STRING" },
    goal_commentaries: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "INTEGER" },
          commentary: { type: "STRING" },
        },
        required: ["index", "commentary"],
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
  },
  required: [
    "executive_summary",
    "overview",
    "goal_commentaries",
    "recommendations",
  ],
};

export function buildGoalsPrompt(det: GoalsDet, b: FinancialBaseline): string {
  const context = {
    age: b.age,
    dependents: b.dependents,
    monthly_surplus: Math.round(b.annual_surplus / 12),
    return_rate_used: det.return_rate_used,
    no_goals: det.no_goals,
    // PII whitelist: strip id and advisor-entered name; keep index for mapping.
    goals: det.goals.map((g, index) => ({
      index,
      goal_type: g.goal_type,
      target_year: g.target_year,
      years_to_target: g.years_to_target,
      target_amount_today: g.target_amount_today,
      inflation_used: g.inflation_used,
      future_cost: g.future_cost,
      current_saved: g.current_saved,
      monthly_contribution: g.monthly_contribution,
      projected_savings: g.projected_savings,
      gap: g.gap,
      required_monthly: g.required_monthly,
      on_track: g.on_track,
    })),
    total_required_monthly: det.total_required_monthly,
    budget_context: sectionBudgetContext(b, "goals"),
  };
  return [
    "You are the analysis assistant of a licensed financial advisor in Malaysia,",
    "drafting the Goal-Based Planning section (education / house / business /",
    "other life goals) of a comprehensive financial plan. Refer to the client",
    'only as "the client"; refer to each goal by its goal_type and target year',
    '(e.g. "the education goal for 2036") — never invent any name.',
    "",
    "IRON RULE: every amount in the JSON below is a final number computed by",
    "deterministic code. You must NOT compute, modify, or infer any amount.",
    "Quote figures verbatim (thousand separators allowed).",
    "",
    "Tasks:",
    "1) executive_summary — one row for the report's EXECUTIVE SUMMARY table:",
    "   findings (2-3 sentences: how many goals, which are on track, total",
    "   monthly saving required), action_plan, expected_completion_date (a",
    '   timeframe phrase), remarks.',
    "2) overview — one flowing paragraph: the goals as a whole against the",
    "   monthly surplus. If total_required_monthly exceeds the surplus, say so",
    "   plainly and explain that the Overall Financial Health section will",
    "   prioritise; do not silently pretend all goals are affordable.",
    "3) goal_commentaries — EXACTLY one item per input goal, using the SAME",
    "   index. 2-3 sentences each: what the figures mean in real life (what",
    "   happens to this goal if saving stays as-is), citing future_cost, gap and",
    "   required_monthly verbatim.",
    "4) recommendations — 2 to 4 items {title, detail, priority (1 = highest)}.",
    "   Practical funding moves (start/raise monthly saving, review timeline,",
    "   split goals). Never recommend any specific product, plan or company.",
    "",
    "If no_goals is true: write a short overview explaining no life goals are on",
    "record yet and recommend a goal-discovery conversation; goal_commentaries",
    "must be an empty array.",
    ...budgetInstructionLines("goal-funding"),
    "",
    "Tone: professional, plain English, human. Draft for the advisor to edit.",
    "",
    "Goals JSON (sole source of numbers):",
    JSON.stringify(context),
  ].join("\n");
}

export const goalsModule: CfpModule<
  GoalsDet,
  GoalsNarrative,
  GoalsSectionContent
> = {
  section_type: "goals_planning",
  agent: "goal_planner",
  compute: (f, b) => computeGoals(f, b),
  updateBaseline: (b, det) => ({
    ...b,
    goal_education_need: det.education_future_cost_total > 0
      ? det.education_future_cost_total
      : undefined,
  }),
  buildPrompt: (det, b) => ({
    prompt: buildGoalsPrompt(det, b),
    schema: RESPONSE_SCHEMA,
  }),
  assemble: (det, narrative, _f) => {
    // Merge per-goal commentary back onto the named rows (names never saw the LLM).
    const commentaryByIndex = new Map(
      narrative.goal_commentaries.map((c) => [c.index, c.commentary]),
    );
    return {
      version: 1,
      section_type: "goals_planning",
      agent: "goal_planner",
      ...det,
      goals: det.goals.map((g, i) => ({
        ...g,
        commentary: commentaryByIndex.get(i) ?? "",
      })),
      executive_summary: narrative.executive_summary,
      overview: narrative.overview,
      recommendations: narrative.recommendations,
      assumptions: [
        `教育类目标按 ${(0.04 * 100).toFixed(0)}% 通胀、其余按一般通胀假设推算未来成本`,
        `储蓄增长按客户风险属性对应的长期回报假设 ${(det.return_rate_used * 100).toFixed(1)}% 计算`,
        "教育目标未来成本合计已回填保险 CNA 的教育金需求（替代每孩常量估算）",
      ],
    };
  },
  clientViewInput: (content) => ({
    goals: content.goals,
    total_required_monthly: content.total_required_monthly,
    overview: content.overview,
    recommendations: content.recommendations,
  }),
};
