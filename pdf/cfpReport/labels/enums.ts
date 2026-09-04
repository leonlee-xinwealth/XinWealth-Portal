// Display labels for the raw DB enums that reach the report's tables.
//
// Without these, the balance sheet prints `epf_account_1` and `mortgage` at a
// VIP client — the defect the 2026-07-20 handoff logged as 🟡 "tables show raw
// enums". The keys here are the live `public.asset_type` / `public.liability_type`
// Postgres enums; `enums.test.ts` asserts the maps stay exhaustive, so adding a
// value to the DB without a label fails the build rather than shipping tofu.
//
// Tax relief labels are NOT here — `RELIEFS` in
// supabase/functions/cfp-brain/modules/tax/rates2026.ts already carries
// `label_zh` and the tax module emits it on `reliefs_detail[].label`.

import type { CfpReportLanguage } from "../types";

/** Balance-sheet grouping. The blueprint wants 流动性资产 called out separately
 *  from 投资资产 and 自住/固定资产 on P8's composition chart. */
export type AssetGroup = "liquid" | "investment" | "retirement" | "fixed";

export interface EnumLabel {
  zh: string;
  en: string;
}

export interface AssetTypeMeta extends EnumLabel {
  group: AssetGroup;
}

export interface LiabilityTypeMeta extends EnumLabel {
  /** revolving consumer debt — P10 highlights these as 高息负债 */
  highInterest: boolean;
  /** secured against an asset, so it nets off rather than signalling distress */
  secured: boolean;
}

export const ASSET_TYPES: Record<string, AssetTypeMeta> = {
  savings:       { zh: "储蓄存款",     en: "Savings",           group: "liquid" },
  fixed_deposit: { zh: "定期存款",     en: "Fixed Deposit",     group: "liquid" },
  money_market:  { zh: "货币市场基金", en: "Money Market Fund", group: "liquid" },
  epf_account_1: { zh: "公积金 户口一", en: "EPF Account 1",    group: "retirement" },
  epf_account_2: { zh: "公积金 户口二", en: "EPF Account 2",    group: "retirement" },
  epf_account_3: { zh: "公积金 户口三", en: "EPF Account 3",    group: "retirement" },
  unit_trust:    { zh: "信托基金",     en: "Unit Trust",        group: "investment" },
  stock:         { zh: "股票",         en: "Stocks",            group: "investment" },
  bond:          { zh: "债券",         en: "Bonds",             group: "investment" },
  etf:           { zh: "交易所交易基金", en: "ETF",             group: "investment" },
  property:      { zh: "房产",         en: "Property",          group: "fixed" },
  vehicle:       { zh: "车辆",         en: "Vehicle",           group: "fixed" },
  business:      { zh: "生意股权",     en: "Business Interest", group: "fixed" },
  other:         { zh: "其他资产",     en: "Other Asset",       group: "fixed" },
};

export const LIABILITY_TYPES: Record<string, LiabilityTypeMeta> = {
  mortgage:        { zh: "房屋贷款", en: "Mortgage",        highInterest: false, secured: true },
  car_loan:        { zh: "汽车贷款", en: "Car Loan",        highInterest: false, secured: true },
  personal_loan:   { zh: "个人贷款", en: "Personal Loan",   highInterest: true,  secured: false },
  study_loan:      { zh: "教育贷款", en: "Study Loan",      highInterest: false, secured: false },
  renovation_loan: { zh: "装修贷款", en: "Renovation Loan", highInterest: false, secured: false },
  credit_card:     { zh: "信用卡",   en: "Credit Card",     highInterest: true,  secured: false },
  business_loan:   { zh: "商业贷款", en: "Business Loan",   highInterest: false, secured: false },
  other:           { zh: "其他负债", en: "Other Liability", highInterest: false, secured: false },
};

export const ASSET_GROUP_LABELS: Record<AssetGroup, EnumLabel> = {
  liquid:     { zh: "流动资产", en: "Liquid Assets" },
  investment: { zh: "投资资产", en: "Investment Assets" },
  retirement: { zh: "退休资产", en: "Retirement Assets" },
  fixed:      { zh: "固定资产", en: "Fixed Assets" },
};

/** Order the balance sheet groups top-to-bottom, most liquid first. */
export const ASSET_GROUP_ORDER: AssetGroup[] = ["liquid", "investment", "retirement", "fixed"];

/** An unmapped enum falls back to the raw key rather than an empty cell — a
 *  visible oddity beats a silently missing row, and the test catches it first. */
export function assetTypeLabel(type: string, lang: CfpReportLanguage): string {
  return ASSET_TYPES[type]?.[lang] ?? type;
}

export function liabilityTypeLabel(type: string, lang: CfpReportLanguage): string {
  return LIABILITY_TYPES[type]?.[lang] ?? type;
}

export function assetGroupOf(type: string): AssetGroup {
  return ASSET_TYPES[type]?.group ?? "fixed";
}

export function isHighInterest(type: string): boolean {
  return LIABILITY_TYPES[type]?.highInterest ?? false;
}

// --------------------------------------------------------------- demographics
// Free-text-ish columns on `clients`. Anything unrecognised falls through to
// the raw value rather than a dash: an unmapped status is still information,
// and silently blanking it would make the profile page look incomplete when the
// record is not.

const MARITAL_LABELS: Record<string, string> = {
  single: "单身",
  married: "已婚",
  divorced: "离异",
  widowed: "丧偶",
  separated: "分居",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  employed: "受雇",
  self_employed: "自雇",
  business_owner: "企业主",
  unemployed: "待业",
  retired: "已退休",
  student: "在学",
};

function labelOf(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return map[value.toLowerCase()] ?? value;
}

export function maritalLabel(value: string | null | undefined): string {
  return labelOf(MARITAL_LABELS, value);
}

export function employmentLabel(value: string | null | undefined): string {
  return labelOf(EMPLOYMENT_LABELS, value);
}
