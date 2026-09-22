// 资产与负债分类 — spec 2026-09-22 §3.3–3.4, §5.4.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE MUST HAVE NO IMPORTS (see cashflow.ts).
// ─────────────────────────────────────────────────────────────────────────────
//
// Codes keep the live `asset_type` / `liability_type` enum spellings wherever the
// meaning did not change (epf_account_1, bond, business, other): renaming a
// Postgres enum value breaks every deployed reader at the same instant, and the
// edge functions and Vercel ship separately. Only the labels moved.
//
// `property` survives solely so rows written before 2026-09-23 still resolve —
// it is read as a personal-use asset (the conservative reading) until an
// advisor confirms it. New rows use own_residence / investment_property.

export type AssetClass = "A" | "B" | "C" | "D";
export type AssetPurpose = "personal_use" | "income_producing" | "investment";
export type Liquidity = "liquid" | "semi" | "illiquid";
export type LiquidityLevel = "high" | "medium" | "low";
export type AllocationBucket = "equity" | "bond" | "alternatives";
export type LiabilityTerm = "short" | "long";

export interface AssetClassMeta {
  id: AssetClass;
  label_zh: string;
  label_en: string;
}

export const ASSET_CLASSES: readonly AssetClassMeta[] = [
  { id: "A", label_zh: "流动资产", label_en: "Liquid assets" },
  { id: "B", label_zh: "退休专户", label_en: "Retirement accounts" },
  { id: "C", label_zh: "投资资产", label_en: "Investment assets" },
  { id: "D", label_zh: "自用资产", label_en: "Personal-use assets" },
];

export interface AssetTypeMeta {
  code: string;
  label_zh: string;
  label_en: string;
  class: AssetClass;
  /** null for A/B: purpose only matters where holding reasons differ */
  default_purpose: AssetPurpose | null;
  liquidity: Liquidity;
  /**
   * Counts toward retirement capital (spec §5.4): class B plus the class C
   * holdings that can actually be drawn down. Investment property contributes
   * its net rent as an income stream instead (P3), and land, business equity,
   * receivables, SSPN (earmarked for education) and unidentified `other` are
   * left out rather than guessed at.
   */
  retirement_capital: boolean;
  /** the investment module's allocation bucket; null = outside the portfolio */
  allocation: AllocationBucket | null;
  /** offered when adding a new asset; false = legacy spelling kept for old rows */
  offered: boolean;
}

type AssetRow = [
  code: string, label_zh: string, label_en: string, cls: AssetClass,
  purpose: AssetPurpose | null, liquidity: Liquidity, retirement: boolean,
  allocation: AllocationBucket | null, offered?: boolean,
];

const ASSET_ROWS: readonly AssetRow[] = [
  // A 流动资产
  ["savings", "储蓄/往来户口", "Savings / current account", "A", null, "liquid", false, null],
  ["fixed_deposit", "定期存款", "Fixed deposit", "A", null, "liquid", false, null],
  ["money_market", "货币市场基金", "Money market fund", "A", null, "liquid", false, null],
  ["cash_on_hand", "现金", "Cash on hand", "A", null, "liquid", false, null],
  ["ewallet", "电子钱包", "E-wallet", "A", null, "liquid", false, null],
  ["foreign_currency", "外币存款", "Foreign currency deposit", "A", null, "liquid", false, null],
  // B 退休专户
  ["epf_account_1", "公积金 退休户口", "EPF Akaun Persaraan", "B", null, "illiquid", true, null],
  ["epf_account_2", "公积金 福利户口", "EPF Akaun Sejahtera", "B", null, "illiquid", true, null],
  ["epf_account_3", "公积金 灵活户口", "EPF Akaun Fleksibel", "B", null, "illiquid", true, null],
  ["prs", "私人退休计划 PRS", "Private Retirement Scheme", "B", null, "illiquid", true, null],
  // C 投资资产
  ["stock", "股票", "Stocks", "C", "investment", "semi", true, "equity"],
  ["etf", "ETF", "ETF", "C", "investment", "semi", true, "equity"],
  ["unit_trust", "单位信托", "Unit trust", "C", "investment", "semi", true, "equity"],
  ["reit", "房地产投资信托", "REIT", "C", "income_producing", "semi", true, "equity"],
  ["bond", "债券/伊斯兰债券", "Bond / sukuk", "C", "investment", "illiquid", true, "bond"],
  ["asnb", "ASB/ASNB", "ASNB (ASB / ASM)", "C", "investment", "semi", true, "bond"],
  ["tabung_haji", "朝圣基金", "Tabung Haji", "C", "investment", "illiquid", true, "bond"],
  ["gold", "黄金/贵金属", "Gold / precious metals", "C", "investment", "illiquid", true, "alternatives"],
  ["crypto", "加密货币", "Crypto", "C", "investment", "illiquid", true, "alternatives"],
  ["forex", "外汇", "Forex", "C", "investment", "illiquid", true, "alternatives"],
  ["investment_property", "投资房产", "Investment property", "C", "income_producing", "illiquid", false, null],
  ["land", "土地", "Land", "C", "investment", "illiquid", false, null],
  ["business", "企业股权", "Business equity", "C", "investment", "illiquid", false, "alternatives"],
  ["receivable", "借出的钱", "Loan receivable", "C", "investment", "illiquid", false, null],
  ["sspn", "SSPN 教育储蓄", "SSPN", "C", "investment", "illiquid", false, null],
  ["other", "其他投资资产", "Other investment asset", "C", "investment", "illiquid", false, null],
  // D 自用资产
  ["own_residence", "自住房", "Own residence", "D", "personal_use", "illiquid", false, null],
  ["vehicle", "车", "Vehicle", "D", "personal_use", "illiquid", false, null],
  ["jewelry", "珠宝", "Jewelry", "D", "personal_use", "illiquid", false, null],
  ["collectibles", "收藏品", "Collectibles", "D", "personal_use", "illiquid", false, null],
  ["personal_asset_other", "其他自用资产", "Other personal-use asset", "D", "personal_use", "illiquid", false, null],
  ["property", "房产（待确认用途）", "Property (purpose unconfirmed)", "D", "personal_use", "illiquid", false, null, false],
];

export const ASSET_TYPES: readonly AssetTypeMeta[] = ASSET_ROWS.map(
  ([code, label_zh, label_en, cls, purpose, liquidity, retirement, allocation, offered = true]) => ({
    code,
    label_zh,
    label_en,
    class: cls,
    default_purpose: purpose,
    liquidity,
    retirement_capital: retirement,
    allocation,
    offered,
  }),
);

const ASSET_BY_CODE: Readonly<Record<string, AssetTypeMeta>> = Object.fromEntries(
  ASSET_TYPES.map((a) => [a.code, a]),
);

export const EPF_ASSET_TYPES: readonly string[] = ["epf_account_1", "epf_account_2", "epf_account_3"];

/** Emergency-fund-eligible: class A. */
export const LIQUID_ASSET_TYPES: readonly string[] = ASSET_TYPES
  .filter((a) => a.class === "A")
  .map((a) => a.code);

export function assetTypeMeta(code: string | null | undefined): AssetTypeMeta | null {
  return code ? ASSET_BY_CODE[code] ?? null : null;
}

/** Unknown types count nowhere, so they fall into D (personal use). */
export function assetClassOf(code: string | null | undefined): AssetClass {
  return assetTypeMeta(code)?.class ?? "D";
}

export function isLiquid(code: string | null | undefined): boolean {
  return assetClassOf(code) === "A";
}

/** The value to store in assets.liquidity (the liquidity_level enum). */
export function liquidityLevel(code: string | null | undefined): LiquidityLevel {
  const l = assetTypeMeta(code)?.liquidity ?? "illiquid";
  return l === "liquid" ? "high" : l === "semi" ? "medium" : "low";
}

export function isRetirementCapital(code: string | null | undefined): boolean {
  return assetTypeMeta(code)?.retirement_capital ?? false;
}

export function allocationBucketOf(code: string | null | undefined): AllocationBucket | null {
  return assetTypeMeta(code)?.allocation ?? null;
}

export function assetTypeLabel(code: string | null | undefined, lang: "zh" | "en"): string {
  const a = assetTypeMeta(code);
  if (!a) return code ?? "";
  return lang === "zh" ? a.label_zh : a.label_en;
}

export interface LiabilityTypeMeta {
  code: string;
  label_zh: string;
  label_en: string;
  term: LiabilityTerm;
  /** revolving consumer debt — the report highlights these as 高息负债 */
  high_interest: boolean;
  /** secured against an asset */
  secured: boolean;
  /** the O2 cash-flow category its repayment belongs to (auto-generated in P2) */
  installment_category: string | null;
}

type LiabilityRow = [
  code: string, label_zh: string, label_en: string, term: LiabilityTerm,
  high_interest: boolean, secured: boolean, installment_category: string | null,
];

const LIABILITY_ROWS: readonly LiabilityRow[] = [
  ["credit_card", "信用卡欠款", "Credit card balance", "short", true, false, "credit_card_payment"],
  ["bnpl", "先买后付", "Buy now, pay later", "short", true, false, "bnpl_payment"],
  ["overdraft", "透支", "Overdraft", "short", true, false, "finance_charges"],
  ["tax_payable", "应缴税款", "Tax payable", "short", false, false, "income_tax"],
  ["family_loan", "亲友借款", "Loan from family / friends", "short", false, false, "family_loan_repayment"],
  ["mortgage", "房屋贷款", "Mortgage", "long", false, true, "mortgage_installment"],
  ["car_loan", "汽车贷款", "Car loan (hire purchase)", "long", false, true, "car_installment"],
  ["personal_loan", "个人贷款", "Personal loan", "long", true, false, "personal_loan_installment"],
  ["study_loan", "教育贷款", "Study loan (PTPTN)", "long", false, false, "study_loan_installment"],
  ["renovation_loan", "装修贷款", "Renovation loan", "long", false, false, "renovation_loan_installment"],
  ["asb_financing", "ASB 贷款", "ASB financing", "long", false, true, "asb_financing_installment"],
  ["share_margin", "股票融资", "Share margin financing", "long", false, true, "share_margin_interest"],
  ["policy_loan", "保单贷款", "Policy loan", "long", false, true, null],
  ["business_loan", "商业贷款", "Business loan", "long", false, false, "business_loan_installment"],
  ["other", "其他负债", "Other liability", "long", false, false, "debt_other"],
];

export const LIABILITY_TYPES: readonly LiabilityTypeMeta[] = LIABILITY_ROWS.map(
  ([code, label_zh, label_en, term, high_interest, secured, installment_category]) => ({
    code, label_zh, label_en, term, high_interest, secured, installment_category,
  }),
);

const LIABILITY_BY_CODE: Readonly<Record<string, LiabilityTypeMeta>> = Object.fromEntries(
  LIABILITY_TYPES.map((l) => [l.code, l]),
);

export function liabilityTypeMeta(code: string | null | undefined): LiabilityTypeMeta | null {
  return code ? LIABILITY_BY_CODE[code] ?? null : null;
}

export function liabilityTypeLabel(code: string | null | undefined, lang: "zh" | "en"): string {
  const l = liabilityTypeMeta(code);
  if (!l) return code ?? "";
  return lang === "zh" ? l.label_zh : l.label_en;
}
