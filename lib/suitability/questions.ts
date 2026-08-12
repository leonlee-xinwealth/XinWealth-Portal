// The 15 Investor Suitability Assessment questions, bilingual, with scoring
// metadata attached to each OPTION rather than held in a parallel table. If you
// add or reorder an option, its points travel with it — questions.test.ts pins
// the resulting dimension maxima against the band cut-points in rules.ts, so a
// drift between copy and scoring fails the build rather than silently
// mis-profiling a client.
//
// Option `value` codes are persisted to suitability_assessments.answers and
// snapshotted into suitability_results.answers_snapshot. NEVER renumber or
// reuse a code — old rows would be reinterpreted.
//
// Which question feeds what:
//   Q01, Q15          narrative context only, never scored
//   Q02               time-horizon ceiling
//   Q03, Q04, Q05     risk capacity (0-3 each, max 9)
//   Q06, Q07          investment experience -> confidence, never an upgrade
//   Q08, Q09          behaviour -> confidence, never an upgrade
//   Q10-Q13           risk tolerance (max 9)
//   Q14               expectation gap only
import type { QuestionId, SuitabilityOption, SuitabilityQuestion } from "./types";

export const SUITABILITY_QUESTIONS: SuitabilityQuestion[] = [
  // ── Q01 ── narrative only ───────────────────────────────────────────────
  {
    id: "investment_objective",
    order: 1,
    dimension: null,
    control: "single",
    titleEn: "What is your primary investment objective?",
    titleZh: "你投资的主要目标是什么？",
    options: [
      { value: "capital_preservation", en: "Preserve capital and beat inflation", zh: "保本，并跑赢通胀" },
      { value: "regular_income", en: "Generate a regular income stream", zh: "创造稳定的现金流收入" },
      { value: "balanced_growth", en: "Steady long-term growth with moderate volatility", zh: "长期稳健增值，可接受适度波动" },
      { value: "capital_growth", en: "Maximise long-term capital growth", zh: "追求长期资本增值最大化" },
    ],
  },

  // ── Q02 ── time horizon ceiling ─────────────────────────────────────────
  {
    id: "investment_horizon",
    order: 2,
    dimension: null,
    control: "single",
    titleEn: "How long can you leave this money invested before you need it?",
    titleZh: "这笔资金你预计可以投资多久才会动用？",
    helpEn: "Answer for the money you plan to invest, not your total savings.",
    helpZh: "请以你打算投资的这笔钱为准，而非全部储蓄。",
    options: [
      { value: "lt_1y", en: "Less than 1 year", zh: "1年以内", meta: { horizonCeiling: 1 } },
      { value: "1_3y", en: "1–3 years", zh: "1–3年", meta: { horizonCeiling: 1 } },
      { value: "3_5y", en: "3–5 years", zh: "3–5年", meta: { horizonCeiling: 2 } },
      { value: "5_10y", en: "5–10 years", zh: "5–10年", meta: { horizonCeiling: 4 } },
      { value: "gt_10y", en: "More than 10 years", zh: "10年以上", meta: { horizonCeiling: 4 } },
    ],
  },

  // ── Q03 ── capacity ─────────────────────────────────────────────────────
  {
    id: "liquidity_backup",
    order: 3,
    dimension: "capacity",
    control: "single",
    titleEn: "Aside from this investment, how many months of expenses could you cover from cash savings?",
    titleZh: "除了这笔投资，你的现金储备可以支撑几个月的生活开销？",
    options: [
      { value: "gte_12m", en: "12 months or more", zh: "12个月或以上", points: 3 },
      { value: "6_12m", en: "6–12 months", zh: "6–12个月", points: 2 },
      { value: "3_6m", en: "3–6 months", zh: "3–6个月", points: 1 },
      { value: "lt_3m", en: "Less than 3 months", zh: "不足3个月", points: 0 },
    ],
  },

  // ── Q04 ── capacity ─────────────────────────────────────────────────────
  {
    id: "income_stability",
    order: 4,
    dimension: "capacity",
    control: "single",
    titleEn: "How stable and predictable is your income?",
    titleZh: "你的收入有多稳定、可预测？",
    options: [
      { value: "very_stable", en: "Very stable, and expected to grow", zh: "非常稳定，并预期会增长", points: 3 },
      { value: "stable", en: "Stable and predictable", zh: "稳定且可预测", points: 2 },
      { value: "variable", en: "Variable — it fluctuates year to year", zh: "浮动——每年会有波动", points: 1 },
      { value: "unstable", en: "Unstable, or I have no regular income", zh: "不稳定，或目前没有固定收入", points: 0 },
    ],
  },

  // ── Q05 ── capacity (+ RF04) ────────────────────────────────────────────
  {
    id: "capital_concentration",
    order: 5,
    dimension: "capacity",
    control: "single",
    titleEn: "What share of your total investable assets will this investment represent?",
    titleZh: "这笔投资占你可投资资产总额的比例是多少？",
    options: [
      { value: "lt_10", en: "Less than 10%", zh: "低于 10%", points: 3 },
      { value: "10_25", en: "10–25%", zh: "10–25%", points: 2 },
      { value: "25_50", en: "25–50%", zh: "25–50%", points: 1 },
      { value: "gt_50", en: "More than 50%", zh: "超过 50%", points: 0, meta: { concentrationOver50: true } },
    ],
  },

  // ── Q06 ── experience (never upgrades the profile) ──────────────────────
  {
    id: "investment_experience_years",
    order: 6,
    dimension: null,
    control: "single",
    titleEn: "How many years of investing experience do you have?",
    titleZh: "你有多少年的投资经验？",
    options: [
      { value: "none", en: "No experience", zh: "没有经验", meta: { experienceYearsBand: 0 } },
      { value: "lt_3y", en: "Less than 3 years", zh: "少于3年", meta: { experienceYearsBand: 1 } },
      { value: "3_5y", en: "3–5 years", zh: "3–5年", meta: { experienceYearsBand: 2 } },
      { value: "5_10y", en: "5–10 years", zh: "5–10年", meta: { experienceYearsBand: 3 } },
      { value: "gt_10y", en: "More than 10 years", zh: "10年以上", meta: { experienceYearsBand: 4 } },
    ],
  },

  // ── Q07 ── experience, multi-select ─────────────────────────────────────
  {
    id: "investment_products",
    order: 7,
    dimension: null,
    control: "multi",
    titleEn: "Which of these have you personally invested in before?",
    titleZh: "以下哪些产品你曾经亲自投资过？",
    helpEn: "Select all that apply. Select nothing if none.",
    helpZh: "可多选。若都没有，请不要勾选任何一项。",
    options: [
      { value: "cash", en: "Cash / savings accounts", zh: "现金 / 储蓄账户", meta: { productLevel: "BASIC" } },
      { value: "fd", en: "Fixed deposits", zh: "定期存款", meta: { productLevel: "BASIC" } },
      { value: "bond", en: "Bonds / sukuk", zh: "债券 / 伊斯兰债券", meta: { productLevel: "INTERMEDIATE" } },
      { value: "unit_trust", en: "Unit trusts / mutual funds", zh: "信托基金 / 共同基金", meta: { productLevel: "INTERMEDIATE" } },
      { value: "etf", en: "ETFs", zh: "交易所交易基金（ETF）", meta: { productLevel: "INTERMEDIATE" } },
      { value: "equity", en: "Shares / equities", zh: "股票", meta: { productLevel: "INTERMEDIATE" } },
      { value: "reit", en: "REITs", zh: "房地产投资信托（REIT）", meta: { productLevel: "INTERMEDIATE" } },
      { value: "private_credit", en: "Private credit", zh: "私募信贷", meta: { productLevel: "ADVANCED" } },
      { value: "alternative", en: "Alternative investments", zh: "另类投资", meta: { productLevel: "ADVANCED" } },
      { value: "private_equity", en: "Private equity", zh: "私募股权", meta: { productLevel: "ADVANCED" } },
    ],
  },

  // ── Q08 ── behaviour ────────────────────────────────────────────────────
  {
    id: "market_drawdown_experience",
    order: 8,
    dimension: null,
    control: "single",
    titleEn: "Have you ever held investments through a major market decline?",
    titleZh: "你是否曾经历过市场大幅下跌，并且当时持有投资？",
    options: [
      { value: "never_invested", en: "No — I had no investments at the time", zh: "没有——当时我没有投资", meta: { drawdownOver20: false } },
      { value: "small_decline", en: "Yes, but only a modest decline (under 20%)", zh: "有，但跌幅不大（20%以内）", meta: { drawdownOver20: false } },
      { value: "over_20", en: "Yes — I held through a decline of more than 20%", zh: "有——我经历过超过 20% 的跌幅", meta: { drawdownOver20: true } },
    ],
  },

  // ── Q09 ── behaviour ────────────────────────────────────────────────────
  {
    id: "drawdown_reaction",
    order: 9,
    dimension: null,
    control: "single",
    titleEn: "In that decline — or if one happened tomorrow — what did or would you do?",
    titleZh: "在那次下跌中——或假设明天就发生——你当时／会怎么做？",
    options: [
      { value: "sold_all", en: "Sell everything to stop the losses", zh: "全部卖出，止损离场", meta: { panicSold: true } },
      { value: "sold_some", en: "Sell part of the portfolio to reduce risk", zh: "卖出一部分，降低风险", meta: { panicSold: true } },
      { value: "held", en: "Hold and wait for recovery", zh: "继续持有，等待回升", meta: { panicSold: false } },
      { value: "bought_more", en: "Invest more while prices are low", zh: "趁低加码买入", meta: { panicSold: false } },
    ],
  },

  // ── Q10 ── tolerance, max 1 ─────────────────────────────────────────────
  {
    id: "loss_3_percent_reaction",
    order: 10,
    dimension: "tolerance",
    control: "single",
    titleEn: "Your portfolio falls 3% in a month. How do you feel?",
    titleZh: "你的投资组合在一个月内下跌 3%。你的感受是？",
    options: [
      { value: "uncomfortable", en: "Uncomfortable — I would want to act", zh: "不安——我会想做点什么", points: 0 },
      { value: "acceptable", en: "Acceptable — normal short-term movement", zh: "可以接受——属于正常的短期波动", points: 1 },
    ],
  },

  // ── Q11 ── tolerance, max 2 ─────────────────────────────────────────────
  {
    id: "loss_10_percent_reaction",
    order: 11,
    dimension: "tolerance",
    control: "single",
    titleEn: "Your portfolio falls 10%. What would you do?",
    titleZh: "你的投资组合下跌 10%。你会怎么做？",
    options: [
      { value: "exit", en: "Exit the investment", zh: "退出这笔投资", points: 0 },
      { value: "reduce", en: "Reduce my exposure", zh: "减少投资比重", points: 1 },
      { value: "hold", en: "Stay invested", zh: "继续持有", points: 2 },
    ],
  },

  // ── Q12 ── tolerance, max 3 ─────────────────────────────────────────────
  {
    id: "loss_20_percent_reaction",
    order: 12,
    dimension: "tolerance",
    control: "single",
    titleEn: "Your portfolio falls 20%. What would you do?",
    titleZh: "你的投资组合下跌 20%。你会怎么做？",
    options: [
      { value: "exit_all", en: "Exit everything immediately", zh: "立刻全部退出", points: 0 },
      { value: "reduce", en: "Reduce my exposure significantly", zh: "大幅减少投资比重", points: 1 },
      { value: "hold", en: "Stay invested and wait", zh: "继续持有，耐心等待", points: 2 },
      { value: "add", en: "Add more at lower prices", zh: "趁低加码买入", points: 3 },
    ],
  },

  // ── Q13 ── tolerance, max 3 ─────────────────────────────────────────────
  {
    id: "principal_preference",
    order: 13,
    dimension: "tolerance",
    control: "single",
    titleEn: "Which statement best describes your attitude to your capital?",
    titleZh: "以下哪一句最贴近你对本金的态度？",
    options: [
      { value: "no_loss", en: "I cannot accept any loss of capital", zh: "我无法接受本金有任何亏损", points: 0 },
      { value: "small_loss", en: "I can accept a small loss for modestly better returns", zh: "为了略高的回报，我可以接受小幅亏损", points: 1 },
      { value: "moderate_loss", en: "I can accept meaningful swings for higher long-term returns", zh: "为了更高的长期回报，我可以接受明显波动", points: 2 },
      { value: "large_loss", en: "I can accept large swings in pursuit of maximum growth", zh: "为了追求最大增值，我可以接受大幅波动", points: 3 },
    ],
  },

  // ── Q14 ── expectation gap only ─────────────────────────────────────────
  {
    id: "return_expectation",
    order: 14,
    dimension: null,
    control: "single",
    titleEn: "What average annual return are you hoping for over the long term?",
    titleZh: "长期而言，你希望获得的平均年化回报大约是多少？",
    options: [
      { value: "4_6", en: "4–6% per year", zh: "每年 4–6%", meta: { targetReturnPct: 6 } },
      { value: "6_8", en: "6–8% per year", zh: "每年 6–8%", meta: { targetReturnPct: 8 } },
      { value: "8_10", en: "8–10% per year", zh: "每年 8–10%", meta: { targetReturnPct: 10 } },
      { value: "10_12", en: "10–12% per year", zh: "每年 10–12%", meta: { targetReturnPct: 12 } },
      // Open-ended band. 15 is the value used to size the gap; anything above a
      // profile's return_max by more than 2pp is SIGNIFICANT, which is the
      // intended reading of "12%+" against every capped profile.
      { value: "gt_12", en: "More than 12% per year", zh: "每年 12% 以上", meta: { targetReturnPct: 15 } },
    ],
  },

  // ── Q15 ── narrative only ───────────────────────────────────────────────
  {
    id: "investment_preference",
    order: 15,
    dimension: null,
    control: "single",
    titleEn: "How would you prefer your investments to be managed?",
    titleZh: "你希望你的投资以什么方式管理？",
    options: [
      { value: "fully_advised", en: "Guided by my adviser at every step", zh: "每一步都由理财规划师引导" },
      { value: "collaborative", en: "Decide together with my adviser", zh: "与理财规划师共同决定" },
      { value: "self_directed", en: "I decide, with my adviser as a sounding board", zh: "由我决定，理财规划师提供参考意见" },
    ],
  },
];

export const QUESTION_BY_ID: Record<QuestionId, SuitabilityQuestion> =
  SUITABILITY_QUESTIONS.reduce((acc, q) => {
    acc[q.id] = q;
    return acc;
  }, {} as Record<QuestionId, SuitabilityQuestion>);

export const QUESTION_IDS: QuestionId[] = SUITABILITY_QUESTIONS.map((q) => q.id);

export function optionOf(id: QuestionId, value: string): SuitabilityOption | undefined {
  return QUESTION_BY_ID[id]?.options.find((o) => o.value === value);
}
