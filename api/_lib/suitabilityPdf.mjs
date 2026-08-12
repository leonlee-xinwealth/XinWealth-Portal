// GENERATED FILE — do not edit.
// Source: pdf/suitabilityReport/** (entry: renderNode.ts)
// Rebuild: node scripts/build-suitability-pdf.mjs
// Committed because @vercel/node does not emit .tsx dependencies.

// pdf/suitabilityReport/renderNode.ts
import path from "node:path";
import fs from "node:fs";
import React from "react";
import { Font as Font2, renderToBuffer } from "@react-pdf/renderer";

// pdf/insuranceReport/fonts.ts
import { Font } from "@react-pdf/renderer";
var registered = false;
function registerFonts(src = "/fonts/NotoSansSC-Regular.ttf") {
  if (registered)
    return;
  Font.register({
    family: "NotoSansSC",
    fonts: [{ src }]
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

// pdf/cjkWrap.ts
function isCjkChar(ch) {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 19968 && code <= 40959 || // CJK Unified Ideographs
  code >= 12288 && code <= 12351 || // CJK punctuation
  code >= 65280 && code <= 65519 || // Fullwidth forms
  code >= 13312 && code <= 19903;
}
function splitForCjkWrap(word) {
  if (!word)
    return [word];
  let hasCjk = false;
  for (const ch of word) {
    if (isCjkChar(ch)) {
      hasCjk = true;
      break;
    }
  }
  if (!hasCjk)
    return [word];
  const parts = [];
  let latinBuf = "";
  for (const ch of word) {
    if (isCjkChar(ch)) {
      if (latinBuf) {
        parts.push(latinBuf);
        latinBuf = "";
      }
      parts.push(ch);
    } else {
      latinBuf += ch;
    }
  }
  if (latinBuf)
    parts.push(latinBuf);
  return parts;
}

// pdf/suitabilityReport/SuitabilityReportPdf.tsx
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// pdf/insuranceReport/theme.ts
var C = {
  blue: "#0A2540",
  blueLight: "#173A5E",
  blueDeep: "#061626",
  gold: "#C8A97E",
  goldLight: "#E6D3B3",
  goldDark: "#A68255",
  bg: "#F4F7F9",
  bgAlt: "#FAFBFC",
  text: "#334155",
  muted: "#64748B",
  faint: "#94A3B8",
  line: "#E2E8F0",
  white: "#FFFFFF"
};
var STATUS = {
  good: { fill: "#059669", track: "#D1FAE5", fg: "#047857", softBg: "#ECFDF5" },
  warn: { fill: "#D97706", track: "#FDE8C8", fg: "#B45309", softBg: "#FFFBEB" },
  bad: { fill: "#DC2626", track: "#FBD5D5", fg: "#B91C1C", softBg: "#FEF2F2" },
  none: { fill: "#94A3B8", track: "#EEF2F6", fg: "#64748B", softBg: "#F8FAFC" }
};

// lib/suitability/questions.ts
var SUITABILITY_QUESTIONS = [
  // ── Q01 ── narrative only ───────────────────────────────────────────────
  {
    id: "investment_objective",
    order: 1,
    dimension: null,
    control: "single",
    titleEn: "What is your primary investment objective?",
    titleZh: "\u4F60\u6295\u8D44\u7684\u4E3B\u8981\u76EE\u6807\u662F\u4EC0\u4E48\uFF1F",
    options: [
      { value: "capital_preservation", en: "Preserve capital and beat inflation", zh: "\u4FDD\u672C\uFF0C\u5E76\u8DD1\u8D62\u901A\u80C0" },
      { value: "regular_income", en: "Generate a regular income stream", zh: "\u521B\u9020\u7A33\u5B9A\u7684\u73B0\u91D1\u6D41\u6536\u5165" },
      { value: "balanced_growth", en: "Steady long-term growth with moderate volatility", zh: "\u957F\u671F\u7A33\u5065\u589E\u503C\uFF0C\u53EF\u63A5\u53D7\u9002\u5EA6\u6CE2\u52A8" },
      { value: "capital_growth", en: "Maximise long-term capital growth", zh: "\u8FFD\u6C42\u957F\u671F\u8D44\u672C\u589E\u503C\u6700\u5927\u5316" }
    ]
  },
  // ── Q02 ── time horizon ceiling ─────────────────────────────────────────
  {
    id: "investment_horizon",
    order: 2,
    dimension: null,
    control: "single",
    titleEn: "How long can you leave this money invested before you need it?",
    titleZh: "\u8FD9\u7B14\u8D44\u91D1\u4F60\u9884\u8BA1\u53EF\u4EE5\u6295\u8D44\u591A\u4E45\u624D\u4F1A\u52A8\u7528\uFF1F",
    helpEn: "Answer for the money you plan to invest, not your total savings.",
    helpZh: "\u8BF7\u4EE5\u4F60\u6253\u7B97\u6295\u8D44\u7684\u8FD9\u7B14\u94B1\u4E3A\u51C6\uFF0C\u800C\u975E\u5168\u90E8\u50A8\u84C4\u3002",
    options: [
      { value: "lt_1y", en: "Less than 1 year", zh: "1\u5E74\u4EE5\u5185", meta: { horizonCeiling: 1 } },
      { value: "1_3y", en: "1\u20133 years", zh: "1\u20133\u5E74", meta: { horizonCeiling: 1 } },
      { value: "3_5y", en: "3\u20135 years", zh: "3\u20135\u5E74", meta: { horizonCeiling: 2 } },
      { value: "5_10y", en: "5\u201310 years", zh: "5\u201310\u5E74", meta: { horizonCeiling: 4 } },
      { value: "gt_10y", en: "More than 10 years", zh: "10\u5E74\u4EE5\u4E0A", meta: { horizonCeiling: 4 } }
    ]
  },
  // ── Q03 ── capacity ─────────────────────────────────────────────────────
  {
    id: "liquidity_backup",
    order: 3,
    dimension: "capacity",
    control: "single",
    titleEn: "Aside from this investment, how many months of expenses could you cover from cash savings?",
    titleZh: "\u9664\u4E86\u8FD9\u7B14\u6295\u8D44\uFF0C\u4F60\u7684\u73B0\u91D1\u50A8\u5907\u53EF\u4EE5\u652F\u6491\u51E0\u4E2A\u6708\u7684\u751F\u6D3B\u5F00\u9500\uFF1F",
    options: [
      { value: "gte_12m", en: "12 months or more", zh: "12\u4E2A\u6708\u6216\u4EE5\u4E0A", points: 3 },
      { value: "6_12m", en: "6\u201312 months", zh: "6\u201312\u4E2A\u6708", points: 2 },
      { value: "3_6m", en: "3\u20136 months", zh: "3\u20136\u4E2A\u6708", points: 1 },
      { value: "lt_3m", en: "Less than 3 months", zh: "\u4E0D\u8DB33\u4E2A\u6708", points: 0 }
    ]
  },
  // ── Q04 ── capacity ─────────────────────────────────────────────────────
  {
    id: "income_stability",
    order: 4,
    dimension: "capacity",
    control: "single",
    titleEn: "How stable and predictable is your income?",
    titleZh: "\u4F60\u7684\u6536\u5165\u6709\u591A\u7A33\u5B9A\u3001\u53EF\u9884\u6D4B\uFF1F",
    options: [
      { value: "very_stable", en: "Very stable, and expected to grow", zh: "\u975E\u5E38\u7A33\u5B9A\uFF0C\u5E76\u9884\u671F\u4F1A\u589E\u957F", points: 3 },
      { value: "stable", en: "Stable and predictable", zh: "\u7A33\u5B9A\u4E14\u53EF\u9884\u6D4B", points: 2 },
      { value: "variable", en: "Variable \u2014 it fluctuates year to year", zh: "\u6D6E\u52A8\u2014\u2014\u6BCF\u5E74\u4F1A\u6709\u6CE2\u52A8", points: 1 },
      { value: "unstable", en: "Unstable, or I have no regular income", zh: "\u4E0D\u7A33\u5B9A\uFF0C\u6216\u76EE\u524D\u6CA1\u6709\u56FA\u5B9A\u6536\u5165", points: 0 }
    ]
  },
  // ── Q05 ── capacity (+ RF04) ────────────────────────────────────────────
  {
    id: "capital_concentration",
    order: 5,
    dimension: "capacity",
    control: "single",
    titleEn: "What share of your total investable assets will this investment represent?",
    titleZh: "\u8FD9\u7B14\u6295\u8D44\u5360\u4F60\u53EF\u6295\u8D44\u8D44\u4EA7\u603B\u989D\u7684\u6BD4\u4F8B\u662F\u591A\u5C11\uFF1F",
    options: [
      { value: "lt_10", en: "Less than 10%", zh: "\u4F4E\u4E8E 10%", points: 3 },
      { value: "10_25", en: "10\u201325%", zh: "10\u201325%", points: 2 },
      { value: "25_50", en: "25\u201350%", zh: "25\u201350%", points: 1 },
      { value: "gt_50", en: "More than 50%", zh: "\u8D85\u8FC7 50%", points: 0, meta: { concentrationOver50: true } }
    ]
  },
  // ── Q06 ── experience (never upgrades the profile) ──────────────────────
  {
    id: "investment_experience_years",
    order: 6,
    dimension: null,
    control: "single",
    titleEn: "How many years of investing experience do you have?",
    titleZh: "\u4F60\u6709\u591A\u5C11\u5E74\u7684\u6295\u8D44\u7ECF\u9A8C\uFF1F",
    options: [
      { value: "none", en: "No experience", zh: "\u6CA1\u6709\u7ECF\u9A8C", meta: { experienceYearsBand: 0 } },
      { value: "lt_3y", en: "Less than 3 years", zh: "\u5C11\u4E8E3\u5E74", meta: { experienceYearsBand: 1 } },
      { value: "3_5y", en: "3\u20135 years", zh: "3\u20135\u5E74", meta: { experienceYearsBand: 2 } },
      { value: "5_10y", en: "5\u201310 years", zh: "5\u201310\u5E74", meta: { experienceYearsBand: 3 } },
      { value: "gt_10y", en: "More than 10 years", zh: "10\u5E74\u4EE5\u4E0A", meta: { experienceYearsBand: 4 } }
    ]
  },
  // ── Q07 ── experience, multi-select ─────────────────────────────────────
  {
    id: "investment_products",
    order: 7,
    dimension: null,
    control: "multi",
    titleEn: "Which of these have you personally invested in before?",
    titleZh: "\u4EE5\u4E0B\u54EA\u4E9B\u4EA7\u54C1\u4F60\u66FE\u7ECF\u4EB2\u81EA\u6295\u8D44\u8FC7\uFF1F",
    helpEn: "Select all that apply. Select nothing if none.",
    helpZh: "\u53EF\u591A\u9009\u3002\u82E5\u90FD\u6CA1\u6709\uFF0C\u8BF7\u4E0D\u8981\u52FE\u9009\u4EFB\u4F55\u4E00\u9879\u3002",
    options: [
      { value: "cash", en: "Cash / savings accounts", zh: "\u73B0\u91D1 / \u50A8\u84C4\u8D26\u6237", meta: { productLevel: "BASIC" } },
      { value: "fd", en: "Fixed deposits", zh: "\u5B9A\u671F\u5B58\u6B3E", meta: { productLevel: "BASIC" } },
      { value: "bond", en: "Bonds / sukuk", zh: "\u503A\u5238 / \u4F0A\u65AF\u5170\u503A\u5238", meta: { productLevel: "INTERMEDIATE" } },
      { value: "unit_trust", en: "Unit trusts / mutual funds", zh: "\u4FE1\u6258\u57FA\u91D1 / \u5171\u540C\u57FA\u91D1", meta: { productLevel: "INTERMEDIATE" } },
      { value: "etf", en: "ETFs", zh: "\u4EA4\u6613\u6240\u4EA4\u6613\u57FA\u91D1\uFF08ETF\uFF09", meta: { productLevel: "INTERMEDIATE" } },
      { value: "equity", en: "Shares / equities", zh: "\u80A1\u7968", meta: { productLevel: "INTERMEDIATE" } },
      { value: "reit", en: "REITs", zh: "\u623F\u5730\u4EA7\u6295\u8D44\u4FE1\u6258\uFF08REIT\uFF09", meta: { productLevel: "INTERMEDIATE" } },
      { value: "private_credit", en: "Private credit", zh: "\u79C1\u52DF\u4FE1\u8D37", meta: { productLevel: "ADVANCED" } },
      { value: "alternative", en: "Alternative investments", zh: "\u53E6\u7C7B\u6295\u8D44", meta: { productLevel: "ADVANCED" } },
      { value: "private_equity", en: "Private equity", zh: "\u79C1\u52DF\u80A1\u6743", meta: { productLevel: "ADVANCED" } }
    ]
  },
  // ── Q08 ── behaviour ────────────────────────────────────────────────────
  {
    id: "market_drawdown_experience",
    order: 8,
    dimension: null,
    control: "single",
    titleEn: "Have you ever held investments through a major market decline?",
    titleZh: "\u4F60\u662F\u5426\u66FE\u7ECF\u5386\u8FC7\u5E02\u573A\u5927\u5E45\u4E0B\u8DCC\uFF0C\u5E76\u4E14\u5F53\u65F6\u6301\u6709\u6295\u8D44\uFF1F",
    options: [
      { value: "never_invested", en: "No \u2014 I had no investments at the time", zh: "\u6CA1\u6709\u2014\u2014\u5F53\u65F6\u6211\u6CA1\u6709\u6295\u8D44", meta: { drawdownOver20: false } },
      { value: "small_decline", en: "Yes, but only a modest decline (under 20%)", zh: "\u6709\uFF0C\u4F46\u8DCC\u5E45\u4E0D\u5927\uFF0820%\u4EE5\u5185\uFF09", meta: { drawdownOver20: false } },
      { value: "over_20", en: "Yes \u2014 I held through a decline of more than 20%", zh: "\u6709\u2014\u2014\u6211\u7ECF\u5386\u8FC7\u8D85\u8FC7 20% \u7684\u8DCC\u5E45", meta: { drawdownOver20: true } }
    ]
  },
  // ── Q09 ── behaviour ────────────────────────────────────────────────────
  {
    id: "drawdown_reaction",
    order: 9,
    dimension: null,
    control: "single",
    titleEn: "In that decline \u2014 or if one happened tomorrow \u2014 what did or would you do?",
    titleZh: "\u5728\u90A3\u6B21\u4E0B\u8DCC\u4E2D\u2014\u2014\u6216\u5047\u8BBE\u660E\u5929\u5C31\u53D1\u751F\u2014\u2014\u4F60\u5F53\u65F6\uFF0F\u4F1A\u600E\u4E48\u505A\uFF1F",
    options: [
      { value: "sold_all", en: "Sell everything to stop the losses", zh: "\u5168\u90E8\u5356\u51FA\uFF0C\u6B62\u635F\u79BB\u573A", meta: { panicSold: true } },
      { value: "sold_some", en: "Sell part of the portfolio to reduce risk", zh: "\u5356\u51FA\u4E00\u90E8\u5206\uFF0C\u964D\u4F4E\u98CE\u9669", meta: { panicSold: true } },
      { value: "held", en: "Hold and wait for recovery", zh: "\u7EE7\u7EED\u6301\u6709\uFF0C\u7B49\u5F85\u56DE\u5347", meta: { panicSold: false } },
      { value: "bought_more", en: "Invest more while prices are low", zh: "\u8D81\u4F4E\u52A0\u7801\u4E70\u5165", meta: { panicSold: false } }
    ]
  },
  // ── Q10 ── tolerance, max 1 ─────────────────────────────────────────────
  {
    id: "loss_3_percent_reaction",
    order: 10,
    dimension: "tolerance",
    control: "single",
    titleEn: "Your portfolio falls 3% in a month. How do you feel?",
    titleZh: "\u4F60\u7684\u6295\u8D44\u7EC4\u5408\u5728\u4E00\u4E2A\u6708\u5185\u4E0B\u8DCC 3%\u3002\u4F60\u7684\u611F\u53D7\u662F\uFF1F",
    options: [
      { value: "uncomfortable", en: "Uncomfortable \u2014 I would want to act", zh: "\u4E0D\u5B89\u2014\u2014\u6211\u4F1A\u60F3\u505A\u70B9\u4EC0\u4E48", points: 0 },
      { value: "acceptable", en: "Acceptable \u2014 normal short-term movement", zh: "\u53EF\u4EE5\u63A5\u53D7\u2014\u2014\u5C5E\u4E8E\u6B63\u5E38\u7684\u77ED\u671F\u6CE2\u52A8", points: 1 }
    ]
  },
  // ── Q11 ── tolerance, max 2 ─────────────────────────────────────────────
  {
    id: "loss_10_percent_reaction",
    order: 11,
    dimension: "tolerance",
    control: "single",
    titleEn: "Your portfolio falls 10%. What would you do?",
    titleZh: "\u4F60\u7684\u6295\u8D44\u7EC4\u5408\u4E0B\u8DCC 10%\u3002\u4F60\u4F1A\u600E\u4E48\u505A\uFF1F",
    options: [
      { value: "exit", en: "Exit the investment", zh: "\u9000\u51FA\u8FD9\u7B14\u6295\u8D44", points: 0 },
      { value: "reduce", en: "Reduce my exposure", zh: "\u51CF\u5C11\u6295\u8D44\u6BD4\u91CD", points: 1 },
      { value: "hold", en: "Stay invested", zh: "\u7EE7\u7EED\u6301\u6709", points: 2 }
    ]
  },
  // ── Q12 ── tolerance, max 3 ─────────────────────────────────────────────
  {
    id: "loss_20_percent_reaction",
    order: 12,
    dimension: "tolerance",
    control: "single",
    titleEn: "Your portfolio falls 20%. What would you do?",
    titleZh: "\u4F60\u7684\u6295\u8D44\u7EC4\u5408\u4E0B\u8DCC 20%\u3002\u4F60\u4F1A\u600E\u4E48\u505A\uFF1F",
    options: [
      { value: "exit_all", en: "Exit everything immediately", zh: "\u7ACB\u523B\u5168\u90E8\u9000\u51FA", points: 0 },
      { value: "reduce", en: "Reduce my exposure significantly", zh: "\u5927\u5E45\u51CF\u5C11\u6295\u8D44\u6BD4\u91CD", points: 1 },
      { value: "hold", en: "Stay invested and wait", zh: "\u7EE7\u7EED\u6301\u6709\uFF0C\u8010\u5FC3\u7B49\u5F85", points: 2 },
      { value: "add", en: "Add more at lower prices", zh: "\u8D81\u4F4E\u52A0\u7801\u4E70\u5165", points: 3 }
    ]
  },
  // ── Q13 ── tolerance, max 3 ─────────────────────────────────────────────
  {
    id: "principal_preference",
    order: 13,
    dimension: "tolerance",
    control: "single",
    titleEn: "Which statement best describes your attitude to your capital?",
    titleZh: "\u4EE5\u4E0B\u54EA\u4E00\u53E5\u6700\u8D34\u8FD1\u4F60\u5BF9\u672C\u91D1\u7684\u6001\u5EA6\uFF1F",
    options: [
      { value: "no_loss", en: "I cannot accept any loss of capital", zh: "\u6211\u65E0\u6CD5\u63A5\u53D7\u672C\u91D1\u6709\u4EFB\u4F55\u4E8F\u635F", points: 0 },
      { value: "small_loss", en: "I can accept a small loss for modestly better returns", zh: "\u4E3A\u4E86\u7565\u9AD8\u7684\u56DE\u62A5\uFF0C\u6211\u53EF\u4EE5\u63A5\u53D7\u5C0F\u5E45\u4E8F\u635F", points: 1 },
      { value: "moderate_loss", en: "I can accept meaningful swings for higher long-term returns", zh: "\u4E3A\u4E86\u66F4\u9AD8\u7684\u957F\u671F\u56DE\u62A5\uFF0C\u6211\u53EF\u4EE5\u63A5\u53D7\u660E\u663E\u6CE2\u52A8", points: 2 },
      { value: "large_loss", en: "I can accept large swings in pursuit of maximum growth", zh: "\u4E3A\u4E86\u8FFD\u6C42\u6700\u5927\u589E\u503C\uFF0C\u6211\u53EF\u4EE5\u63A5\u53D7\u5927\u5E45\u6CE2\u52A8", points: 3 }
    ]
  },
  // ── Q14 ── expectation gap only ─────────────────────────────────────────
  {
    id: "return_expectation",
    order: 14,
    dimension: null,
    control: "single",
    titleEn: "What average annual return are you hoping for over the long term?",
    titleZh: "\u957F\u671F\u800C\u8A00\uFF0C\u4F60\u5E0C\u671B\u83B7\u5F97\u7684\u5E73\u5747\u5E74\u5316\u56DE\u62A5\u5927\u7EA6\u662F\u591A\u5C11\uFF1F",
    options: [
      { value: "4_6", en: "4\u20136% per year", zh: "\u6BCF\u5E74 4\u20136%", meta: { targetReturnPct: 6 } },
      { value: "6_8", en: "6\u20138% per year", zh: "\u6BCF\u5E74 6\u20138%", meta: { targetReturnPct: 8 } },
      { value: "8_10", en: "8\u201310% per year", zh: "\u6BCF\u5E74 8\u201310%", meta: { targetReturnPct: 10 } },
      { value: "10_12", en: "10\u201312% per year", zh: "\u6BCF\u5E74 10\u201312%", meta: { targetReturnPct: 12 } },
      // Open-ended band. 15 is the value used to size the gap; anything above a
      // profile's return_max by more than 2pp is SIGNIFICANT, which is the
      // intended reading of "12%+" against every capped profile.
      { value: "gt_12", en: "More than 12% per year", zh: "\u6BCF\u5E74 12% \u4EE5\u4E0A", meta: { targetReturnPct: 15 } }
    ]
  },
  // ── Q15 ── narrative only ───────────────────────────────────────────────
  {
    id: "investment_preference",
    order: 15,
    dimension: null,
    control: "single",
    titleEn: "How would you prefer your investments to be managed?",
    titleZh: "\u4F60\u5E0C\u671B\u4F60\u7684\u6295\u8D44\u4EE5\u4EC0\u4E48\u65B9\u5F0F\u7BA1\u7406\uFF1F",
    options: [
      { value: "fully_advised", en: "Guided by my adviser at every step", zh: "\u6BCF\u4E00\u6B65\u90FD\u7531\u7406\u8D22\u89C4\u5212\u5E08\u5F15\u5BFC" },
      { value: "collaborative", en: "Decide together with my adviser", zh: "\u4E0E\u7406\u8D22\u89C4\u5212\u5E08\u5171\u540C\u51B3\u5B9A" },
      { value: "self_directed", en: "I decide, with my adviser as a sounding board", zh: "\u7531\u6211\u51B3\u5B9A\uFF0C\u7406\u8D22\u89C4\u5212\u5E08\u63D0\u4F9B\u53C2\u8003\u610F\u89C1" }
    ]
  }
];
var QUESTION_BY_ID = SUITABILITY_QUESTIONS.reduce((acc, q) => {
  acc[q.id] = q;
  return acc;
}, {});
var QUESTION_IDS = SUITABILITY_QUESTIONS.map((q) => q.id);
function optionOf(id, value) {
  return QUESTION_BY_ID[id]?.options.find((o) => o.value === value);
}

// pdf/suitabilityReport/model.ts
var L = {
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
    reviewNote: "Your financial planner will discuss these results with you."
  },
  zh: {
    title: "\u6295\u8D44\u9002\u5F53\u6027\u8BC4\u4F30",
    preparedFor: "\u81F4",
    preparedBy: "\u7F16\u5236",
    submitted: "\u5B8C\u6210\u65E5\u671F",
    generated: "\u751F\u6210\u65E5\u671F",
    rules: "\u89C4\u5219\u7248\u672C",
    yourProfile: "\u6295\u8D44\u8005\u7C7B\u578B",
    characteristics: "\u8FD9\u4EE3\u8868\u4EC0\u4E48",
    horizon: "\u9002\u5408\u7684\u6295\u8D44\u671F\u9650",
    returnRef: "\u5386\u53F2\u957F\u671F\u56DE\u62A5\u53C2\u8003\u533A\u95F4",
    yourExpectation: "\u4F60\u7684\u671F\u671B\u56DE\u62A5",
    expectationCheck: "\u671F\u671B\u5BF9\u7167",
    howDerived: "\u6B64\u7C7B\u578B\u7684\u5224\u5B9A\u4F9D\u636E",
    capacity: "\u98CE\u9669\u627F\u53D7\u80FD\u529B",
    tolerance: "\u98CE\u9669\u627F\u53D7\u610F\u613F",
    horizonCeiling: "\u6295\u8D44\u671F\u9650",
    boundBy: "\u51B3\u5B9A\u56E0\u7D20",
    allocation: "\u7B56\u7565\u6027\u8D44\u4EA7\u914D\u7F6E\u53C2\u8003",
    defensive: "\u9632\u5FA1\u578B",
    growth: "\u6210\u957F\u578B",
    diversifier: "\u5206\u6563\u578B",
    capNote: "\u6210\u957F\u578B\u8D44\u4EA7\u6BD4\u4F8B\u5DF2\u4F9D\u4F60\u7684\u6295\u8D44\u671F\u9650\u4F5C\u51FA\u9650\u5236\u3002",
    answers: "\u4F60\u7684\u4F5C\u7B54",
    disclaimer: "\u91CD\u8981\u63D0\u793A",
    none: "\u65E0",
    perYear: "\u6BCF\u5E74",
    reviewNote: "\u4F60\u7684\u7406\u8D22\u89C4\u5212\u5E08\u4F1A\u4E0E\u4F60\u8BA8\u8BBA\u8FD9\u4EFD\u8BC4\u4F30\u7ED3\u679C\u3002"
  }
};
var BAND_NAME = {
  1: { en: "Stable", zh: "\u7A33\u5065\u578B" },
  2: { en: "Balanced", zh: "\u5E73\u8861\u578B" },
  3: { en: "Growth", zh: "\u6210\u957F\u578B" },
  4: { en: "Aggressive Growth", zh: "\u79EF\u6781\u6210\u957F\u578B" }
};
var GAP_TEXT = {
  ALIGNED: {
    en: "Your return expectation sits within the historical range associated with this profile.",
    zh: "\u4F60\u7684\u56DE\u62A5\u671F\u671B\u843D\u5728\u6B64\u7C7B\u578B\u5BF9\u5E94\u7684\u5386\u53F2\u56DE\u62A5\u533A\u95F4\u4E4B\u5185\u3002"
  },
  MODERATE_GAP: {
    en: "Your target is somewhat above the historical range for this profile. Reaching for more usually means accepting larger swings and deeper losses along the way.",
    zh: "\u4F60\u7684\u76EE\u6807\u7565\u9AD8\u4E8E\u6B64\u7C7B\u578B\u5BF9\u5E94\u7684\u5386\u53F2\u56DE\u62A5\u533A\u95F4\u3002\u82E5\u5E0C\u671B\u4E89\u53D6\u66F4\u9AD8\u56DE\u62A5\uFF0C\u901A\u5E38\u9700\u8981\u627F\u62C5\u66F4\u5927\u7684\u6CE2\u52A8\u4E0E\u66F4\u6DF1\u7684\u6F5C\u5728\u4E8F\u635F\u3002"
  },
  SIGNIFICANT_GAP: {
    en: "Your target is well above the historical range for this profile. This gap is worth discussing before any investment decision is made.",
    zh: "\u4F60\u7684\u76EE\u6807\u660E\u663E\u9AD8\u4E8E\u6B64\u7C7B\u578B\u5BF9\u5E94\u7684\u5386\u53F2\u56DE\u62A5\u533A\u95F4\u3002\u5EFA\u8BAE\u5728\u505A\u51FA\u4EFB\u4F55\u6295\u8D44\u51B3\u5B9A\u524D\uFF0C\u5148\u5C31\u8FD9\u4E00\u843D\u5DEE\u8FDB\u884C\u8BA8\u8BBA\u3002"
  }
};
function fmtRange(r, lang) {
  if (!r)
    return "\u2014";
  const per = lang === "zh" ? "" : ` ${L.en.perYear}`;
  const body = r.max === null || r.max === void 0 ? `${r.min}%+` : `${r.min}\u2013${r.max}%`;
  return lang === "zh" ? `${L.zh.perYear} ${body}` : `${body}${per}`;
}
function fmtTarget(pct, lang) {
  if (pct === null || pct === void 0)
    return "\u2014";
  if (pct >= 15)
    return lang === "zh" ? "\u6BCF\u5E74 12%+" : "12%+ p.a.";
  const lo = Math.max(0, pct - 2);
  return lang === "zh" ? `\u6BCF\u5E74 ${lo}\u2013${pct}%` : `${lo}\u2013${pct}% p.a.`;
}
function bindingDimensions(d, lang) {
  const out = [];
  if (d.capacityBand === d.finalBand)
    out.push(L[lang].capacity);
  if (d.toleranceBand === d.finalBand)
    out.push(L[lang].tolerance);
  if (d.horizonCeilingBand === d.finalBand)
    out.push(L[lang].horizonCeiling);
  return out.join(lang === "zh" ? " + " : " + ");
}
function buildAnswerRows(answers, lang) {
  return SUITABILITY_QUESTIONS.map((q) => {
    const a = answers[q.id];
    let answer;
    if (Array.isArray(a)) {
      const parts = a.map((v) => {
        const o = optionOf(q.id, v);
        return o ? lang === "zh" ? o.zh : o.en : v;
      });
      answer = parts.length ? parts.join(lang === "zh" ? "\u3001" : ", ") : L[lang].none;
    } else {
      const o = a ? optionOf(q.id, a) : void 0;
      answer = o ? lang === "zh" ? o.zh : o.en : "\u2014";
    }
    return {
      order: q.order,
      question: lang === "zh" ? QUESTION_BY_ID[q.id].titleZh : QUESTION_BY_ID[q.id].titleEn,
      answer
    };
  });
}
var DISCLAIMER = {
  en: "This assessment reflects the answers provided and is intended to support a discussion with your financial planner. It is not personalised investment advice and does not constitute a recommendation of any specific product. Return ranges shown are historical long-term references for the stated risk profile; they describe how such portfolios have behaved in the past and may not repeat. The value of investments can fall as well as rise, and you may get back less than you invested. Allocation ranges are strategic guides, not instructions to buy or sell.",
  zh: "\u672C\u8BC4\u4F30\u4F9D\u636E\u4F60\u6240\u63D0\u4F9B\u7684\u4F5C\u7B54\u751F\u6210\uFF0C\u7528\u4E8E\u914D\u5408\u4F60\u4E0E\u7406\u8D22\u89C4\u5212\u5E08\u7684\u8BA8\u8BBA\u3002\u5B83\u5E76\u975E\u4E2A\u4EBA\u5316\u6295\u8D44\u5EFA\u8BAE\uFF0C\u4E5F\u4E0D\u6784\u6210\u5BF9\u4EFB\u4F55\u7279\u5B9A\u4EA7\u54C1\u7684\u63A8\u8350\u3002\u6587\u4E2D\u6240\u5217\u56DE\u62A5\u533A\u95F4\u4E3A\u8BE5\u98CE\u9669\u7C7B\u578B\u7684\u5386\u53F2\u957F\u671F\u53C2\u8003\uFF0C\u7528\u4EE5\u8BF4\u660E\u6B64\u7C7B\u7EC4\u5408\u8FC7\u5F80\u7684\u8868\u73B0\u5F62\u6001\uFF0C\u672A\u6765\u672A\u5FC5\u91CD\u73B0\u3002\u6295\u8D44\u4EF7\u503C\u53EF\u5347\u53EF\u8DCC\uFF0C\u4F60\u6240\u53D6\u56DE\u7684\u91D1\u989D\u53EF\u80FD\u4F4E\u4E8E\u6295\u5165\u672C\u91D1\u3002\u8D44\u4EA7\u914D\u7F6E\u533A\u95F4\u4E3A\u7B56\u7565\u6027\u53C2\u8003\uFF0C\u5E76\u975E\u4E70\u5356\u6307\u793A\u3002"
};

// pdf/suitabilityReport/SuitabilityReportPdf.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var s = StyleSheet.create({
  page: { fontFamily: "NotoSansSC", backgroundColor: C.white, paddingTop: 44, paddingBottom: 56, paddingHorizontal: 46 },
  coverPage: { fontFamily: "NotoSansSC", backgroundColor: C.blue },
  coverInner: { flex: 1, padding: 52 },
  goldRule: { width: 54, height: 3, backgroundColor: C.gold, marginBottom: 18 },
  wordmark: { color: C.white, fontSize: 28, letterSpacing: 1 },
  coverKicker: { color: C.goldLight, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginTop: 30 },
  coverTitle: { color: C.white, fontSize: 24, marginTop: 8, lineHeight: 1.25 },
  coverMetaLabel: { color: C.goldLight, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" },
  coverMetaValue: { color: C.white, fontSize: 12, marginTop: 2 },
  h2: { fontSize: 13, color: C.blue, marginBottom: 10 },
  kicker: { fontSize: 8, color: C.gold, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 5 },
  body: { fontSize: 9.5, color: C.text, lineHeight: 1.7 },
  muted: { fontSize: 8, color: C.muted, lineHeight: 1.6 },
  card: { backgroundColor: C.bg, borderRadius: 8, padding: 14, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center" },
  statRow: { flexDirection: "row", marginBottom: 12 },
  stat: { flex: 1, backgroundColor: C.bg, borderRadius: 8, padding: 10, marginRight: 8 },
  statLabel: { fontSize: 7, color: C.muted, letterSpacing: 0.8, textTransform: "uppercase" },
  statValue: { fontSize: 13, color: C.blue, marginTop: 3 },
  statSub: { fontSize: 7.5, color: C.faint, marginTop: 2 },
  profileBanner: { backgroundColor: C.blue, borderRadius: 8, padding: 18, marginBottom: 14 },
  profileName: { color: C.white, fontSize: 21, marginTop: 4 },
  answerRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.line },
  answerQ: { flex: 1, fontSize: 8, color: C.muted, paddingRight: 10, lineHeight: 1.5 },
  answerA: { width: 190, fontSize: 8, color: C.text, lineHeight: 1.5 },
  footer: { position: "absolute", bottom: 26, left: 46, right: 46, flexDirection: "row", justifyContent: "space-between" },
  footerTxt: { fontSize: 7, color: C.faint }
});
function BandTrack({ band, label, value }) {
  return /* @__PURE__ */ jsxs(View, { style: s.stat, children: [
    /* @__PURE__ */ jsx(Text, { style: s.statLabel, children: label }),
    /* @__PURE__ */ jsx(Text, { style: s.statValue, children: value }),
    /* @__PURE__ */ jsx(View, { style: [s.row, { marginTop: 6 }], children: [1, 2, 3, 4].map((i) => /* @__PURE__ */ jsx(
      View,
      {
        style: {
          flex: 1,
          height: 4,
          borderRadius: 2,
          marginRight: i < 4 ? 3 : 0,
          backgroundColor: i <= band ? C.gold : C.line
        }
      },
      i
    )) })
  ] });
}
function RangeBar({ label, min, max }) {
  return /* @__PURE__ */ jsxs(View, { style: { marginBottom: 9 }, wrap: false, children: [
    /* @__PURE__ */ jsxs(View, { style: [s.row, { justifyContent: "space-between", marginBottom: 3 }], children: [
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 8.5, color: C.text }, children: label }),
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 8.5, color: C.blue }, children: `${min}\u2013${max}%` })
    ] }),
    /* @__PURE__ */ jsx(View, { style: { height: 6, backgroundColor: C.line, borderRadius: 3, position: "relative" }, children: /* @__PURE__ */ jsx(
      View,
      {
        style: {
          position: "absolute",
          left: `${min}%`,
          width: `${Math.max(max - min, 1.5)}%`,
          height: 6,
          backgroundColor: C.gold,
          borderRadius: 3
        }
      }
    ) })
  ] });
}
function SuitabilityReportPdf({ data }) {
  const lang = data.language;
  const tx = L[lang];
  const cs = data.configSnapshot;
  const gapStatus = STATUS[data.expectationGap === "ALIGNED" ? "good" : data.expectationGap === "MODERATE_GAP" ? "warn" : "bad"];
  const answerRows = buildAnswerRows(data.answers, lang);
  const Footer = /* @__PURE__ */ jsxs(View, { style: s.footer, fixed: true, children: [
    /* @__PURE__ */ jsxs(Text, { style: s.footerTxt, children: [
      "XinWealth \xB7 ",
      tx.title
    ] }),
    /* @__PURE__ */ jsx(
      Text,
      {
        style: s.footerTxt,
        render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`
      }
    )
  ] });
  return /* @__PURE__ */ jsxs(Document, { title: `${tx.title} \u2014 ${data.prospectName ?? ""}`.trim(), children: [
    /* @__PURE__ */ jsx(Page, { size: "A4", style: s.coverPage, children: /* @__PURE__ */ jsxs(View, { style: s.coverInner, children: [
      /* @__PURE__ */ jsx(View, { style: s.goldRule }),
      /* @__PURE__ */ jsx(Text, { style: s.wordmark, children: "XinWealth" }),
      /* @__PURE__ */ jsx(Text, { style: s.coverKicker, children: tx.title }),
      /* @__PURE__ */ jsx(Text, { style: s.coverTitle, children: lang === "zh" ? cs.profileNameZh : cs.profileNameEn }),
      /* @__PURE__ */ jsxs(View, { style: { marginTop: 44 }, children: [
        /* @__PURE__ */ jsx(Text, { style: s.coverMetaLabel, children: tx.preparedFor }),
        /* @__PURE__ */ jsx(Text, { style: s.coverMetaValue, children: data.prospectName || "\u2014" })
      ] }),
      /* @__PURE__ */ jsxs(View, { style: { marginTop: 16 }, children: [
        /* @__PURE__ */ jsx(Text, { style: s.coverMetaLabel, children: tx.preparedBy }),
        /* @__PURE__ */ jsx(Text, { style: s.coverMetaValue, children: data.advisorName })
      ] }),
      /* @__PURE__ */ jsxs(View, { style: { marginTop: 16 }, children: [
        /* @__PURE__ */ jsx(Text, { style: s.coverMetaLabel, children: tx.submitted }),
        /* @__PURE__ */ jsx(Text, { style: s.coverMetaValue, children: data.submittedAt })
      ] }),
      /* @__PURE__ */ jsx(View, { style: { marginTop: 44 }, children: /* @__PURE__ */ jsx(Text, { style: { color: "rgba(255,255,255,0.55)", fontSize: 8, lineHeight: 1.7 }, children: tx.reviewNote }) })
    ] }) }),
    /* @__PURE__ */ jsxs(Page, { size: "A4", style: s.page, children: [
      /* @__PURE__ */ jsxs(View, { style: s.profileBanner, children: [
        /* @__PURE__ */ jsx(Text, { style: { color: C.goldLight, fontSize: 8, letterSpacing: 1.6, textTransform: "uppercase" }, children: tx.yourProfile }),
        /* @__PURE__ */ jsx(Text, { style: s.profileName, children: lang === "zh" ? cs.profileNameZh : cs.profileNameEn })
      ] }),
      /* @__PURE__ */ jsx(Text, { style: s.kicker, children: tx.characteristics }),
      /* @__PURE__ */ jsx(Text, { style: [s.body, { marginBottom: 16 }], children: lang === "zh" ? cs.descriptionZh : cs.descriptionEn }),
      /* @__PURE__ */ jsxs(View, { style: s.statRow, children: [
        /* @__PURE__ */ jsxs(View, { style: s.stat, children: [
          /* @__PURE__ */ jsx(Text, { style: s.statLabel, children: tx.horizon }),
          /* @__PURE__ */ jsx(Text, { style: s.statValue, children: lang === "zh" ? cs.horizonZh : cs.horizonEn })
        ] }),
        /* @__PURE__ */ jsxs(View, { style: [s.stat, { marginRight: 0 }], children: [
          /* @__PURE__ */ jsx(Text, { style: s.statLabel, children: lang === "zh" ? cs.returnLabelZh : cs.returnLabelEn }),
          /* @__PURE__ */ jsx(Text, { style: s.statValue, children: fmtRange(cs.returnRange, lang) })
        ] })
      ] }),
      /* @__PURE__ */ jsx(Text, { style: s.kicker, children: tx.expectationCheck }),
      /* @__PURE__ */ jsxs(View, { style: [s.card, { backgroundColor: gapStatus.softBg }], children: [
        /* @__PURE__ */ jsxs(View, { style: [s.row, { justifyContent: "space-between", marginBottom: 8 }], children: [
          /* @__PURE__ */ jsx(Text, { style: { fontSize: 8.5, color: C.muted }, children: tx.yourExpectation }),
          /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, color: gapStatus.fg }, children: fmtTarget(data.targetReturnPct, lang) })
        ] }),
        /* @__PURE__ */ jsx(Text, { style: [s.body, { fontSize: 9 }], children: GAP_TEXT[data.expectationGap]?.[lang] ?? "" })
      ] }),
      /* @__PURE__ */ jsx(Text, { style: s.kicker, children: tx.howDerived }),
      /* @__PURE__ */ jsxs(View, { style: s.statRow, children: [
        /* @__PURE__ */ jsx(
          BandTrack,
          {
            band: data.capacityBand,
            label: tx.capacity,
            value: BAND_NAME[data.capacityBand][lang]
          }
        ),
        /* @__PURE__ */ jsx(
          BandTrack,
          {
            band: data.toleranceBand,
            label: tx.tolerance,
            value: BAND_NAME[data.toleranceBand][lang]
          }
        ),
        /* @__PURE__ */ jsxs(View, { style: [s.stat, { marginRight: 0 }], children: [
          /* @__PURE__ */ jsx(Text, { style: s.statLabel, children: tx.boundBy }),
          /* @__PURE__ */ jsx(Text, { style: [s.statValue, { fontSize: 10 }], children: bindingDimensions(data, lang) }),
          /* @__PURE__ */ jsx(Text, { style: s.statSub, children: lang === "zh" ? "\u6700\u7EC8\u7C7B\u578B\u53D6\u4E09\u8005\u4E2D\u6700\u4FDD\u5B88\u7684\u4E00\u9879" : "The most conservative of the three sets the profile" })
        ] })
      ] }),
      Footer
    ] }),
    /* @__PURE__ */ jsxs(Page, { size: "A4", style: s.page, children: [
      /* @__PURE__ */ jsx(Text, { style: s.h2, children: tx.allocation }),
      /* @__PURE__ */ jsxs(View, { style: s.card, children: [
        /* @__PURE__ */ jsx(
          RangeBar,
          {
            label: tx.defensive,
            min: cs.allocation?.defensive.min ?? 0,
            max: cs.allocation?.defensive.max ?? 0
          }
        ),
        /* @__PURE__ */ jsx(
          RangeBar,
          {
            label: tx.growth,
            min: cs.allocation?.growth.min ?? 0,
            max: cs.allocation?.growth.max ?? 0
          }
        ),
        /* @__PURE__ */ jsx(
          RangeBar,
          {
            label: tx.diversifier,
            min: cs.allocation?.diversifier.min ?? 0,
            max: cs.allocation?.diversifier.max ?? 0
          }
        ),
        cs.allocation?.capApplied && /* @__PURE__ */ jsx(Text, { style: [s.muted, { marginTop: 6, color: STATUS.warn.fg }], children: tx.capNote })
      ] }),
      /* @__PURE__ */ jsx(Text, { style: s.h2, children: tx.answers }),
      /* @__PURE__ */ jsx(View, { children: answerRows.map((r) => /* @__PURE__ */ jsxs(View, { style: s.answerRow, wrap: false, children: [
        /* @__PURE__ */ jsxs(Text, { style: s.answerQ, children: [
          r.order,
          ". ",
          r.question
        ] }),
        /* @__PURE__ */ jsx(Text, { style: s.answerA, children: r.answer })
      ] }, r.order)) }),
      Footer
    ] }),
    /* @__PURE__ */ jsxs(Page, { size: "A4", style: s.page, children: [
      /* @__PURE__ */ jsx(Text, { style: s.h2, children: tx.disclaimer }),
      /* @__PURE__ */ jsx(Text, { style: [s.body, { fontSize: 8.5, color: C.muted }], children: DISCLAIMER[lang] }),
      /* @__PURE__ */ jsxs(Text, { style: [s.muted, { marginTop: 20 }], children: [
        tx.rules,
        " v",
        data.ruleVersion,
        " \xB7 ",
        tx.generated,
        " ",
        data.generatedDate
      ] }),
      Footer
    ] })
  ] });
}

// pdf/suitabilityReport/renderNode.ts
var FONT_REL = "public/fonts/NotoSansSC-Regular.ttf";
var FONT_CANDIDATES = [
  path.join(process.cwd(), FONT_REL),
  path.join(process.cwd(), "..", FONT_REL),
  path.join("/var/task", FONT_REL)
];
function fontCandidates() {
  return [...FONT_CANDIDATES];
}
function resolveFontPath() {
  for (const p of FONT_CANDIDATES) {
    try {
      if (fs.existsSync(p))
        return p;
    } catch {
    }
  }
  return null;
}
async function renderSuitabilityPdf(data) {
  const fontPath = resolveFontPath();
  if (!fontPath) {
    throw new Error(
      `CJK font not found. Tried: ${FONT_CANDIDATES.join(", ")}. Check vercel.json functions["api/suitability.ts"].includeFiles.`
    );
  }
  registerFonts(fontPath);
  Font2.registerHyphenationCallback(splitForCjkWrap);
  return renderToBuffer(React.createElement(SuitabilityReportPdf, { data }));
}
export {
  fontCandidates,
  renderSuitabilityPdf,
  resolveFontPath
};
