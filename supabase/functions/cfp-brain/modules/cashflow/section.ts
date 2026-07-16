// 小会计 (little_accountant) — prompt, response schema, assembly.
// Persona: cashflow monitoring + spending AWARENESS, judgement-free.
// PII whitelist: category labels, amounts, ratios and demographics only —
// no names, institutions or account details ever reach the LLM.

import type { CfpData, CfpModule, FinancialBaseline } from "../../types.ts";
import { type CashflowDet, computeCashflow } from "./calc.ts";

export interface CashflowNarrative {
  executive_summary: {
    findings: string;
    action_plan: string;
    expected_completion_date: string;
    remarks: string;
  };
  budget_commentary: string;
  emergency_fund_plan: string;
  recommendations: Array<{ title: string; detail: string; priority: number }>;
}

export interface CashflowSectionContent extends CashflowNarrative, CashflowDet {
  version: 1;
  section_type: "cashflow_planning";
  agent: "little_accountant";
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
    budget_commentary: { type: "STRING" },
    emergency_fund_plan: { type: "STRING" },
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
    "budget_commentary",
    "emergency_fund_plan",
    "recommendations",
  ],
};

export function buildCashflowPrompt(
  det: CashflowDet,
  b: FinancialBaseline,
): string {
  const context = {
    age: b.age,
    marital_status: b.marital_status,
    dependents: b.dependents,
    monthly_debt_service: b.monthly_debt_service,
    cashflow: det,
  };
  return [
    "You are the analysis assistant of a licensed financial advisor in Malaysia,",
    "drafting the Cashflow & Budget Planning section of a comprehensive financial",
    'plan. Refer to the client only as "the client" — never invent any name.',
    "",
    "IRON RULE: every amount in the JSON below is a final number computed by",
    "deterministic code. You must NOT compute, modify, or infer any amount.",
    "When citing amounts, quote figures verbatim (thousand separators allowed).",
    "",
    "Tasks:",
    "1) executive_summary — one row for the report's EXECUTIVE SUMMARY table:",
    "   findings (2-3 sentences: income vs spending, surplus, savings ratio,",
    "   emergency fund position with key figures), action_plan (concrete next",
    '   steps), expected_completion_date (a timeframe phrase such as "Within 3',
    '   months"), remarks.',
    "2) budget_commentary — one flowing paragraph building spending AWARENESS,",
    "   never judgement: which expense categories dominate, whether the surplus",
    "   is healthy for this life stage, and what the debt service ratio means",
    "   for flexibility. Cite the actual category names and figures from the",
    "   JSON. Note that transfers into the client's own assets",
    "   (asset_transfers_monthly) are savings, not spending — celebrate them.",
    "   Describe patterns neutrally ('RM X went to Y') so the client can see",
    "   where money goes; do not scold, moralise or label spending as wasteful.",
    "3) emergency_fund_plan — one paragraph on the emergency fund verdict",
    "   (status, months covered vs the 3-6 month target). If there is a",
    "   shortfall, translate it into a concrete real-life consequence (a job",
    "   loss or medical event forces borrowing or selling investments at the",
    "   worst time) and lay out a step-by-step build-up plan using the monthly",
    "   surplus figure. If sufficient, affirm it and note the discipline of not",
    "   letting the buffer be raided for other goals.",
    "4) recommendations — 3 to 5 items {title, detail, priority (1 = highest)}.",
    "   Practical budgeting moves grounded in THIS client's breakdown. Never",
    "   recommend any specific financial product or company.",
    "",
    "If cashflow.insufficient_data is true, say plainly that recurring income",
    "records are missing and the priority is completing the data.",
    "",
    "Tone: professional, plain English, written so a layperson feels the",
    "real-world stakes. This is a draft the advisor will edit.",
    "",
    "Client cashflow JSON (sole source of numbers):",
    JSON.stringify(context),
  ].join("\n");
}

export const cashflowModule: CfpModule<
  CashflowDet,
  CashflowNarrative,
  CashflowSectionContent
> = {
  section_type: "cashflow_planning",
  agent: "little_accountant",
  compute: (f, b) => computeCashflow(f, b),
  buildPrompt: (det, b) => ({
    prompt: buildCashflowPrompt(det, b),
    schema: RESPONSE_SCHEMA,
  }),
  assemble: (det, narrative, _f) => ({
    version: 1,
    section_type: "cashflow_planning",
    agent: "little_accountant",
    ...det,
    ...narrative,
    assumptions: [
      "收入与支出按最近一个月的经常性现金流年化",
      "紧急预备金目标按 3–6 个月经常性支出计算",
      "与自有资产挂钩的转账视为资产转移（储蓄），不计入真实支出",
    ],
  }),
  clientViewInput: (content) => ({
    monthly_income: content.monthly_income,
    monthly_expenses: content.monthly_expenses,
    monthly_surplus: content.monthly_surplus,
    savings_ratio: content.savings_ratio,
    asset_transfers_monthly: content.asset_transfers_monthly,
    expense_breakdown: content.expense_breakdown,
    emergency_fund: content.emergency_fund,
    budget_commentary: content.budget_commentary,
    emergency_fund_plan: content.emergency_fund_plan,
    recommendations: content.recommendations,
  }),
};
