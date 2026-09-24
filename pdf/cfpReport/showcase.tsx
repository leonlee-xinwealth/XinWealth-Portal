// Fixture harness for the 29-page report.
//
// Renders the REAL page components (pdf/cfpReport/pages) over a synthetic
// client, so what this produces is what production produces — only the data
// differs. __tests__/pageCount.test.ts and __tests__/pageOrder.test.ts both
// drive this file, which is how they cover the shipping component tree.
//
//   npx tsx pdf/cfpReport/showcase.tsx out.pdf          # full fixture
//   npx tsx pdf/cfpReport/showcase.tsx out.pdf --sparse # nothing generated yet
//
// The sparse run is the one that matters most: a half-generated report is the
// normal state of an in-progress plan, and every module page has to degrade to
// its empty state without changing the page count.

import path from "path";
import fs from "fs";
import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { registerCfpFonts } from "./fonts";
import { CfpReportPdf } from "./CfpReportPdf";
import type { CfpReportData } from "./types";

registerCfpFonts(path.resolve("public/fonts"));

/**
 * Node cannot hand react-pdf a URL, so the harness reads the bytes. The browser
 * export passes a path instead — see exportCfpReport.tsx.
 */
function localPng(rel: string) {
  const abs = path.resolve(rel);
  return fs.existsSync(abs) ? { data: fs.readFileSync(abs), format: "png" as const } : undefined;
}

const BRAND = {
  logo: localPng("public/brand/xinwealth-logo.png"),
  logoReversed: localPng("public/brand/xinwealth-logo-reversed.png"),
};

// --------------------------------------------------------------------------
// Fixture — real figures from computeRetirement()/computeBaseline() against the
// standard cfp-brain test client, so the pages show plausible numbers.
// --------------------------------------------------------------------------
const RETIREMENT = {
  insufficient_data: false,
  total_projected: 1_804_713,
  capital_needed: 2_712_594,
  income_need_at_retirement: 108_504,
  post_retirement_rate_used: 0.055,
  inflation_used: 0.035,
  gap: 907_882,
  required_monthly_topup: 1_486,
  depletion_age: 81,
};

const CASHFLOW = {
  insufficient_data: false,
  monthly_income: 18_000,
  monthly_expenses: 12_000,
  monthly_surplus: 4_500,
  annual_income: 216_000,
  annual_expenses: 144_000,
  annual_surplus: 54_000,
  asset_transfers_monthly: 1_500,
  savings_ratio: 0.25,
  income_breakdown: [
    { category: "薪资", monthly_amount: 16_000, share: 0.889 },
    { category: "租金收入", monthly_amount: 2_000, share: 0.111 },
  ],
  expense_breakdown: [
    { category: "房贷", monthly_amount: 4_200, share: 0.35 },
    { category: "生活开销", monthly_amount: 3_000, share: 0.25 },
    { category: "车贷", monthly_amount: 1_800, share: 0.15 },
    { category: "保费", monthly_amount: 1_200, share: 0.10 },
    { category: "子女教育", monthly_amount: 900, share: 0.075 },
    { category: "娱乐旅游", monthly_amount: 600, share: 0.05 },
    { category: "其他杂项", monthly_amount: 300, share: 0.025 },
  ],
  emergency_fund: {
    need_low: 36_000, need_high: 72_000, actual: 96_000,
    months_covered: 8, shortfall: 0, status: "sufficient",
  },
  // P6 决策 4 (one_off_items) is exercised by the selector's own unit tests
  // (__tests__/cashflow.test.ts) rather than here — CashflowDetail is
  // already dense enough with the two derived items below that one more
  // line (even at the compact row weight) tips the fixed 29-page template
  // onto an extra physical sheet. Not worth a knife's-edge fit that could
  // flip on font-metric differences between environments.
  one_off_items: [],
};

const INSURANCE = {
  annual_premium_total: 14_400,
  policy_overview: [
    { provider: "Great Eastern", policy_type: "终身寿险", sum_assured: 300_000, cash_value: 12_000, annual_premium: 4_800 },
    { provider: "Prudential", policy_type: "重疾保障", sum_assured: 150_000, cash_value: null, annual_premium: 6_000 },
    { provider: "AIA", policy_type: "医疗卡", sum_assured: null, cash_value: null, annual_premium: 3_600 },
  ],
  cna: {
    insufficient: false,
    assumptions: [
      "收入替代按家庭年支出的 10 倍计算",
      "教育金按每名子女 RM 150,000 估算",
      "重疾保障按年收入的 2 倍加治疗费用估算",
    ],
    needs: {
      income_replacement: 1_440_000, liabilities: 771_500,
      education: 300_000, total_life: 2_511_500, ci: 432_000,
    },
    resources: { life_cover: 300_000, ci_cover: 150_000, liquid_assets: 96_000 },
    gaps: [
      { key: "life", label: "人寿保障", need: 2_511_500, covered: 300_000, gap: 2_211_500 },
      { key: "ci", label: "重疾保障", need: 432_000, covered: 150_000, gap: 282_000 },
      { key: "medical", label: "医疗保障", flag_only: true, has_cover: true },
    ],
    // P5 决策 1: the six-category breakdown alongside the legacy `gaps`
    // above — RM 100,000 of the life cover is a group policy, so
    // excluding_group differs and the report gets a callout line.
    death: { need: 2_511_500, cover: 300_000, gap: 2_211_500, notes: ["含团保，离职即失效 / Includes group-employer cover, which lapses once employment ends"] },
    tpd: { need: 2_511_500, cover: 300_000, gap: 2_211_500, notes: ["假设寿险含 TPD，保单未单独列明全残保障 / Assumes the life plan's sum assured also covers TPD (no separate TPD benefit on file)"] },
    ci: { need: 432_000, cover: 150_000, gap: 282_000, notes: [] },
    ci_early_cover: { cover: 0, notes: ["系统未单独记录早期/晚期重疾赔付比例，如保单含此项请人工核对 / Early-stage critical illness payout isn't tracked separately — verify manually if the policy includes one"] },
    medical: { cover: 0, notes: [], has_cover: true, annual_limit: 500_000, low_limit: true, limit_unknown: false },
    pa: { cover: 0, notes: [] },
    excluding_group: {
      death: { need: 2_511_500, cover: 200_000, gap: 2_311_500, notes: [] },
      tpd: { need: 2_511_500, cover: 200_000, gap: 2_311_500, notes: [] },
      ci: { need: 432_000, cover: 150_000, gap: 282_000, notes: [] },
      ci_early_cover: { cover: 0, notes: [] },
      medical: { cover: 0, notes: [], has_cover: true, annual_limit: 500_000, low_limit: true, limit_unknown: false },
      pa: { cover: 0, notes: [] },
    },
  },
};

const LEGACY = {
  insufficient_data: false,
  life_cover_total: 300_000,
  gross_estate: 1_363_000,
  net_estate: 550_000,
  settlement_costs_est: 41_500,
  estate_obligations: 771_500,
  estate_liquidity: { available: 96_000, status: "shortfall", shortfall: 717_000 },
  distribution: {
    regime: "conventional",
    will_status: "no_will",
    faraid_flagged: false,
    intestate_conventional_split: [
      { beneficiary: "配偶", share: "1/4" },
      { beneficiary: "子女", share: "1/2" },
      { beneficiary: "父母", share: "1/4" },
    ],
  },
  nominations: { epf: true, insurance: false },
  trust_consideration: true,
  asset_isolation_flag: false,
};

const TAX = {
  insufficient_data: false,
  employment_income_est: 216_000,
  chargeable_income: 168_000,
  tax_payable: 22_950,
  marginal_rate: 0.24,
  effective_rate: 0.106,
  non_resident: false,
  reliefs_detail: [
    { key: "personal", label: "个人及受扶养亲属", claimed: 9_000, cap: 9_000, headroom: 0, source: "auto" },
    { key: "epf", label: "EPF 雇员公积金", claimed: 4_000, cap: 4_000, headroom: 0, source: "detected" },
    { key: "life_insurance", label: "人寿保险保费", claimed: 3_000, cap: 3_000, headroom: 0, source: "detected" },
    { key: "sspn", label: "SSPN 教育储蓄", claimed: 2_000, cap: 8_000, headroom: 6_000, source: "advisor" },
    { key: "prs", label: "私人退休计划 PRS", claimed: 0, cap: 3_000, headroom: 3_000, source: "none" },
    { key: "medical", label: "医疗保险保费", claimed: 1_200, cap: 3_000, headroom: 1_800, source: "detected" },
    { key: "lifestyle", label: "生活方式扣除", claimed: 1_500, cap: 2_500, headroom: 1_000, source: "auto" },
  ],
  optimization_opportunities: [
    { key: "sspn", label: "补足 SSPN 教育储蓄", additional_claimable: 6_000, est_tax_saving: 1_440 },
    { key: "prs", label: "开始 PRS 供款", additional_claimable: 3_000, est_tax_saving: 720 },
    { key: "medical", label: "提高医疗保险保额", additional_claimable: 1_800, est_tax_saving: 432 },
  ],
};

const INVESTMENT = {
  no_investable: false,
  investable_total: 243_000,
  current_allocation: [
    { bucket: "equity", amount: 87_000, pct: 35.8 },
    { bucket: "bond", amount: 0, pct: 0 },
    { bucket: "cash", amount: 96_000, pct: 39.5 },
    { bucket: "alternatives", amount: 60_000, pct: 24.7 },
  ],
  target_allocation: [
    { bucket: "equity", amount: 121_500, pct: 50 },
    { bucket: "bond", amount: 72_900, pct: 30 },
    { bucket: "cash", amount: 24_300, pct: 10 },
    { bucket: "alternatives", amount: 24_300, pct: 10 },
  ],
  drift: [
    { bucket: "equity", current_pct: 35.8, target_pct: 50, drift_pp: -14.2 },
    { bucket: "bond", current_pct: 0, target_pct: 30, drift_pp: -30 },
    { bucket: "cash", current_pct: 39.5, target_pct: 10, drift_pp: 29.5 },
    { bucket: "alternatives", current_pct: 24.7, target_pct: 10, drift_pp: 14.7 },
  ],
  rebalancing_actions: [
    { label: "现金转入债券基金", amount: 72_900 },
    { label: "增持股票型基金", amount: 34_500 },
  ],
  expected_return: 0.072,
  expected_vol: 0.11,
};

/**
 * Deliberately null: both suitability tables are empty in production, so the
 * page has to be right when nothing has been submitted. That is the default
 * path, not the edge case.
 */
const SUITABILITY = null;

const GOALS = {
  no_goals: false,
  return_rate_used: 0.055,
  education_future_cost_total: 386_000,
  total_required_monthly: 3_240,
  goals: [
    {
      id: "g1", goal_type: "vehicle", name: "换车", target_year: 2029, years_to_target: 3,
      target_amount_today: 120_000, inflation_used: 0.03, future_cost: 131_127,
      current_saved: 20_000, monthly_contribution: 1_500, projected_savings: 78_400,
      gap: 52_727, required_monthly: 2_640, on_track: false,
    },
    {
      id: "g2", goal_type: "education", name: "长子大学教育金", target_year: 2038, years_to_target: 12,
      target_amount_today: 180_000, inflation_used: 0.05, future_cost: 323_200,
      current_saved: 35_000, monthly_contribution: 600, projected_savings: 187_500,
      gap: 135_700, required_monthly: 1_180, on_track: false,
    },
    {
      id: "g3", goal_type: "other", name: "家庭旅游基金", target_year: 2027, years_to_target: 1,
      target_amount_today: 18_000, inflation_used: 0.03, future_cost: 18_540,
      current_saved: 14_000, monthly_contribution: 400, projected_savings: 18_900,
      gap: 0, required_monthly: 0, on_track: true,
    },
  ],
};

const DATA: CfpReportData = {
  clientName: "Lim Wei Jian",
  advisorName: "Leon Lee",
  advisorEmail: "leon@xinwealth.com",
  period: "2026 财务规划",
  generatedDate: "18 / 08 / 2026",
  language: "zh",
  hasUnapproved: false,
  client: {},
  baseline: {
    retirement_age: 60,
    liquid_assets_total: 96_000,
    monthly_essential_expenses: 12_000,
    net_worth: 291_500,
    total_assets: 1_063_000,
    total_liabilities: 771_500,
    solvency_ratio: 0.2742,
    savings_ratio: 0.3103,
    debt_service_ratio: 0.2840,
    // P2b 决策 1/6 — the plan basis, statutory EPF/SOCSO-EIS and the
    // installments/premiums/statutory items cfp-brain folded in automatically.
    cashflow_source: "items",
    items_as_of: "2026-08-01",
    monthly_employee_epf: 1_760,
    monthly_employer_epf: 2_080,
    monthly_socso_eis: 112,
    annual_disposable_surplus: 32_880,
    // P2b followup (WEI QI LEE case) — the take-home / net-cash-flow
    // waterfall. Exercises CashflowOverview's compact block in the pageCount
    // overflow tripwire — without these, that test never renders it at all.
    monthly_income_tax: 220,
    monthly_statutory: 1_872, // employee EPF 1,760 + SOCSO/EIS 112
    monthly_take_home: 15_908, // 18,000 − 1,872 − 220
    monthly_living: 11_668, // 12,000 monthly_expenses − 112 socso/eis − 220 tax
    monthly_savable: 4_240, // 15,908 − 11,668
    monthly_planned_savings: 1_500, // matches CASHFLOW.asset_transfers_monthly
    monthly_net_cash_flow: 2_740, // 4,240 − 1,500
    monthly_principal: 1_150,
    derived_items: [
      {
        key: "liability:mortgage-1", source_type: "liability", source_id: "mortgage-1",
        source_name: "住宅房贷", category: "mortgage_installment", direction: "outflow",
        monthly_amount: 4_200, interest_monthly: 3_050, principal_monthly: 1_150,
        estimated: [], warnings: [],
      },
      {
        key: "statutory:epf_employee", source_type: "statutory", source_id: null,
        source_name: "EPF（雇员）", category: "epf_employee", direction: "outflow",
        monthly_amount: 1_760, interest_monthly: 0, principal_monthly: 0,
        estimated: ["statutory_rate"], warnings: ["按法定比例估算"],
      },
    ],
    // P3 决策 3 — per-asset 2×2 (自住房产 alone gets a labeled quadrant; the
    // other assets are class A/B, which never get one).
    asset_quality: {
      assets: [
        {
          asset_id: "asset-property-1", asset_class: "D", quadrant: "appreciating_cash_consuming",
          net_cash_flow_monthly: -4_200, linked_items: [], linked_liabilities: [],
          value_change_annual: 15_000, value_change_source: "history", total_return_annual: -35_400,
          return_pct: -0.0708, notes: [],
        },
      ],
      by_quadrant: {
        productive: { count: 0, value: 0, net_cash_flow_monthly: 0 },
        yielding_depreciating: { count: 0, value: 0, net_cash_flow_monthly: 0 },
        appreciating_cash_consuming: { count: 1, value: 500_000, net_cash_flow_monthly: -4_200 },
        consuming: { count: 0, value: 0, net_cash_flow_monthly: 0 },
      },
    },
  },
  sections: [
    { section_type: "retirement_planning", status: "approved", content: RETIREMENT },
    { section_type: "cashflow_planning", status: "approved", content: CASHFLOW },
    { section_type: "insurance_planning", status: "approved", content: INSURANCE },
    { section_type: "legacy_planning", status: "approved", content: LEGACY },
    { section_type: "tax_planning", status: "approved", content: TAX },
    { section_type: "investment_planning", status: "approved", content: INVESTMENT },
    { section_type: "goals_planning", status: "approved", content: GOALS },
  ],
  assets: [
    { asset_type: "savings", name: "储蓄", current_value: 60_000 },
    { asset_type: "fixed_deposit", name: "定存", current_value: 36_000 },
    { asset_type: "epf_account_1", name: "EPF 户口一", current_value: 320_000 },
    { asset_type: "stock", name: "股票组合", current_value: 87_000 },
    { asset_type: "unit_trust", name: "信托基金", current_value: 60_000 },
    { asset_type: "property", name: "自住房产", current_value: 500_000, id: "asset-property-1" },
  ],
  suitability: SUITABILITY,
  liabilities: [
    { liability_type: "mortgage", name: "住宅房贷", outstanding_balance: 700_000 },
    { liability_type: "credit_card", name: "信用卡循环余额", outstanding_balance: 21_500 },
    { liability_type: "car_loan", name: "汽车贷款", outstanding_balance: 50_000 },
  ],
};

const ACTIONS = [
  { what: "补足人寿与重疾保障缺口 RM 1.42M", when: "3 个月内", status: "待启动", band: "bad" as const },
  { what: "建立 6 个月紧急预备金", when: "6 个月内", status: "进行中", band: "warn" as const },
  { what: "每月增投 RM 1,486 填补退休缺口", when: "本月开始", status: "待启动", band: "bad" as const },
  { what: "撰写全面遗嘱并更新受益人提名", when: "12 个月内", status: "未开始", band: "warn" as const },
  { what: "重置投资组合至稳健型配置", when: "下季度", status: "待检视", band: "warn" as const },
];

const RUNNING = "XinWealth · 2026 财务规划报告";

/** Everything stripped back to what a brand-new report actually looks like. */
const SPARSE: CfpReportData = {
  ...DATA,
  clientName: "New Client",
  baseline: null,
  sections: [],
  assets: [],
  liabilities: [],
  suitability: null,
};

(async () => {
  const sparse = process.argv.includes("--sparse");
  const data = { ...(sparse ? SPARSE : DATA), brand: BRAND };
  await renderToFile(
    <CfpReportPdf data={data} />,
    path.resolve(process.argv[2] ?? "showcase.pdf"),
  );
  console.log(sparse ? "ok (sparse)" : "ok");
})();
