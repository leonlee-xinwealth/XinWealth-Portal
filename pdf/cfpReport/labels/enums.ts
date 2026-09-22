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
import {
  ASSET_TYPES as TAXONOMY_ASSETS,
  LIABILITY_TYPES as TAXONOMY_LIABILITIES,
  type AssetClass,
} from "../../../supabase/functions/_shared/taxonomy/balance";
import { categoryLabel } from "../../../supabase/functions/_shared/taxonomy/cashflow";

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

/** Report grouping per taxonomy class (spec §3.3). */
const GROUP_BY_CLASS: Record<AssetClass, AssetGroup> = {
  A: "liquid",
  B: "retirement",
  C: "investment",
  D: "fixed",
};

// Derived from the taxonomy so the report can never print a type the
// database holds but this file forgot. `enums.test.ts` keeps them honest.
export const ASSET_TYPES: Record<string, AssetTypeMeta> = Object.fromEntries(
  TAXONOMY_ASSETS.map((a) => [a.code, { zh: a.label_zh, en: a.label_en, group: GROUP_BY_CLASS[a.class] }]),
);

export const LIABILITY_TYPES: Record<string, LiabilityTypeMeta> = Object.fromEntries(
  TAXONOMY_LIABILITIES.map((l) => [
    l.code,
    { zh: l.label_zh, en: l.label_en, highInterest: l.high_interest, secured: l.secured },
  ]),
);

export const ASSET_GROUP_LABELS: Record<AssetGroup, EnumLabel> = {
  liquid:     { zh: "流动资产", en: "Liquid Assets" },
  investment: { zh: "投资资产", en: "Investment Assets" },
  retirement: { zh: "退休资产", en: "Retirement Assets" },
  fixed:      { zh: "自用资产", en: "Personal-use Assets" },
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

/** A cash-flow category code as the client should read it. */
export function cashflowCategoryLabel(code: string | null | undefined, lang: CfpReportLanguage): string {
  return categoryLabel(code, lang === "en" ? "en" : "zh");
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
