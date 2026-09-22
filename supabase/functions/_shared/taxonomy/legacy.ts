// Reading pre-2026-09-23 data, and the KYC / LevelUp forms that still speak the
// old vocabulary, into the new chart of accounts — spec 附录 A.
//
// Used by: the one-off remap generator (scripts/build-legacy-remap.ts), and the
// api/kyc.js + api/levelUp.js write paths via api/_lib/taxonomy.mjs.
//
// Imports stay inside this folder and carry the `.ts` extension, which Deno,
// Vite/vitest (allowImportingTsExtensions) and esbuild all resolve. The browser
// bundle never loads this file.

import { CATEGORY_BY_CODE, LEGACY_CATEGORY_MAP, type CashflowDirection } from "./cashflow.ts";
import { assetTypeMeta } from "./balance.ts";

export interface LegacyRow {
  direction: CashflowDirection;
  category: string;
  source_note?: string | null;
  frequency?: string | null;
  is_recurring?: boolean | null;
}

export interface Classified {
  code: string;
  /** set only when the stored frequency must change */
  frequency: string | null;
  /** set only when the stored is_recurring must change */
  is_recurring: boolean | null;
  needs_review: boolean;
  review_reason: string | null;
}

interface NoteRule {
  to: string;
  pattern: RegExp;
  /** only for rows whose (legacy) category is one of these */
  from?: readonly string[];
  /** generic: never outvotes a specific match, never counts as a second item */
  weak?: boolean;
}

// First match wins, so specific rules sit above the generic ones they overlap.
const OUTFLOW_NOTE_RULES: readonly NoteRule[] = [
  { to: "self_education", pattern: /^school fees$/i, from: ["personal"] },
  { to: "motor_insurance", pattern: /car insurance|motor insurance/i },
  { to: "road_tax", pattern: /road tax/i },
  { to: "car_installment", pattern: /car loan|hire purchase|车贷/i },
  { to: "bnpl_payment", pattern: /pay ?later|bnpl|atome/i },
  { to: "subscriptions", pattern: /subscription|icloud|youtube|netflix|spotify|software|订阅/i },
  { to: "telco", pattern: /tel\/|mobile|internet|phone|\bdata\b|astro|unifi|wifi|电话|网络/i },
  { to: "utilities", pattern: /utilit|electric|water|\btnb\b|sewer|水电/i },
  { to: "groceries", pattern: /grocer|marketing|supermarket|买菜|杂货/i },
  { to: "home_repair", pattern: /home maintenance|repair|renovat|维修/i },
  { to: "household_help", pattern: /maid|helper|女佣/i },
  { to: "toll_parking", pattern: /parking|toll|停车/i },
  { to: "fuel", pattern: /petrol|fuel|diesel|汽油/i },
  { to: "public_transport_ehailing", pattern: /\bbus\b|mrt|lrt|taxi|car share|grab|e-hailing|train/i },
  { to: "car_service_repair", pattern: /servic|workshop|tyre|tire/i },
  { to: "health_medical", pattern: /medic|clinic|hospital|doctor|dental|optical|supplement|pharma|医/i },
  { to: "childcare", pattern: /child ?care|nursery|babysit|托儿/i },
  { to: "school_fees", pattern: /school|kindergar|tadika|university|college|学费/i },
  { to: "tuition_enrichment", pattern: /upgrading class|tuition|enrichment|补习/i },
  { to: "parents_allowance", pattern: /parent|mother|father|\bmum\b|\bdad\b|senior living|父母/i },
  { to: "other_dependants", pattern: /dependant/i },
  { to: "pet_care", pattern: /\bpets?\b|宠物/i },
  { to: "fitness", pattern: /gym|fitness|sport|健身/i },
  { to: "dining_out", pattern: /dining|restaurant|food delivery|foodpanda|外食/i },
  { to: "entertainment", pattern: /entertain|movie|cinema|karaoke|娱乐/i },
  { to: "personal_care", pattern: /personal care|clothing|salon|haircut|cosmetic|beauty/i },
  { to: "travel", pattern: /vacation|travel|holiday|trip|旅游/i },
  { to: "zakat_tithe", pattern: /zakat|tithe|天课/i },
  { to: "donations", pattern: /donation|charity|gift|捐/i },
  { to: "income_tax", pattern: /income tax|\bpcb\b|cp500|所得税/i },
  { to: "child_expenses", pattern: /child|\bkid|孩子|子女/i, weak: true },
  { to: "debt_other", pattern: /loan|repayment|installment|还款|贷款/i, weak: true },
  { to: "protection_other", pattern: /insurance|takaful|premium|保险|保费/i, weak: true },
  { to: "investment_other", pattern: /invest|unit trust|fixed deposit|\basb\b|\bprs\b|储蓄|投资/i, weak: true },
];

/** The KYC form collects these two per YEAR even though it stored them monthly. */
const KYC_YEARLY_NOTES = new Set(["Vacation/ Travel", "Income Tax Expense"]);

/** LevelUp wrote its option labels straight into `category`. */
const LEVELUP_INFLOW_LABELS: Readonly<Record<string, string>> = {
  "salary": "salary_basic",
  "bonus / one-off incentives": "bonus",
  "director fee": "director_fee",
  "commission / referral fee": "commission",
  "dividend from own company": "dividend_company",
  "investment dividends / interest": "dividend_investment",
  "rental income": "rental_income",
  "other": "other_income",
  "income": "other_income",
};
const LEVELUP_OUTFLOW_LABELS: Readonly<Record<string, string>> = {
  "household": "household",
  "transportation": "transportation",
  "dependants": "dependants",
  "personal": "personal",
  "miscellaneous": "miscellaneous",
  "other expenses": "other_expense",
  "expense": "other_expense",
};

const norm = (s: string) => s.trim().toLowerCase();

/** A current code that is itself a catch-all still gets its note read. */
const isCatchAll = (code: string) =>
  code.endsWith("_other") || code === "other_expense" || code === "other_income";

function withReason(c: Classified, reason: string): Classified {
  return {
    ...c,
    needs_review: true,
    review_reason: c.review_reason ? `${c.review_reason}；${reason}` : reason,
  };
}

function classifyInflow(row: LegacyRow): Classified {
  const raw = row.category ?? "";
  const known = CATEGORY_BY_CODE[raw]
    ? raw
    : LEGACY_CATEGORY_MAP[raw] ?? LEVELUP_INFLOW_LABELS[norm(raw)] ?? null;
  let c: Classified = {
    code: known ?? "other_income",
    frequency: null,
    is_recurring: null,
    needs_review: false,
    review_reason: null,
  };
  if (!known) c = withReason(c, "无法识别的收入分类");
  if (c.code === "bonus" && row.is_recurring === false) {
    c = withReason(
      { ...c, frequency: "annual", is_recurring: true },
      "花红已改为按年计算，请确认金额是全年总额",
    );
  }
  if (c.code === "other_income" && row.source_note) {
    c = withReason(c, "请确认这笔流入是收入，还是资产变现或借款（不算收入）");
  }
  return c;
}

function classifyOutflow(row: LegacyRow): Classified {
  const raw = row.category ?? "";
  const legacy = LEVELUP_OUTFLOW_LABELS[norm(raw)] ?? raw;
  const current = CATEGORY_BY_CODE[legacy] ? legacy : null;
  const fallback = LEGACY_CATEGORY_MAP[legacy] ?? current;
  const note = (row.source_note ?? "").trim();

  // A specific current code is already where it belongs.
  if (current && !isCatchAll(current)) {
    return { code: current, frequency: null, is_recurring: null, needs_review: false, review_reason: null };
  }

  // "All - Household" is the form's own group-level line: it names the group,
  // not an item, so no note rule applies.
  const isGroupLine = /^all\s*-/i.test(note);
  const matched = isGroupLine ? [] : OUTFLOW_NOTE_RULES.filter(
    (r) => (!r.from || r.from.includes(legacy)) && r.pattern.test(note),
  );
  // A category-scoped rule is a deliberate override ("School Fees" under
  // personal is the client's own course), so it wins outright.
  const scoped = matched.find((r) => r.from);
  const hits = scoped ? [scoped] : matched;
  const strong = hits.filter((r) => !r.weak);
  const pick = strong[0] ?? hits[0] ?? null;

  let c: Classified = {
    code: pick?.to ?? fallback ?? "other_expense",
    frequency: null,
    is_recurring: null,
    needs_review: false,
    review_reason: null,
  };

  if (new Set(strong.map((r) => r.to)).size > 1) {
    c = withReason(c, "一行包含多个项目，请拆分后分别归类");
  }
  if (!pick && !fallback) c = withReason(c, "无法识别的支出分类");
  if (!pick && fallback && note && !isGroupLine) {
    c = withReason(c, "备注未能自动归类，请选择具体分类");
  }
  if (KYC_YEARLY_NOTES.has(note) && (row.frequency ?? "monthly") === "monthly") {
    c = withReason({ ...c, frequency: "annual" }, "KYC 中该项按年填写，已改为按年");
  }
  const cat = CATEGORY_BY_CODE[c.code];
  if (cat?.group === "O2" && cat.wealth_effect === "split") {
    c = withReason(c, "还款行：第二阶段会由负债自动生成月供，届时去重");
  }
  if (cat?.group === "O3") {
    c = withReason(c, "保费行：第二阶段会由保单自动生成，届时去重");
  }
  return c;
}

/** One stored cash-flow row → where it belongs now. */
export function classifyCashflowRow(row: LegacyRow): Classified {
  return row.direction === "inflow" ? classifyInflow(row) : classifyOutflow(row);
}

export interface ClassifiedAsset {
  asset_type: string;
  needs_review: boolean;
  review_reason: string | null;
}

const ASSET_NAME_RULES: readonly NoteRule[] = [
  { to: "own_residence", pattern: /own ?stay|own house|自住|residence|my home/i, from: ["property"] },
  { to: "investment_property", pattern: /invest|for rent|rental|出租|投资/i, from: ["property"] },
  { to: "gold", pattern: /gold|emas|黄金|\bmiga\b/i, from: ["other"] },
  { to: "jewelry", pattern: /jewel|珠宝/i, from: ["other"] },
  { to: "asnb", pattern: /\basb\b|\basm\b|asnb|amanah saham/i, from: ["other"] },
  { to: "tabung_haji", pattern: /tabung haji/i, from: ["other"] },
  { to: "crypto", pattern: /crypto|bitcoin|\bbtc\b|\beth\b|加密/i, from: ["other"] },
  { to: "forex", pattern: /forex|\bfx\b|外汇/i, from: ["other"] },
  { to: "collectibles", pattern: /watch|\bart\b|collect|收藏/i, from: ["other"] },
];

/** Reads `property` and `other` rows by name; every other type is kept. */
export function classifyAsset(a: { asset_type: string; name?: string | null }): ClassifiedAsset {
  if (a.asset_type !== "property" && a.asset_type !== "other") {
    return { asset_type: a.asset_type, needs_review: false, review_reason: null };
  }
  const name = a.name ?? "";
  const hits = ASSET_NAME_RULES.filter((r) => r.from!.includes(a.asset_type) && r.pattern.test(name));
  if (a.asset_type === "property") {
    if (hits.length === 1) return { asset_type: hits[0].to, needs_review: false, review_reason: null };
    return {
      asset_type: "own_residence",
      needs_review: true,
      review_reason: "请确认这项房产是自住还是投资",
    };
  }
  if (hits.length === 0) {
    return { asset_type: "other", needs_review: true, review_reason: "请选择具体的资产类型" };
  }
  const distinct = new Set(hits.map((h) => h.to));
  return distinct.size > 1
    ? { asset_type: hits[0].to, needs_review: true, review_reason: "名称包含多种资产，请拆分或确认类型" }
    : { asset_type: hits[0].to, needs_review: false, review_reason: null };
}

const LEVELUP_ASSET_LABELS: Readonly<Record<string, string>> = {
  "cash/savings": "savings",
  "fixed deposit": "fixed_deposit",
  "epf": "epf_account_1",
  "properties": "property",
  "vehicles": "vehicle",
  "other assets": "other",
  "etf": "etf",
  "stocks": "stock",
  "unit trusts": "unit_trust",
  "bonds": "bond",
  "forex": "forex",
  "gold/precious metals": "gold",
  "crypto": "crypto",
  "other investments": "other",
};

/** A LevelUp asset / investment option label (plus the typed description). */
export function levelUpAsset(label: string | null | undefined, description?: string | null): ClassifiedAsset {
  const mapped = LEVELUP_ASSET_LABELS[norm(label ?? "")] ?? "other";
  const c = classifyAsset({ asset_type: mapped, name: description ?? label ?? "" });
  return assetTypeMeta(c.asset_type) ? c : { asset_type: "other", needs_review: true, review_reason: "请选择具体的资产类型" };
}

const LEVELUP_LIABILITY_LABELS: Readonly<Record<string, string>> = {
  "mortgage / property loan": "mortgage",
  "vehicle loan": "car_loan",
  "study loan": "study_loan",
  "personal loan": "personal_loan",
  "renovation loan": "renovation_loan",
  "other loans": "other",
};

export function levelUpLiabilityType(label: string | null | undefined): string {
  return LEVELUP_LIABILITY_LABELS[norm(label ?? "")] ?? "other";
}
