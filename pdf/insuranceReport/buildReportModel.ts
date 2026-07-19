// Pure mapper: (stored section content + meta) -> a flat, presentation-ready
// view model for the PDF renderer. No React, no side effects.
//
// Discipline: every NUMBER comes from content.cna / content.policy_overview and
// is passed through untouched. Every PROSE string prefers the layman
// content.client_view, falling back to the base advisor narrative so the export
// still works before a client view has been generated.

import type {
  ClientView,
  InsuranceSectionContent,
  Language,
  PolicyOverviewRow,
  ReportMeta,
} from "./types";

export type { ReportMeta } from "./types";

export const fmtRM = (n: number | null | undefined): string =>
  n == null ? "—" : `RM ${Number(n).toLocaleString("en-US")}`;

// Localized labels. Section headings follow the app's language toggle; the
// narrative prose renders in whatever language the client view was authored in.
type LabelKey =
  | "reportTitle"
  | "part1Title"
  | "part2Title"
  | "part3Title"
  | "provider"
  | "policyType"
  | "sumAssured"
  | "cashValue"
  | "annualPremium"
  | "totalAnnualPremium"
  | "annualIncome"
  | "totalLiabilities"
  | "liquidAssets"
  | "dependents"
  | "need"
  | "covered"
  | "gap"
  | "sufficient"
  | "hasMedical"
  | "noMedical"
  | "coverageReview"
  | "gapAnalysis"
  | "scenarios"
  | "recommendations"
  | "actionPlan"
  | "expectedCompletion"
  | "glossary"
  | "disclaimer"
  | "preparedFor"
  | "preparedBy"
  | "generatedOn"
  | "priority"
  | "assumptions"
  | "noPolicies"
  | "confidential"
  | "snapshot"
  | "coveragePct"
  | "premiumOfIncome"
  | "totalSumAssured"
  | "policies"
  | "nextSteps"
  | "ofNeedMet";

const LABELS: Record<Language, Record<LabelKey, string>> = {
  en: {
    reportTitle: "Insurance Planning Report",
    part1Title: "Your Information",
    part2Title: "What We Found",
    part3Title: "Our Recommendations",
    provider: "Provider",
    policyType: "Type",
    sumAssured: "Sum Assured",
    cashValue: "Cash Value",
    annualPremium: "Annual Premium",
    totalAnnualPremium: "Total Annual Premium",
    annualIncome: "Annual Income",
    totalLiabilities: "Total Liabilities",
    liquidAssets: "Liquid Assets",
    dependents: "Dependents",
    need: "Need",
    covered: "Covered",
    gap: "Gap",
    sufficient: "Sufficient",
    hasMedical: "Medical cover in place",
    noMedical: "No medical cover found",
    coverageReview: "Coverage Review",
    gapAnalysis: "Gap Analysis",
    scenarios: "Real-Life Scenarios",
    recommendations: "Recommendations",
    actionPlan: "Action Plan",
    expectedCompletion: "Expected Completion",
    glossary: "Plain-Language Glossary",
    disclaimer: "Disclaimer",
    preparedFor: "Prepared for",
    preparedBy: "Prepared by",
    generatedOn: "Generated on",
    priority: "Priority",
    assumptions: "Assumptions",
    noPolicies: "No policies on record",
    confidential: "Private & Confidential — prepared for the named client only.",
    snapshot: "At a Glance",
    coveragePct: "Life + CI Coverage",
    premiumOfIncome: "Premium / Income",
    totalSumAssured: "Total Sum Assured",
    policies: "Policies",
    nextSteps: "Next Steps",
    ofNeedMet: "of need met",
  },
  zh: {
    reportTitle: "保险规划报告",
    part1Title: "资料收集",
    part2Title: "分析与诊断",
    part3Title: "我们的建议",
    provider: "保险公司",
    policyType: "类型",
    sumAssured: "保额",
    cashValue: "现金价值",
    annualPremium: "年缴保费",
    totalAnnualPremium: "年缴保费合计",
    annualIncome: "年收入",
    totalLiabilities: "负债总额",
    liquidAssets: "流动资产",
    dependents: "受抚养人",
    need: "需求",
    covered: "已覆盖",
    gap: "缺口",
    sufficient: "已足够",
    hasMedical: "已有医疗保障",
    noMedical: "未见医疗保障",
    coverageReview: "保障评估",
    gapAnalysis: "缺口分析",
    scenarios: "真实生活场景",
    recommendations: "建议",
    actionPlan: "行动计划",
    expectedCompletion: "预计完成时间",
    glossary: "名词解释",
    disclaimer: "免责声明",
    preparedFor: "呈交予",
    preparedBy: "顾问",
    generatedOn: "生成日期",
    priority: "优先级",
    assumptions: "计算假设",
    noPolicies: "库内暂无保单",
    confidential: "私人及保密文件 — 仅供本报告指名客户参阅。",
    snapshot: "一览",
    coveragePct: "人寿+重疾覆盖率",
    premiumOfIncome: "保费占收入",
    totalSumAssured: "总保额",
    policies: "保单数",
    nextSteps: "下一步",
    ofNeedMet: "需求已覆盖",
  },
};

const COVERAGE_LABELS: Record<string, [string, string]> = {
  life: ["Life", "人寿"],
  critical_illness: ["Critical Illness", "重疾"],
  medical: ["Medical", "医疗"],
  accident: ["Accident", "意外"],
  disability_income: ["Disability Income", "残疾收入"],
  savings_retirement: ["Savings & Retirement", "储蓄与退休"],
};

const GAP_LABELS: Record<string, [string, string]> = {
  life: ["Life Cover", "人寿保障"],
  ci: ["Critical Illness", "重疾保障"],
};

const pick = (pair: [string, string] | undefined, lang: Language, fallback: string) =>
  pair ? (lang === "zh" ? pair[1] : pair[0]) : fallback;

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Coverage-review level → a 0..4 meter score; -1 = unknown (drawn as outline). */
export function levelScore(level: string): number {
  switch (level) {
    case "adequate": return 4;
    case "fair": return 2;
    case "insufficient": return 1;
    case "none": return 0;
    default: return -1;
  }
}

export interface ReportViewModel {
  meta: ReportMeta;
  labels: Record<LabelKey, string>;
  snapshot: {
    coveragePct: number; // Life+CI covered / need, 0..100
    premiumPctOfIncome: number; // annual premium / annual income, 1 dp
    totalSumAssured: number;
    policyCount: number;
    dependents: number;
  };
  dataGathering: {
    intro: string;
    policies: PolicyOverviewRow[];
    annualPremiumTotal: number;
    facts: Array<{ label: string; value: string }>;
  };
  finding: {
    intro: string;
    gaps: Array<{
      label: string;
      need: number;
      covered: number;
      gap: number;
      coveredPct: number;
      sufficient: boolean;
    }>;
    medical: { hasCover: boolean } | null;
    coverage: Array<{ label: string; level: string; score: number; plain: string }>;
    gapAnalysis: string;
    scenarios: Array<{ title: string; plain: string }>;
    assumptions: string[];
  };
  recommendation: {
    intro: string;
    items: Array<{ priority: number; title: string; plain: string }>;
    actionPlan: string;
    expectedCompletion: string;
  };
  glossary: Array<{ term: string; plain: string }>;
  disclaimer: string;
}

export function buildReportModel(
  content: InsuranceSectionContent,
  meta: ReportMeta,
): ReportViewModel {
  const lang = meta.language;
  const labels = LABELS[lang];
  const cv: ClientView | undefined = content.client_view;

  // --- Part 1: data gathering (facts from cna.inputs, numbers untouched) ---
  const inputs = content.cna.inputs;
  const facts = [
    { label: labels.annualIncome, value: fmtRM(inputs.annual_income) },
    { label: labels.totalLiabilities, value: fmtRM(inputs.liabilities_total) },
    { label: labels.liquidAssets, value: fmtRM(inputs.liquid_assets) },
    { label: labels.dependents, value: String(inputs.dependents ?? 0) },
  ];

  // --- Part 2: finding (numbers from cna.gaps; prose from client_view) ---
  const gaps = content.cna.gaps
    .filter((g) => !g.flag_only)
    .map((g) => {
      const need = g.need ?? 0;
      const covered = g.covered ?? 0;
      return {
        label: pick(GAP_LABELS[g.key], lang, g.label),
        need,
        covered,
        gap: g.gap ?? 0,
        coveredPct: need > 0 ? clampPct((100 * covered) / need) : 100,
        sufficient: (g.gap ?? 0) <= 0,
      };
    });
  const medicalGap = content.cna.gaps.find((g) => g.flag_only);
  const medical = medicalGap ? { hasCover: !!medicalGap.has_cover } : null;

  const coverage = content.coverage_review.map((r, i) => {
    const plain = cv?.coverage_review_plain?.find((c) => c.category === r.category)?.plain ??
      cv?.coverage_review_plain?.[i]?.plain ??
      r.commentary;
    return {
      label: pick(COVERAGE_LABELS[r.category], lang, r.category),
      level: r.level,
      score: levelScore(r.level),
      plain,
    };
  });

  // --- Snapshot dashboard KPIs (deterministic ratios of existing numbers) ---
  const needSum = gaps.reduce((s, g) => s + g.need, 0);
  const coveredForNeed = gaps.reduce((s, g) => s + Math.min(g.covered, g.need), 0);
  const coveragePct = needSum > 0 ? clampPct((100 * coveredForNeed) / needSum) : 100;
  const income = inputs.annual_income ?? 0;
  const premiumPctOfIncome = income > 0
    ? Math.round((1000 * content.annual_premium_total) / income) / 10
    : 0;
  const totalSumAssured = (content.policy_overview ?? []).reduce(
    (s, p) => s + (p.sum_assured ?? 0),
    0,
  );

  const scenarios = cv?.scenarios_plain?.length
    ? cv.scenarios_plain.map((s) => ({ title: s.title, plain: s.plain }))
    : content.scenarios.map((s) => ({
      title: s.title,
      plain: [s.trigger, s.life_impact, s.protection_response]
        .filter(Boolean)
        .join(" "),
    }));

  // --- Part 3: recommendation (priority from base, prose from client_view) ---
  const items = content.recommendations
    .map((r, i) => ({
      priority: r.priority,
      title: cv?.recommendations_plain?.[i]?.title ?? r.title,
      plain: cv?.recommendations_plain?.[i]?.plain ?? r.detail,
    }))
    .sort((a, b) => a.priority - b.priority);

  return {
    meta,
    labels,
    snapshot: {
      coveragePct,
      premiumPctOfIncome,
      totalSumAssured,
      policyCount: (content.policy_overview ?? []).length,
      dependents: inputs.dependents ?? 0,
    },
    dataGathering: {
      intro: cv?.data_gathering_intro ?? "",
      policies: content.policy_overview ?? [],
      annualPremiumTotal: content.annual_premium_total,
      facts,
    },
    finding: {
      intro: cv?.finding_intro ?? "",
      gaps,
      medical,
      coverage,
      gapAnalysis: cv?.gap_analysis_plain ?? content.gap_analysis,
      scenarios,
      assumptions: content.cna.assumptions ?? [],
    },
    recommendation: {
      intro: cv?.recommendation_intro ?? "",
      items,
      actionPlan: content.executive_summary?.action_plan ?? "",
      expectedCompletion: content.executive_summary?.expected_completion_date ?? "",
    },
    glossary: cv?.glossary ?? [],
    disclaimer: cv?.disclaimer ?? "",
  };
}
