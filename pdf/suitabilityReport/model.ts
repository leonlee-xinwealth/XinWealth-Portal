// View model for the Investor Suitability Assessment PDF.
//
// COMPLIANCE CONTRACT (enforced by __tests__/model.test.ts):
//   * Every return figure is rendered as a labelled RANGE, never a single number.
//   * The open-ended top profile renders "12%+ p.a.", never "12% p.a.".
//   * The words guarantee / promise / forecast (and 保证 / 承诺 / 预测) must not
//     appear anywhere in the rendered strings.
// The numbers themselves come from the result row's frozen config_snapshot, not
// from the live rules module, so a reprint of a 2026 assessment in 2028 shows the
// 2026 figures.
// Explicit .js extension: reachable from api/suitability.ts, which Vercel
// transpiles rather than bundles (Node ESM requires the extension at runtime).
import { QUESTION_BY_ID, SUITABILITY_QUESTIONS, optionOf } from "../../lib/suitability/questions.js";
import type {
  AllocationRanges,
  ConfigSnapshot,
  QuestionId,
  Range,
  RedFlag,
  SuitabilityAnswers,
} from "../../lib/suitability/types.js";

export type Lang = "en" | "zh";

/** Shape of a public.suitability_results row plus its parent assessment. */
export interface SuitabilityReportData {
  prospectName: string | null;
  advisorName: string;
  submittedAt: string;
  generatedDate: string;
  language: Lang;
  ruleVersion: string;
  finalProfile: string;
  finalBand: number;
  horizonCeilingBand: number;
  capacityScore: number;
  capacityBand: number;
  toleranceScore: number;
  toleranceBand: number;
  experienceYearsBand: number;
  productLevel: string;
  behaviourConfidence: string;
  expectationGap: string;
  targetReturnPct: number | null;
  redFlags: RedFlag[];
  requiresAdvisorReview: boolean;
  configSnapshot: ConfigSnapshot;
  answers: SuitabilityAnswers;
}

export const L: Record<Lang, Record<string, string>> = {
  en: {
    title: "Investor Suitability Assessment",
    preparedFor: "Prepared for",
    preparedBy: "Prepared by",
    submitted: "Completed",
    generated: "Generated",
    rules: "Rule version",
    yourProfile: "Investor profile",
    characteristics: "What this means",
    horizon: "Suitable investment horizon",
    returnRef: "Indicative historical long-term return range",
    yourExpectation: "Your stated expectation",
    expectationCheck: "Expectation check",
    howDerived: "How this profile was determined",
    capacity: "Risk capacity",
    tolerance: "Risk tolerance",
    horizonCeiling: "Time horizon",
    boundBy: "Determined by",
    allocation: "Indicative strategic allocation",
    defensive: "Defensive",
    growth: "Growth",
    diversifier: "Diversifier",
    capNote: "Growth allocation is limited by your investment horizon.",
    answers: "Your answers",
    disclaimer: "Important information",
    none: "None",
    perYear: "p.a.",
    reviewNote: "Your financial planner will discuss these results with you.",
  },
  zh: {
    title: "投资适当性评估",
    preparedFor: "致",
    preparedBy: "编制",
    submitted: "完成日期",
    generated: "生成日期",
    rules: "规则版本",
    yourProfile: "投资者类型",
    characteristics: "这代表什么",
    horizon: "适合的投资期限",
    returnRef: "历史长期回报参考区间",
    yourExpectation: "你的期望回报",
    expectationCheck: "期望对照",
    howDerived: "此类型的判定依据",
    capacity: "风险承受能力",
    tolerance: "风险承受意愿",
    horizonCeiling: "投资期限",
    boundBy: "决定因素",
    allocation: "策略性资产配置参考",
    defensive: "防御型",
    growth: "成长型",
    diversifier: "分散型",
    capNote: "成长型资产比例已依你的投资期限作出限制。",
    answers: "你的作答",
    disclaimer: "重要提示",
    none: "无",
    perYear: "每年",
    reviewNote: "你的理财规划师会与你讨论这份评估结果。",
  },
};

export const BAND_NAME: Record<number, Record<Lang, string>> = {
  1: { en: "Stable", zh: "稳健型" },
  2: { en: "Balanced", zh: "平衡型" },
  3: { en: "Growth", zh: "成长型" },
  4: { en: "Aggressive Growth", zh: "积极成长型" },
};

export const GAP_TEXT: Record<string, Record<Lang, string>> = {
  ALIGNED: {
    en: "Your return expectation sits within the historical range associated with this profile.",
    zh: "你的回报期望落在此类型对应的历史回报区间之内。",
  },
  MODERATE_GAP: {
    en: "Your target is somewhat above the historical range for this profile. Reaching for more usually means accepting larger swings and deeper losses along the way.",
    zh: "你的目标略高于此类型对应的历史回报区间。若希望争取更高回报，通常需要承担更大的波动与更深的潜在亏损。",
  },
  SIGNIFICANT_GAP: {
    en: "Your target is well above the historical range for this profile. This gap is worth discussing before any investment decision is made.",
    zh: "你的目标明显高于此类型对应的历史回报区间。建议在做出任何投资决定前，先就这一落差进行讨论。",
  },
};

/** "4–6% p.a." / "12%+ p.a." — never a bare single figure. */
export function fmtRange(r: Range | undefined, lang: Lang): string {
  if (!r) return "—";
  const per = lang === "zh" ? "" : ` ${L.en.perYear}`;
  const body = r.max === null || r.max === undefined ? `${r.min}%+` : `${r.min}–${r.max}%`;
  return lang === "zh" ? `${L.zh.perYear} ${body}` : `${body}${per}`;
}

/** The client's stated target, rendered as a band rather than a point value. */
export function fmtTarget(pct: number | null, lang: Lang): string {
  if (pct === null || pct === undefined) return "—";
  // targetReturnPct is the upper bound of the band the client picked; 15 is the
  // sentinel for the open-ended ">12%" option.
  if (pct >= 15) return lang === "zh" ? "每年 12%+" : "12%+ p.a.";
  const lo = Math.max(0, pct - 2);
  return lang === "zh" ? `每年 ${lo}–${pct}%` : `${lo}–${pct}% p.a.`;
}

export function fmtAllocation(a: AllocationRanges | undefined, key: "defensive" | "growth" | "diversifier"): string {
  const r = a?.[key];
  if (!r) return "—";
  return `${r.min}–${r.max}%`;
}

/** Which dimensions actually bound the final band — the advisor's talking point. */
export function bindingDimensions(d: SuitabilityReportData, lang: Lang): string {
  const out: string[] = [];
  if (d.capacityBand === d.finalBand) out.push(L[lang].capacity);
  if (d.toleranceBand === d.finalBand) out.push(L[lang].tolerance);
  if (d.horizonCeilingBand === d.finalBand) out.push(L[lang].horizonCeiling);
  return out.join(lang === "zh" ? " + " : " + ");
}

export interface AnswerRow {
  order: number;
  question: string;
  answer: string;
}

export function buildAnswerRows(answers: SuitabilityAnswers, lang: Lang): AnswerRow[] {
  return SUITABILITY_QUESTIONS.map((q) => {
    const a = answers[q.id as QuestionId];
    let answer: string;
    if (Array.isArray(a)) {
      const parts = a.map((v) => {
        const o = optionOf(q.id, v);
        return o ? (lang === "zh" ? o.zh : o.en) : v;
      });
      answer = parts.length ? parts.join(lang === "zh" ? "、" : ", ") : L[lang].none;
    } else {
      const o = a ? optionOf(q.id, a as string) : undefined;
      answer = o ? (lang === "zh" ? o.zh : o.en) : "—";
    }
    return {
      order: q.order,
      question: lang === "zh" ? QUESTION_BY_ID[q.id].titleZh : QUESTION_BY_ID[q.id].titleEn,
      answer,
    };
  });
}

export const DISCLAIMER: Record<Lang, string> = {
  en:
    "This assessment reflects the answers provided and is intended to support a discussion with your financial planner. It is not personalised investment advice and does not constitute a recommendation of any specific product. Return ranges shown are historical long-term references for the stated risk profile; they describe how such portfolios have behaved in the past and may not repeat. The value of investments can fall as well as rise, and you may get back less than you invested. Allocation ranges are strategic guides, not instructions to buy or sell.",
  zh:
    "本评估依据你所提供的作答生成，用于配合你与理财规划师的讨论。它并非个人化投资建议，也不构成对任何特定产品的推荐。文中所列回报区间为该风险类型的历史长期参考，用以说明此类组合过往的表现形态，未来未必重现。投资价值可升可跌，你所取回的金额可能低于投入本金。资产配置区间为策略性参考，并非买卖指示。",
};
