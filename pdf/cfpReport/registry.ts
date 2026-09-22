// The fixed template: page order as declarative data.
//
// This list IS the report's structure. Generating a report for a new client
// pours data into these 29 slots — nothing reorders, nothing is conditionally
// dropped. A module with no data still emits its page carrying an EmptyState,
// because a skipped page would renumber everything after it and invalidate the
// table of contents.
//
// Blueprint: 诊断 (M1-M3) → 防守 (M4-M5) → 进攻 (M6-M7) → 优化 (M8-M9) → 封底 (M10).

import type React from "react";
import type { CfpReportData } from "./types";

export type ModuleNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface CfpPageProps {
  data: CfpReportData;
  /** 1-based position in the finished document */
  pageNumber: number;
}

export interface CfpPageDef {
  /** stable identifier; page numbers are derived, never hard-coded */
  id: string;
  module: ModuleNo;
  /** table-of-contents entry; omitted for cover, TOC, disclaimer, back cover */
  nav?: { zh: string; en: string };
  Component: React.ComponentType<CfpPageProps>;
}

export const MODULE_TITLES: Record<ModuleNo, { zh: string; en: string }> = {
  1: { zh: "报告前置与核心指引", en: "Front Matter" },
  2: { zh: "财务现状盘点", en: "Financial Status" },
  3: { zh: "财务健康诊断", en: "Financial Health Diagnostics" },
  4: { zh: "保险与风险管理", en: "Insurance Planning" },
  5: { zh: "遗嘱与财富传承", en: "Estate Planning" },
  6: { zh: "投资组合规划", en: "Investment Planning" },
  7: { zh: "退休生涯规划", en: "Retirement Planning" },
  8: { zh: "税务规划", en: "Tax Planning" },
  9: { zh: "专项财务目标", en: "Financial Goals" },
  10: { zh: "联系我们", en: "Contact" },
};

/**
 * Page identifiers, in document order. Components are attached in
 * `pages/index.ts` — keeping them out of this file lets tests and the TOC
 * reason about structure without pulling in every page's rendering code.
 */
export const PAGE_ORDER = [
  // M1 报告前置
  { id: "cover", module: 1 },
  { id: "toc", module: 1 },
  { id: "disclaimer", module: 1 },
  { id: "exec-summary", module: 1, nav: { zh: "执行摘要", en: "Executive Summary" } },
  { id: "profile", module: 1, nav: { zh: "客户个人资料", en: "Personal Profile" } },
  // M2 财务现状
  { id: "cashflow-overview", module: 2, nav: { zh: "现金流概览", en: "Cash Flow Overview" } },
  { id: "cashflow-detail", module: 2, nav: { zh: "现金流明细", en: "Cash Flow Details" } },
  { id: "balance-overview", module: 2, nav: { zh: "资产负债表概览", en: "Balance Sheet Overview" } },
  { id: "assets-detail", module: 2, nav: { zh: "资产明细", en: "Asset Details" } },
  { id: "liabilities-detail", module: 2, nav: { zh: "负债明细", en: "Liability Details" } },
  // M3 健康诊断
  { id: "ratios-1", module: 3, nav: { zh: "财务比率诊断", en: "Financial Ratio Diagnostics" } },
  { id: "ratios-2", module: 3, nav: { zh: "比率解读与达标线", en: "Ratio Interpretation" } },
  { id: "insights", module: 3, nav: { zh: "综合财务分析与洞察", en: "Overall Insights" } },
  // M4 防守 · 保险
  { id: "insurance-concept", module: 4, nav: { zh: "保险规划理念", en: "Insurance Principles" } },
  { id: "insurance-gap", module: 4, nav: { zh: "保障缺口与后果", en: "Coverage Gap & Consequences" } },
  { id: "insurance-plan", module: 4, nav: { zh: "风险管理建议", en: "Risk Recommendations" } },
  // M5 防守 · 传承
  { id: "estate-concept", module: 5, nav: { zh: "有无遗嘱的差别", en: "Testate vs Intestate" } },
  { id: "estate-findings", module: 5, nav: { zh: "传承现状与后果", en: "Estate Findings & Impact" } },
  { id: "estate-plan", module: 5, nav: { zh: "传承规划建议", en: "Estate Recommendations" } },
  // M6 进攻 · 投资
  { id: "suitability", module: 6, nav: { zh: "投资适宜性评估", en: "Investment Suitability" } },
  { id: "portfolio", module: 6, nav: { zh: "投资组合盘点与调整", en: "Portfolio Review" } },
  // M7 进攻 · 退休
  { id: "retirement-vision", module: 7, nav: { zh: "退休目标与定义", en: "Retirement Vision" } },
  { id: "retirement-runout", module: 7, nav: { zh: "退休资金寿命推演", en: "Cash Run-Out Projection" } },
  { id: "retirement-plan", module: 7, nav: { zh: "退休延寿方案", en: "Retirement Recommendations" } },
  // M8 优化 · 税务
  { id: "tax-findings", module: 8, nav: { zh: "税务减免盘点", en: "Tax Relief Review" } },
  { id: "tax-plan", module: 8, nav: { zh: "税务优化对照", en: "Tax Optimization" } },
  // M9 落地 · 目标
  { id: "goals-timeline", module: 9, nav: { zh: "专项目标时间轴", en: "Goal Timeline" } },
  { id: "goals-funding", module: 9, nav: { zh: "攒钱系统与进度", en: "Funding Plan" } },
  // M10 封底
  { id: "back-cover", module: 10 },
] as const satisfies readonly Omit<CfpPageDef, "Component">[];

export type CfpPageId = (typeof PAGE_ORDER)[number]["id"];

export const CFP_PAGE_COUNT = PAGE_ORDER.length;

/**
 * 1-based page number for an id. Because the template is fixed these are
 * compile-time constants, which is what lets the TOC print real page numbers
 * without a two-pass render.
 */
export function pageNumberOf(id: CfpPageId): number {
  const i = PAGE_ORDER.findIndex((p) => p.id === id);
  if (i < 0) throw new Error(`unknown page id: ${id}`);
  return i + 1;
}

/**
 * True for the first page of each module. Those pages wear the full-bleed navy
 * band instead of the light title lockup, so the reader gets a visual breath at
 * every section change rather than 29 identically-architected pages.
 *
 * Derived from position rather than hand-flagged: reordering the registry can
 * never leave two openers in one module or none at all.
 */
export function isModuleOpener(id: CfpPageId): boolean {
  const i = PAGE_ORDER.findIndex((p) => p.id === id);
  if (i < 0) throw new Error(`unknown page id: ${id}`);
  return i === 0 || PAGE_ORDER[i - 1].module !== PAGE_ORDER[i].module;
}

/** TOC rows: every page that declares a nav entry, with its page number. */
export function tocEntries(): Array<{ id: string; module: ModuleNo; zh: string; en: string; page: number }> {
  return PAGE_ORDER.flatMap((p, i) =>
    "nav" in p && p.nav
      ? [{ id: p.id, module: p.module as ModuleNo, zh: p.nav.zh, en: p.nav.en, page: i + 1 }]
      : [],
  );
}
