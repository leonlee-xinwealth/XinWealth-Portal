// Dev harness for the unified CFP client PDF — renders either a realistic
// short-content fixture ("normal") or a worst-case long-content fixture
// ("long", every narrative field 300+ chars of continuous Chinese with no
// spaces, 12 expense categories, 3 goals, all 8 sections) so overflow bugs
// surface before an advisor ever sees them. Not imported by app code.
//
// Usage: npx tsx pdf/cfpReport/renderSmoke.tsx [normal|long] [outPath]
//
// Import-order matters: registerFonts() must run before the CfpReportPdf
// module is loaded, so the font is registered before any StyleSheet using
// fontFamily: "NotoSansSC" is created — hence the dynamic import below.
import path from "path";
import { fileURLToPath } from "url";
import { renderToFile } from "@react-pdf/renderer";
import { registerFonts } from "../insuranceReport/fonts";
import type { CfpReportData, CfpReportSection } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

registerFonts(path.resolve(__dirname, "../../public/fonts/NotoSansSC-Regular.ttf"));

// ------------------------------------------------------------------ helpers
const LONG_ZH_BASE =
  "这是一段完全没有空格的连续中文测试文本，用来验证在真实大语言模型输出较长文字的情况下，报告中的卡片、图表标签、进度条说明与叙述段落是否依然能够正确换行，不会与相邻元素重叠，也不会超出页面边界，同时确保整体排版结果清晰易读、专业美观、符合品牌规范。";

/** Returns `long` (300+ char continuous Chinese) when longMode, else `short`. */
function txt(short: string, longMode: boolean, extra = ""): string {
  if (!longMode) return short;
  return (LONG_ZH_BASE + extra).repeat(2).slice(0, 340);
}

function execSummary(longMode: boolean, topic: string) {
  return {
    findings: txt(`${topic}方面整体表现平稳，收支结构清晰，主要指标处于合理区间。`, longMode, topic),
    action_plan: txt(`建议在未来三个月内按优先级逐步落实${topic}相关的行动项。`, longMode, topic),
    expected_completion_date: longMode ? "持续跟进，预计 6-12 个月内完成第一阶段" : "3 个月内",
    remarks: txt("顾问将于下次会议跟进进度。", longMode, topic),
  };
}

// ------------------------------------------------------------------- baseline
function buildBaseline(longMode: boolean) {
  return {
    age: 38,
    marital_status: "married",
    dependents: 2,
    years_to_retirement: 22,
    retirement_age: 60,
    annual_income: 180000,
    annual_expenses: 108000,
    monthly_essential_expenses: 6500,
    emergency_fund_actual: longMode ? 12000 : 26000,
    emergency_fund_need_high: 39000,
    savings_ratio: longMode ? 0.09 : 0.24,
    debt_service_ratio: longMode ? 0.42 : 0.28,
    solvency_ratio: longMode ? 0.38 : 0.62,
    liquid_assets_after_emergency: 45000,
    annual_surplus: longMode ? 14000 : 62000,
    goal_education_need: 220000,
    assumptions: {
      inflation: 0.03,
      education_inflation: 0.04,
      emergency_months_high: 6,
      client_investment_return: 0.06,
      retirement_replacement_ratio: 0.66,
      withdrawal_rate: 0.04,
      life_expectancy: 85,
      epf_dividend: 0.055,
      investment_return_by_band: { balanced: 0.06 },
    },
  };
}

// -------------------------------------------------------------- section data
function buildCashflow(longMode: boolean): CfpReportSection {
  const expenseCategories = longMode
    ? [
      ["房贷供款", 3200], ["伙食", 1800], ["交通", 900], ["子女教育", 1500],
      ["保险费", 650], ["水电网络", 420], ["医疗保健", 380], ["娱乐消遣", 550],
      ["服饰用品", 300], ["家务助理", 800], ["订阅服务", 150], ["其他杂项", 650],
    ]
    : [["房贷供款", 3200], ["伙食", 1800], ["交通", 900], ["保险费", 650]];
  const incomeCategories = longMode
    ? [["主要薪资", 12000], ["兼职收入", 1500], ["租金收入", 800], ["股息收入", 300]]
    : [["主要薪资", 12000]];

  return {
    section_type: "cashflow_planning",
    status: "approved",
    content: {
      version: 1,
      section_type: "cashflow_planning",
      agent: "little_accountant",
      monthly_income: incomeCategories.reduce((s, [, v]) => s + (v as number), 0),
      monthly_expenses: expenseCategories.reduce((s, [, v]) => s + (v as number), 0),
      monthly_surplus:
        incomeCategories.reduce((s, [, v]) => s + (v as number), 0) -
        expenseCategories.reduce((s, [, v]) => s + (v as number), 0),
      income_breakdown: incomeCategories.map(([category, monthly_amount]) => ({ category, monthly_amount, share: null })),
      expense_breakdown: expenseCategories.map(([category, monthly_amount]) => ({ category, monthly_amount, share: null })),
      asset_transfers_monthly: 500,
      emergency_fund: { need_low: 19500, need_high: 39000, actual: longMode ? 12000 : 26000, months_covered: longMode ? 1.8 : 4.0, shortfall: longMode ? 27000 : 13000, status: longMode ? "insufficient" : "partial" },
      insufficient_data: false,
      executive_summary: execSummary(longMode, "现金流"),
      budget_commentary: txt("客户每月支出以房贷与伙食为主，储蓄率处于健康区间，资产转移部分视为储蓄而非支出。", longMode, "预算"),
      emergency_fund_plan: txt("建议将紧急预备金逐步补足至六个月经常性支出水平，以应对突发状况。", longMode, "紧急预备金"),
      recommendations: [
        { title: "自动化储蓄", detail: "设定每月自动转账至紧急预备金账户。", priority: 1 },
        { title: "检视订阅服务", detail: "定期检视非必要订阅支出。", priority: 2 },
      ],
      assumptions: ["收入与支出按最近一个月的经常性现金流年化"],
    },
  };
}

function buildGoals(longMode: boolean): CfpReportSection {
  const goalsRaw = longMode
    ? [
      { goal_type: "education", name: "长子教育金", target_year: 2038, future_cost: 220000, projected_savings: 95000, on_track: false },
      { goal_type: "house", name: "购置新居", target_year: 2032, future_cost: 650000, projected_savings: 610000, on_track: true },
      { goal_type: "business", name: "创业基金", target_year: 2030, future_cost: 150000, projected_savings: 40000, on_track: false },
    ]
    : [
      { goal_type: "education", name: "长子教育金", target_year: 2038, future_cost: 220000, projected_savings: 180000, on_track: true },
    ];

  const goals = goalsRaw.map((g, i) => ({
    id: `goal-${i}`,
    goal_type: g.goal_type,
    name: g.name,
    target_year: g.target_year,
    years_to_target: g.target_year - 2026,
    target_amount_today: Math.round(g.future_cost * 0.8),
    inflation_used: 0.04,
    future_cost: g.future_cost,
    current_saved: Math.round(g.projected_savings * 0.6),
    monthly_contribution: 800,
    projected_savings: g.projected_savings,
    gap: Math.max(0, g.future_cost - g.projected_savings),
    required_monthly: Math.max(0, Math.round((g.future_cost - g.projected_savings) / 60)),
    on_track: g.on_track,
    commentary: txt(`${g.name}目前的储蓄进度需要持续关注，建议按计划定期检视。`, longMode, g.name),
  }));

  return {
    section_type: "goals_planning",
    status: "approved",
    content: {
      version: 1,
      section_type: "goals_planning",
      agent: "goal_planner",
      goals,
      total_required_monthly: goals.reduce((s, g) => s + g.required_monthly, 0),
      education_future_cost_total: goals.filter((g) => g.goal_type === "education").reduce((s, g) => s + g.future_cost, 0),
      return_rate_used: 0.06,
      no_goals: false,
      executive_summary: execSummary(longMode, "目标规划"),
      overview: txt("客户设定的人生目标涵盖教育、置业与创业，整体所需月供需与现有盈余对照检视。", longMode, "目标总览"),
      recommendations: [
        { title: "提高月供", detail: "建议将部分盈余优先分配至教育目标。", priority: 1 },
      ],
      assumptions: ["教育类目标按 4% 通胀、其余按一般通胀假设推算未来成本"],
      client_view: {
        version: 1,
        language: longMode ? "zh" : "zh",
        intro: txt("以下是您各项人生目标的储蓄进度总览。", longMode, "目标简介"),
        findings_plain: goals.map((g) => ({
          title: g.name,
          plain: txt(`${g.name}的储蓄进度说明，帮助您了解目前是否需要加大投入。`, longMode, g.name),
        })),
        recommendations_plain: [
          { title: "提高月供", plain: txt("建议适度提高每月储蓄金额，加快达成目标的速度。", longMode, "建议") },
        ],
        glossary: [{ term: "目标缺口", plain: "未来所需金额与预计可累积金额之间的差距。" }],
        disclaimer: "本部分为一般性规划参考，实际投资回报可能有所波动。",
      },
    },
  };
}

function buildInsurance(longMode: boolean): CfpReportSection {
  const gaps = [
    { key: "life", label: "人寿保障", need: 1250000, covered: longMode ? 300000 : 950000, gap: longMode ? 950000 : 300000 },
    { key: "ci", label: "重疾保障", need: 540000, covered: longMode ? 100000 : 400000, gap: longMode ? 440000 : 140000 },
    { key: "medical", label: "医疗保障", flag_only: true, has_cover: !longMode },
  ];
  return {
    section_type: "insurance_planning",
    status: "approved",
    content: {
      version: 1,
      section_type: "insurance_planning",
      agent: "insurance_brain",
      cna: {
        assumptions: ["收入替代年数按 10 年计算"],
        inputs: { annual_income: 180000, liabilities_total: 450000, liquid_assets: 45000, life_cover: 300000, ci_cover: 100000, has_medical: !longMode, dependents: 2 },
        needs: { income_replacement: 1800000, liabilities: 450000, education: 220000, total_life: 1250000, ci: 540000 },
        resources: { life_cover: 300000, ci_cover: 100000, liquid_assets: 45000 },
        gaps,
        insufficient: false,
      },
      annual_premium_total: 4800,
      premium_topup_estimate: 6200,
      executive_summary: execSummary(longMode, "保险规划"),
      coverage_review: [
        { category: "life", level: longMode ? "insufficient" : "fair", commentary: "人寿保障水平需要关注。" },
        { category: "critical_illness", level: longMode ? "insufficient" : "fair", commentary: "重疾保障存在缺口。" },
        { category: "medical", level: longMode ? "none" : "adequate", commentary: "医疗保障情况。" },
        { category: "accident", level: "unknown", commentary: "暂无相关保单资料。" },
      ],
      gap_analysis: txt("若家庭经济支柱不幸身故或罹患重疾，现有保障不足以覆盖房贷及子女教育支出，家庭可能面临被迫变卖资产的风险。", longMode, "缺口分析"),
      recommendations: [
        { title: "补足人寿保障", detail: "建议补足人寿保障缺口，优先覆盖房贷余额。", priority: 1 },
        { title: "补足重疾保障", detail: "建议提高重疾保障额度。", priority: 2 },
      ],
      scenarios: [
        { title: "身故风险", trigger: "家庭经济支柱突然身故", life_impact: "家庭房贷无法偿还，面临被迫卖房风险。", protection_response: "补足的人寿保障可清偿房贷余额，让家人保住居所。" },
        { title: "重疾风险", trigger: "确诊严重疾病", life_impact: "治疗费用与收入中断双重打击家庭现金流。", protection_response: "重疾保障金可弥补收入损失并支付医疗费用。" },
      ],
      client_view: {
        version: 1,
        language: "zh",
        data_gathering_intro: txt("我们整理了您目前的保单资料与家庭财务状况，以下是保障健康检查结果。", longMode, "资料收集"),
        finding_intro: txt("以下是我们为您做的保障健康检查结果，请放心查看，我们会用简单易懂的方式说明。", longMode, "检查结果"),
        gap_analysis_plain: txt("若您或家庭经济支柱发生意外，目前的保障可能不足以覆盖房贷与子女教育开销，家人可能需要变卖资产应急。", longMode, "缺口说明"),
        coverage_review_plain: [
          { category: "life", plain: txt("您的人寿保障目前偏低，建议尽快补足。", longMode, "人寿说明") },
          { category: "critical_illness", plain: txt("重疾保障存在缺口，建议关注。", longMode, "重疾说明") },
          { category: "medical", plain: "医疗保障情况说明。" },
        ],
        scenarios_plain: [
          { title: "身故风险", plain: txt("如果家庭经济支柱突然身故，家人可能无法偿还房贷，补足保障能让家人保住家园。", longMode, "身故场景") },
          { title: "重疾风险", plain: txt("确诊重疾时，医疗费用与收入中断会同时冲击家庭现金流，重疾保障金能提供缓冲。", longMode, "重疾场景") },
        ],
        recommendation_intro: txt("以下是我们建议您优先考虑的下一步行动。", longMode, "建议简介"),
        recommendations_plain: [
          { title: "补足人寿保障", plain: txt("建议优先补足人寿保障，确保房贷有着落。", longMode, "建议一") },
          { title: "补足重疾保障", plain: txt("建议提高重疾保障额度，减轻治疗期间的财务压力。", longMode, "建议二") },
        ],
        glossary: [
          { term: "保额", plain: "发生保险事故时可获得的赔付金额。" },
          { term: "CNA 资本需求分析", plain: "用来计算您需要多少保障的一种方法。" },
        ],
        disclaimer: "本部分为一般性保障回顾，并非个人化投资建议，具体数字仅供参考。",
      },
    },
  };
}

function buildInvestment(longMode: boolean): CfpReportSection {
  const currentAllocation = [
    { bucket: "equity", amount: longMode ? 15000 : 120000, pct: longMode ? 30 : 40 },
    { bucket: "bond", amount: longMode ? 5000 : 90000, pct: longMode ? 10 : 30 },
    { bucket: "cash", amount: longMode ? 28000 : 75000, pct: longMode ? 56 : 25 },
    { bucket: "alternatives", amount: longMode ? 2000 : 15000, pct: longMode ? 4 : 5 },
  ];
  return {
    section_type: "investment_planning",
    status: "approved",
    content: {
      version: 1,
      section_type: "investment_planning",
      agent: "investment_master",
      risk_band: "balanced",
      risk_band_defaulted: false,
      investable_total: currentAllocation.reduce((s, r) => s + r.amount, 0),
      current_allocation: currentAllocation,
      target_allocation: [
        { bucket: "equity", amount: 150000, pct: 50 },
        { bucket: "bond", amount: 105000, pct: 35 },
        { bucket: "cash", amount: 30000, pct: 10 },
        { bucket: "alternatives", amount: 15000, pct: 5 },
      ],
      drift: [{ bucket: "equity", current_pct: 30, target_pct: 50, drift_pp: -20 }],
      rebalancing_actions: [{ bucket: "equity", action: "increase", amount: 30000 }],
      expected_return: 0.06,
      expected_vol: 0.1,
      monthly_surplus: 5000,
      no_investable: false,
      wealth_projection: [{ year: 5, projected: 420000 }, { year: 10, projected: 780000 }, { year: 15, projected: 1250000 }],
      executive_summary: execSummary(longMode, "投资规划"),
      allocation_review: txt("客户现金比重偏高，长期而言可能被通胀侵蚀购买力，建议逐步提高股票类资产配置比例。", longMode, "配置检视"),
      rebalancing_plan: txt("建议分阶段将闲置现金转入股票类资产，避免一次性择时风险。", longMode, "再平衡计划"),
      recommendations: [
        { title: "分批加仓股票资产", detail: "建议以定期定额方式逐步提高股票配置。", priority: 1 },
      ],
      assumptions: ["模型组合按风险属性五档配置"],
    },
  };
}

function buildRetirement(longMode: boolean): CfpReportSection {
  const capitalNeeded = 2400000;
  const totalProjected = longMode ? 980000 : 2100000;
  return {
    section_type: "retirement_planning",
    status: "approved",
    content: {
      version: 1,
      section_type: "retirement_planning",
      agent: "investment_master",
      insufficient_data: false,
      years_to_retirement: 22,
      retirement_years: 25,
      income_need_at_retirement: 96000,
      capital_needed: capitalNeeded,
      epf_balance: 320000,
      annual_epf_contribution: 41400,
      epf_projected: longMode ? 650000 : 1400000,
      prs_balance: 20000,
      prs_projected: longMode ? 60000 : 150000,
      other_investable: 100000,
      other_projected: longMode ? 270000 : 550000,
      total_projected: totalProjected,
      gap: Math.max(0, capitalNeeded - totalProjected),
      required_monthly_topup: longMode ? 3800 : 900,
      on_track: totalProjected >= capitalNeeded,
      replacement_ratio_used: 0.66,
      inflation_used: 0.03,
      withdrawal_rate_used: 0.04,
      life_expectancy_used: 85,
      epf_dividend_used: 0.055,
      investment_return_used: 0.06,
      depletion_age: longMode ? 78 : null,
      survives_to_85: !longMode,
      survives_to_100: !longMode,
      post_retirement_rate_used: 0.055,
      executive_summary: execSummary(longMode, "退休规划"),
      gap_analysis: txt("依目前储蓄速度推算，退休资金可能无法支撑至预期寿命，建议尽快提高退休储蓄比例。", longMode, "退休缺口"),
      funding_plan: txt("建议优先提高 EPF 自愿供款，其次考虑 PRS 供款以享有税务减免。", longMode, "资金筹措"),
      recommendations: [
        { title: "提高 EPF 自愿供款", detail: "建议每月额外供款以加速累积退休资本。", priority: 1 },
      ],
      assumptions: ["EPF 存款按 5.5% 年化股息率推算"],
      client_view: {
        version: 1,
        language: "zh",
        intro: txt("以下是您退休资金准备情况的总览。", longMode, "退休简介"),
        findings_plain: [
          { title: "资金缺口", plain: txt("目前的退休储蓄进度距离目标尚有距离，需要及早规划。", longMode, "缺口说明") },
        ],
        recommendations_plain: [
          { title: "提高供款", plain: txt("建议尽快提高每月退休储蓄金额。", longMode, "建议说明") },
        ],
        glossary: [{ term: "提领率", plain: "退休后每年从累积资本中提取的比例。" }],
        disclaimer: "退休资金推算基于既定假设，实际结果可能因市场情况而有所不同。",
      },
    },
  };
}

function buildTax(longMode: boolean): CfpReportSection {
  return {
    section_type: "tax_planning",
    status: "approved",
    content: {
      version: 1,
      section_type: "tax_planning",
      agent: "tax_expert",
      executive_summary: execSummary(longMode, "税务筹划"),
      tax_position: txt("客户目前适用边际税率处于中等水平，尚有可运用的税务减免额度未充分利用。", longMode, "税务状况"),
      optimization: txt("建议善用 PRS 供款、教育与医疗保险的税务减免额度，以降低应课税收入。", longMode, "优化建议"),
      recommendations: [
        { title: "善用 PRS 减免", detail: "每年供款 PRS 至上限以享有税务减免。", priority: 1 },
      ],
      disclaimer: "税务相关数字基于现行税务规则与税率计算，相关规则可能随时调整。",
      assumptions: ["按 2026 年度税率表估算"],
    },
  };
}

function buildLegacy(longMode: boolean): CfpReportSection {
  return {
    section_type: "legacy_planning",
    status: "approved",
    content: {
      version: 1,
      section_type: "legacy_planning",
      agent: "asset_expert",
      executive_summary: execSummary(longMode, "财富传承"),
      estate_review: txt("客户目前尚未立下遗嘱，资产分配一旦发生变故将依据法定继承程序处理，可能耗时且产生额外成本。", longMode, "遗产检视"),
      readiness: txt("建议尽快咨询律师拟定遗嘱，并检视保单受益人安排是否与传承意愿一致。", longMode, "准备度"),
      recommendations: [
        { title: "拟定遗嘱", detail: "建议尽快咨询律师拟定遗嘱。", priority: 1 },
      ],
      disclaimer: "本部分不构成法律意见，请咨询专业律师。",
      assumptions: ["遗产分配假设按马来西亚现行继承法处理"],
    },
  };
}

function buildFinancialHealth(longMode: boolean): CfpReportSection {
  const annualSurplus = longMode ? 14000 : 62000;
  const lines = [
    { key: "protection", label_zh: "保障缺口（估算保费）", label_en: "Protection top-up", required_annual: 6200, allocated_annual: longMode ? 6200 : 6200, deferred_annual: 0 },
    { key: "emergency", label_zh: "紧急预备金补足", label_en: "Emergency fund build-up", required_annual: 27000, allocated_annual: longMode ? 6800 : 13000, deferred_annual: longMode ? 20200 : 0 },
    { key: "retirement", label_zh: "退休储蓄", label_en: "Retirement top-up", required_annual: longMode ? 45600 : 10800, allocated_annual: longMode ? 1000 : 10800, deferred_annual: longMode ? 44600 : 0 },
    { key: "goals", label_zh: "人生目标储蓄", label_en: "Goal funding", required_annual: 18000, allocated_annual: 0, deferred_annual: longMode ? 18000 : 18000 },
    { key: "wealth", label_zh: "财富增值（余量投资）", label_en: "Wealth building", required_annual: 0, allocated_annual: longMode ? 0 : 13200, deferred_annual: 0 },
  ];
  return {
    section_type: "financial_health",
    status: "approved",
    content: {
      version: 1,
      section_type: "financial_health",
      agent: "chief_planner",
      health_score: longMode ? 38 : 74,
      score_components: [
        { key: "emergency", label_zh: "紧急预备金", score: longMode ? 31 : 67, weight: 0.2 },
        { key: "savings", label_zh: "储蓄率", score: longMode ? 45 : 100, weight: 0.15 },
        { key: "debt", label_zh: "偿债压力", score: longMode ? 30 : 92, weight: 0.15 },
        { key: "protection", label_zh: "保障覆盖度", score: longMode ? 28 : 74, weight: 0.25 },
        { key: "retirement", label_zh: "退休资金覆盖度", score: longMode ? 41 : 88, weight: 0.25 },
      ],
      budget: {
        annual_surplus: annualSurplus,
        required_total: lines.reduce((s, l) => s + l.required_annual, 0),
        over_budget: longMode,
        lines,
      },
      wealth_freedom: {
        passive_income_monthly: longMode ? 300 : 2600,
        monthly_expenses: 9000,
        ratio: longMode ? 0.033 : 0.29,
        stage: longMode ? 1 : 2,
        next_stage_gap_monthly: longMode ? 1950 : 6900,
      },
      missing_modules: [],
      ratios_summary: { savings_ratio: longMode ? 0.09 : 0.24, debt_service_ratio: longMode ? 0.42 : 0.28, solvency_ratio: longMode ? 0.38 : 0.62, emergency_months_target: 6 },
      executive_summary: execSummary(longMode, "整体财务健康"),
      overall_assessment: txt("整体健康评分反映家庭在保障与退休储备方面仍有提升空间，储蓄率与偿债压力表现相对稳健。", longMode, "整体评估"),
      priority_plan: txt("按照保障优先、紧急预备金次之、退休与目标储蓄再其后的顺序分配年度盈余，若盈余不足以覆盖全部需求，将按优先级顺延部分项目。", longMode, "分阶段计划"),
      recommendations: [
        { title: "优先补足保障缺口", detail: "保障是家庭财务安全网的第一道防线。", priority: 1 },
        { title: "加速紧急预备金累积", detail: "建议每月固定转入紧急预备金账户。", priority: 2 },
        { title: "提高退休储蓄比例", detail: "尽早提高退休储蓄可大幅降低未来所需月供。", priority: 3 },
      ],
      assumptions: ["预算对账按固定优先级分配年度盈余：保障 → 紧急预备金 → 退休 → 目标 → 财富增值"],
    },
  };
}

// --------------------------------------------------------------- fixtures
function buildFixture(longMode: boolean): CfpReportData {
  return {
    clientName: longMode ? "陈家豪（测试超长内容客户档案名称示例）" : "陈家豪",
    advisorName: "Leon Lee",
    advisorEmail: "leon3913.fa@gmail.com",
    period: "2026 年年度财务规划报告",
    generatedDate: "2026-07-19",
    language: "zh",
    hasUnapproved: longMode,
    client: {
      date_of_birth: "1988-03-14",
      marital_status: "married",
      number_of_dependants: 2,
      occupation: "工程师",
      employment_status: "employed",
      retirement_age: 60,
    },
    baseline: buildBaseline(longMode),
    sections: [
      buildCashflow(longMode),
      buildGoals(longMode),
      buildInsurance(longMode),
      buildInvestment(longMode),
      buildRetirement(longMode),
      buildTax(longMode),
      buildLegacy(longMode),
      buildFinancialHealth(longMode),
    ],
    assets: [
      { asset_type: "property", name: "自住房产", current_value: 850000 },
      { asset_type: "epf_account_1", name: "EPF 户口一", current_value: 320000 },
      { asset_type: "stock", name: "股票投资组合", current_value: 120000 },
      { asset_type: "cash", name: "银行存款", current_value: 45000 },
    ],
    liabilities: [
      { liability_type: "mortgage", name: "房屋贷款", outstanding_balance: 450000 },
      { liability_type: "car_loan", name: "车贷", outstanding_balance: 65000 },
    ],
  };
}

const NORMAL_FIXTURE = buildFixture(false);
const LONG_FIXTURE = buildFixture(true);

// ---------------------------------------------------------------------- run
(async () => {
  const { default: CfpReportPdf } = await import("./CfpReportPdf");
  const which = process.argv[2] ?? "long";
  const data = which === "long" ? LONG_FIXTURE : NORMAL_FIXTURE;
  const out = path.resolve(process.argv[3] ?? path.resolve(__dirname, "cfp-smoke.pdf"));
  await renderToFile(<CfpReportPdf data={data} />, out);
  console.log("ok", out);
})();
