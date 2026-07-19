// Pure helpers for the unified CFP report PDF: bilingual UI labels, number
// formatting and the narrative-field lookup tables that let the per-section
// content pages branch on `section_type` without a giant switch inline in
// the JSX. No React, no side effects — mirrors the discipline of
// pdf/insuranceReport/buildReportModel.ts.

import { CFP_SECTION_ORDER, SECTION_META, type CfpSectionType } from "../../components/advisor/cfp/sectionMeta";
import type { CfpReportData, CfpReportLanguage } from "./types";

export const fmtRM = (n: number | null | undefined): string =>
  n == null || Number.isNaN(n) ? "—" : `RM ${Number(n).toLocaleString("en-US")}`;

export const fmtPct = (n: number | null | undefined, dp = 1): string =>
  n == null || Number.isNaN(n) ? "—" : `${(n * 100).toFixed(dp)}%`;

export type CfpLabelKey =
  | "reportTitle" | "preparedFor" | "preparedBy" | "generatedOn" | "confidential" | "draftTag"
  | "disclaimerTitle" | "disclaimerConsult"
  | "execSummaryTitle" | "colItems" | "colFindings" | "colActionPlan" | "colExpectedCompletion" | "colRemarks" | "notIncluded"
  | "personalInfoTitle" | "dob" | "maritalStatus" | "dependents" | "occupation" | "employmentStatus" | "retirementAge"
  | "cashflowTitle" | "cashflowIntro" | "income" | "totalIncome" | "expenses" | "totalExpenses" | "netCashflow"
  | "balanceSheetTitle" | "balanceSheetIntro" | "assets" | "totalAssets" | "liabilities" | "totalLiabilities" | "netWorth"
  | "ratiosTitle" | "savingsRatio" | "debtServiceRatio" | "emergencyMonths" | "solvencyRatio" | "guideline" | "healthy" | "attention" | "healthScore"
  | "findings" | "recommendations" | "actionPlan" | "expectedCompletion" | "remarks" | "glossary" | "disclaimer" | "assumptions"
  | "overallHealthTitle" | "overallAssessment" | "priorityPlan" | "phase" | "allocated" | "deferredNote"
  | "wealthFreedomStage" | "passiveIncome" | "monthlyExpensesLabel" | "nextStageGap" | "stageOf"
  | "backTitle" | "questions" | "contactUs" | "notGenerated"
  | "otherCategory" | "onTrack" | "notOnTrack" | "hasCover" | "noCover"
  | "survives85" | "survives100" | "depletes85" | "depletes100"
  | "capitalNeeded" | "totalProjected" | "currentAllocation" | "scoreComponents" | "budgetWaterfall"
  | "surplus" | "netAssets" | "netLiabilities";

export const LABELS: Record<CfpReportLanguage, Record<CfpLabelKey, string>> = {
  en: {
    reportTitle: "FINANCIAL REPORT",
    preparedFor: "Prepared for",
    preparedBy: "Prepared by",
    generatedOn: "Generated on",
    confidential: "Private & Confidential — prepared for the named client only.",
    draftTag: "DRAFT — sections pending approval",
    disclaimerTitle: "Important Notice",
    disclaimerConsult: "Please review this plan regularly with your advisor as your circumstances change.",
    execSummaryTitle: "Executive Summary",
    colItems: "Items",
    colFindings: "Findings",
    colActionPlan: "Action Plan",
    colExpectedCompletion: "Expected Completion",
    colRemarks: "Remarks",
    notIncluded: "Not included this period",
    personalInfoTitle: "Personal Information",
    dob: "Date of Birth",
    maritalStatus: "Marital Status",
    dependents: "Dependants",
    occupation: "Occupation",
    employmentStatus: "Employment Status",
    retirementAge: "Retirement Age",
    cashflowTitle: "Cash Flow Statement",
    cashflowIntro: "The statement below summarises the client's recurring monthly income and expenses as recorded, giving a clear picture of the surplus available each month to fund the plan's priorities.",
    income: "Income",
    totalIncome: "Total Take-Home",
    expenses: "Expenses",
    totalExpenses: "Total Expenses",
    netCashflow: "Net Cashflow",
    balanceSheetTitle: "Balance Sheet Statement",
    balanceSheetIntro: "The statement below lists the client's recorded assets and liabilities, arriving at the household's net worth as at the date of this report.",
    assets: "Assets",
    totalAssets: "Total Assets",
    liabilities: "Liabilities",
    totalLiabilities: "Total Liabilities",
    netWorth: "Net Worth",
    ratiosTitle: "Financial Ratios",
    savingsRatio: "Savings Ratio",
    debtServiceRatio: "Debt Service Ratio",
    emergencyMonths: "Emergency Fund (months covered)",
    solvencyRatio: "Solvency Ratio",
    guideline: "Guideline",
    healthy: "Healthy",
    attention: "Attention",
    healthScore: "Overall Health Score",
    findings: "Findings",
    recommendations: "Recommendations",
    actionPlan: "Action Plan",
    expectedCompletion: "Expected Completion",
    remarks: "Remarks",
    glossary: "Plain-Language Glossary",
    disclaimer: "Disclaimer",
    assumptions: "Assumptions",
    overallHealthTitle: "Overall Financial Health",
    overallAssessment: "Overall Assessment",
    priorityPlan: "Phased Action Timeline",
    phase: "Phase",
    allocated: "Allocated",
    deferredNote: "deferred",
    wealthFreedomStage: "Wealth Freedom Stage",
    passiveIncome: "Passive Income (monthly)",
    monthlyExpensesLabel: "Monthly Expenses",
    nextStageGap: "Gap to next stage",
    stageOf: "Stage {n} of 4",
    backTitle: "Questions?",
    questions: "Questions? Contact us.",
    contactUs: "Contact us",
    notGenerated: "Not yet generated",
    otherCategory: "Other",
    onTrack: "On Track",
    notOnTrack: "Needs Attention",
    hasCover: "Covered",
    noCover: "Not Covered",
    survives85: "Lasts to 85",
    survives100: "Lasts to 100",
    depletes85: "Depletes before 85",
    depletes100: "Depletes before 100",
    capitalNeeded: "Capital Needed",
    totalProjected: "Total Projected",
    currentAllocation: "Current Allocation",
    scoreComponents: "Score Components",
    budgetWaterfall: "Budget Allocation",
    surplus: "Surplus",
    netAssets: "Total Assets",
    netLiabilities: "Total Liabilities",
  },
  zh: {
    reportTitle: "财务报告",
    preparedFor: "呈交予",
    preparedBy: "顾问",
    generatedOn: "生成日期",
    confidential: "私人及保密文件 — 仅供本报告指名客户参阅。",
    draftTag: "草稿 — 部分板块尚未定稿",
    disclaimerTitle: "重要声明",
    disclaimerConsult: "请随情况变化定期与您的顾问一同检视本计划。",
    execSummaryTitle: "执行摘要",
    colItems: "项目",
    colFindings: "分析结果",
    colActionPlan: "行动计划",
    colExpectedCompletion: "预计完成时间",
    colRemarks: "备注",
    notIncluded: "未纳入本期",
    personalInfoTitle: "个人资料",
    dob: "出生日期",
    maritalStatus: "婚姻状况",
    dependents: "受抚养人数",
    occupation: "职业",
    employmentStatus: "就业状况",
    retirementAge: "退休年龄",
    cashflowTitle: "现金流报表",
    cashflowIntro: "下表汇总客户记录在案的每月经常性收入与支出，清楚呈现每月可用于落实本计划各项优先事项的盈余。",
    income: "收入",
    totalIncome: "税后收入合计",
    expenses: "支出",
    totalExpenses: "支出合计",
    netCashflow: "净现金流",
    balanceSheetTitle: "资产负债表",
    balanceSheetIntro: "下表列出客户记录在案的资产与负债，并计算截至本报告日期的家庭净资产。",
    assets: "资产",
    totalAssets: "资产合计",
    liabilities: "负债",
    totalLiabilities: "负债合计",
    netWorth: "净资产",
    ratiosTitle: "财务比率",
    savingsRatio: "储蓄率",
    debtServiceRatio: "偿债比率",
    emergencyMonths: "紧急预备金（覆盖月数）",
    solvencyRatio: "清偿比率",
    guideline: "参考标准",
    healthy: "健康",
    attention: "需关注",
    healthScore: "整体健康评分",
    findings: "分析结果",
    recommendations: "建议",
    actionPlan: "行动计划",
    expectedCompletion: "预计完成时间",
    remarks: "备注",
    glossary: "名词解释",
    disclaimer: "免责声明",
    assumptions: "计算假设",
    overallHealthTitle: "整体财务健康",
    overallAssessment: "整体评估",
    priorityPlan: "分阶段行动时间表",
    phase: "阶段",
    allocated: "已分配",
    deferredNote: "顺延",
    wealthFreedomStage: "财富自由阶段",
    passiveIncome: "被动收入（每月）",
    monthlyExpensesLabel: "每月支出",
    nextStageGap: "距下一阶段缺口",
    stageOf: "第 {n} 阶段（共 4 阶段）",
    backTitle: "有任何问题？",
    questions: "有任何问题？欢迎与我们联系。",
    contactUs: "联系我们",
    notGenerated: "尚未生成",
    otherCategory: "其他",
    onTrack: "已达标",
    notOnTrack: "需关注",
    hasCover: "已投保",
    noCover: "未投保",
    survives85: "可持续至85岁",
    survives100: "可持续至100岁",
    depletes85: "85岁前耗尽",
    depletes100: "100岁前耗尽",
    capitalNeeded: "所需资本",
    totalProjected: "预计累积",
    currentAllocation: "当前配置",
    scoreComponents: "评分构成",
    budgetWaterfall: "预算分配",
    surplus: "盈余",
    netAssets: "资产合计",
    netLiabilities: "负债合计",
  },
};

// ----------------------------------------------------------- fixed disclaimer
// Rendered bilingually (EN + ZH) regardless of report language, per spec.
export const DISCLAIMER_EN = [
  "The figures and projections in this report are derived from information provided by the client and a set of planning assumptions that will change over time — actual results will differ.",
  "Tax-related figures are based on current tax rules and rates, which are subject to change without notice.",
  "This plan should be reviewed regularly with your advisor as your circumstances, goals and applicable regulations evolve.",
  "This report is general information prepared to support financial planning discussions. It does NOT constitute legal, accounting or tax advice — please consult the respective qualified advisers (legal counsel, accountant or tax agent) before acting on any matter covered here.",
];

export const DISCLAIMER_ZH = [
  "本报告中的数字与预测均基于客户提供的信息及一系列会随时间变化的规划假设推算，实际结果可能有所不同。",
  "税务相关数字基于现行税务规则与税率计算，相关规则可能随时调整，恕不另行通知。",
  "请随着您的情况、目标及相关法规的变化，定期与您的顾问一同检视本计划。",
  "本报告为支持财务规划讨论而编制的一般性资料，并不构成法律、会计或税务意见 — 在采取任何行动前，请咨询相应的专业顾问（律师、会计师或税务代理）。",
];

// ------------------------------------------------------------ section rows
export interface ExecSummaryRow {
  sectionType: CfpSectionType;
  meta: (typeof SECTION_META)[CfpSectionType];
  generated: boolean;
  findings?: string;
  actionPlan?: string;
  expectedCompletion?: string;
  remarks?: string;
}

export function buildExecSummaryRows(data: CfpReportData): ExecSummaryRow[] {
  return CFP_SECTION_ORDER.map((sectionType) => {
    const section = data.sections.find((s) => s.section_type === sectionType && s.content);
    const meta = SECTION_META[sectionType];
    if (!section) return { sectionType, meta, generated: false };
    const es = section.content.executive_summary ?? {};
    return {
      sectionType,
      meta,
      generated: true,
      findings: es.findings ?? "",
      actionPlan: es.action_plan ?? "",
      expectedCompletion: es.expected_completion_date ?? "",
      remarks: es.remarks ?? "",
    };
  });
}

export function sectionByType(data: CfpReportData, sectionType: string) {
  return data.sections.find((s) => s.section_type === sectionType && s.content) ?? null;
}

// --------------------------------------------------- narrative field lookup
// Each module's technical narrative uses different field names (see
// supabase/functions/cfp-brain/modules/*/section.ts). Used ONLY as the
// fallback when a section has no client_view yet.
export const NARRATIVE_FIELDS: Record<string, Array<{ key: string; en: string; zh: string }>> = {
  cashflow_planning: [
    { key: "budget_commentary", en: "Budget Commentary", zh: "预算点评" },
    { key: "emergency_fund_plan", en: "Emergency Fund Plan", zh: "紧急预备金计划" },
  ],
  goals_planning: [
    { key: "overview", en: "Overview", zh: "总览" },
  ],
  insurance_planning: [
    { key: "gap_analysis", en: "Gap Analysis", zh: "缺口分析" },
  ],
  investment_planning: [
    { key: "allocation_review", en: "Allocation Review", zh: "配置检视" },
    { key: "rebalancing_plan", en: "Rebalancing Plan", zh: "再平衡计划" },
  ],
  retirement_planning: [
    { key: "gap_analysis", en: "Gap Analysis", zh: "缺口分析" },
    { key: "funding_plan", en: "Funding Plan", zh: "资金筹措计划" },
  ],
  tax_planning: [
    { key: "tax_position", en: "Tax Position", zh: "税务状况" },
    { key: "optimization", en: "Optimization", zh: "优化建议" },
  ],
  legacy_planning: [
    { key: "estate_review", en: "Estate Review", zh: "遗产检视" },
    { key: "readiness", en: "Readiness", zh: "准备度" },
  ],
};

// ------------------------------------------------------------ ratio verdicts
export type RatioBand = "good" | "bad" | "none";

export function verdictSavings(v: number | null | undefined): RatioBand {
  return v == null ? "none" : v >= 0.2 ? "good" : "bad";
}
export function verdictDebtService(v: number | null | undefined): RatioBand {
  return v == null ? "none" : v <= 0.35 ? "good" : "bad";
}
export function verdictEmergencyMonths(v: number | null | undefined): RatioBand {
  return v == null ? "none" : v >= 3 ? "good" : "bad";
}
export function verdictSolvency(v: number | null | undefined): RatioBand {
  return v == null ? "none" : v >= 0.5 ? "good" : "bad";
}

// -------------------------------------------------------- breakdown folding
export interface FoldedCategory {
  category: string;
  monthly_amount: number;
}

/** Top-N categories by amount, remainder folded into one "Other" row — keeps
 * HBar lists on the Cash Flow page readable regardless of how many raw
 * expense/income categories the client has on file. */
export function topCategoriesWithOther(
  rows: Array<{ category: string; monthly_amount: number }> | null | undefined,
  topN: number,
  lang: CfpReportLanguage,
): FoldedCategory[] {
  const sorted = [...(rows ?? [])].sort((a, b) => b.monthly_amount - a.monthly_amount);
  if (sorted.length <= topN) return sorted;
  const head = sorted.slice(0, topN);
  const restTotal = sorted.slice(topN).reduce((s, r) => s + r.monthly_amount, 0);
  return [...head, { category: LABELS[lang].otherCategory, monthly_amount: restTotal }];
}

// ------------------------------------------------------- investment allocation
export const ALLOCATION_BUCKET_LABEL: Record<CfpReportLanguage, Record<string, string>> = {
  en: { equity: "Equity", bond: "Bond", cash: "Cash", alternatives: "Alternatives" },
  zh: { equity: "股票", bond: "债券", cash: "现金", alternatives: "另类资产" },
};

// --------------------------------------------------- health score components
export const SCORE_COMPONENT_LABEL: Record<CfpReportLanguage, Record<string, string>> = {
  en: {
    emergency: "Emergency Fund",
    savings: "Savings Ratio",
    debt: "Debt Service",
    protection: "Protection Coverage",
    retirement: "Retirement Funding",
  },
  zh: {
    emergency: "紧急预备金",
    savings: "储蓄率",
    debt: "偿债压力",
    protection: "保障覆盖度",
    retirement: "退休资金覆盖度",
  },
};
