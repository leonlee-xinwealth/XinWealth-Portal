// P14-P16 保险与风险管理 — reads insurance_planning.content.
//
// The CNA breakdown and policy_overview have been present in the section since
// the module shipped but were never rendered; the old report drew three coverage
// bars and dropped everything else. These are the pages the blueprint cares most
// about, because this is where 缺口 turns into 后果.

import type { CfpReportData } from "../types";
import type { TableRow } from "../viz/DataTable";
import { money } from "../viz/DataTable";

/**
 * The CNA's gap keys. Mirrors CNA_GAP_KEYS in
 * supabase/functions/cfp-brain/modules/insurance/section.ts, which is the enum
 * the model's `consequences.headline_key` is constrained to — the two lists
 * have to be the same or P15 prints a headline with no figure beside it.
 * __tests__/narrative.test.ts pins them together.
 */
export const INSURANCE_GAP_KEYS = ["life", "ci", "medical"] as const;

export interface CoverageGap {
  key: "life" | "ci" | "medical";
  label: string;
  need: number | null;
  covered: number | null;
  gap: number | null;
  /** medical is a yes/no, not an amount */
  flagOnly: boolean;
  hasCover: boolean;
}

/**
 * P5 决策 1: one of the CNA's six categories — `computeCna`'s `CnaLineItem`
 * shape (see supabase/functions/_shared/insurance/cna.ts), read as-is. `need`/
 * `gap` are null for the cover-only categories (早期重疾/医药/意外).
 */
export interface CnaCategoryLine {
  key: "death" | "tpd" | "ci" | "ci_early_cover" | "medical" | "pa";
  label: string;
  need: number | null;
  cover: number;
  gap: number | null;
  notes: string[];
}

export interface CnaMedicalLine extends CnaCategoryLine {
  hasCover: boolean;
  annualLimit: number;
  lowLimit: boolean;
  limitUnknown: boolean;
}

export interface CnaCategories {
  death: CnaCategoryLine;
  tpd: CnaCategoryLine;
  ci: CnaCategoryLine;
  ciEarlyCover: CnaCategoryLine;
  medical: CnaMedicalLine;
  pa: CnaCategoryLine;
}

export interface InsuranceView {
  hasData: boolean;
  /** true when income is unknown, so the CNA figures mean nothing */
  insufficient: boolean;
  needs: { incomeReplacement: number; liabilities: number; education: number; totalLife: number; ci: number } | null;
  resources: { lifeCover: number; ciCover: number; liquidAssets: number } | null;
  gaps: CoverageGap[];
  /**
   * P5 决策 1: the six-category breakdown (身故/TPD/重疾/早期重疾/医药/意外).
   * Null on a report generated before this field shipped — `content.cna` is a
   * frozen snapshot, so an old saved report's JSON simply lacks these keys;
   * the page falls back to `gaps`/`needs`/`resources` above in that case.
   */
  categories: CnaCategories | null;
  /** Same six categories with every group-employer policy excluded — null
   *  under the same legacy-content rule as `categories`. */
  excludingGroup: CnaCategories | null;
  /** true when excluding group cover actually changes a category's cover —
   *  i.e. the client holds at least one group policy worth mentioning. */
  hasGroupCover: boolean;
  policies: Array<{
    provider: string;
    type: string;
    sumAssured: number | null;
    cashValue: number | null;
    annualPremium: number;
  }>;
  annualPremiumTotal: number;
  assumptions: string[];
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const CATEGORY_LABELS: Record<CnaCategoryLine["key"], string> = {
  death: "身故",
  tpd: "全残（TPD）",
  ci: "重疾",
  ci_early_cover: "早期重疾（保障）",
  medical: "医药",
  pa: "意外（保障）",
};

function categoryLine(key: CnaCategoryLine["key"], raw: unknown): CnaCategoryLine {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    key,
    label: CATEGORY_LABELS[key],
    need: num(r.need),
    cover: num(r.cover) ?? 0,
    gap: num(r.gap),
    notes: Array.isArray(r.notes) ? r.notes.map(String) : [],
  };
}

function medicalLine(raw: unknown): CnaMedicalLine {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ...categoryLine("medical", raw),
    hasCover: r.has_cover === true,
    annualLimit: num(r.annual_limit) ?? 0,
    lowLimit: r.low_limit === true,
    limitUnknown: r.limit_unknown === true,
  };
}

function categoriesOf(raw: Record<string, unknown> | null | undefined): CnaCategories | null {
  // `death` is the anchor: computeCna always emits every one of the six keys
  // together (buildProtectionSet), so its presence (as an object) is exactly
  // the signal that this content was generated after P5 shipped.
  if (!raw || typeof raw.death !== "object" || raw.death === null) return null;
  return {
    death: categoryLine("death", raw.death),
    tpd: categoryLine("tpd", raw.tpd),
    ci: categoryLine("ci", raw.ci),
    ciEarlyCover: categoryLine("ci_early_cover", raw.ci_early_cover),
    medical: medicalLine(raw.medical),
    pa: categoryLine("pa", raw.pa),
  };
}

/** True when at least one category's cover actually changes once group
 *  policies are excluded — the client has a group policy worth calling out,
 *  rather than merely having an (identical) excluding_group set present. */
function groupCoverMatters(main: CnaCategories, exGroup: CnaCategories): boolean {
  const keys: Array<keyof CnaCategories> = ["death", "tpd", "ci", "ciEarlyCover", "pa"];
  if (keys.some((k) => main[k].cover !== exGroup[k].cover)) return true;
  return main.medical.annualLimit !== exGroup.medical.annualLimit;
}

export function selectInsurance(data: CfpReportData): InsuranceView {
  const c = data.sections?.find((s) => s.section_type === "insurance_planning")?.content ?? null;
  const empty: InsuranceView = {
    hasData: false, insufficient: false, needs: null, resources: null,
    gaps: [], categories: null, excludingGroup: null, hasGroupCover: false,
    policies: [], annualPremiumTotal: 0, assumptions: [],
  };
  if (!c) return empty;

  const cna = c.cna ?? null;
  const gaps: CoverageGap[] = Array.isArray(cna?.gaps)
    ? cna.gaps.map((g: Record<string, unknown>) => ({
        key: (g.key as CoverageGap["key"]) ?? "life",
        label: String(g.label ?? ""),
        need: num(g.need),
        covered: num(g.covered),
        gap: num(g.gap),
        flagOnly: g.flag_only === true,
        hasCover: g.has_cover === true,
      }))
    : [];

  const categories = categoriesOf(cna);
  const excludingGroup = categories ? categoriesOf(cna?.excluding_group) ?? categories : null;
  const hasGroupCover = categories != null && excludingGroup != null
    ? groupCoverMatters(categories, excludingGroup)
    : false;

  return {
    hasData: true,
    insufficient: cna?.insufficient === true,
    categories,
    excludingGroup,
    hasGroupCover,
    needs: cna?.needs
      ? {
          incomeReplacement: num(cna.needs.income_replacement) ?? 0,
          liabilities: num(cna.needs.liabilities) ?? 0,
          education: num(cna.needs.education) ?? 0,
          totalLife: num(cna.needs.total_life) ?? 0,
          ci: num(cna.needs.ci) ?? 0,
        }
      : null,
    resources: cna?.resources
      ? {
          lifeCover: num(cna.resources.life_cover) ?? 0,
          ciCover: num(cna.resources.ci_cover) ?? 0,
          liquidAssets: num(cna.resources.liquid_assets) ?? 0,
        }
      : null,
    gaps,
    policies: Array.isArray(c.policy_overview)
      ? c.policy_overview.map((p: Record<string, unknown>) => ({
          // A policy with no provider name still has to print something the
          // client can match against their own paperwork.
          provider: String(p.provider ?? "").trim() || "未具名保单",
          type: String(p.policy_type ?? "").trim() || "—",
          sumAssured: num(p.sum_assured),
          cashValue: num(p.cash_value),
          annualPremium: num(p.annual_premium) ?? 0,
        }))
      : [],
    annualPremiumTotal: num(c.annual_premium_total) ?? 0,
    assumptions: Array.isArray(cna?.assumptions) ? cna.assumptions.map(String) : [],
  };
}

/** P15: what the life cover has to do, and how much of it is funded. */
export function needsRows(v: InsuranceView): TableRow[] {
  if (!v.needs || !v.resources) return [];
  const n = v.needs;
  return [
    { kind: "group", label: "身故保障需求" },
    { kind: "row", label: "收入替代", indent: true, value: money(n.incomeReplacement) },
    { kind: "row", label: "清偿负债", indent: true, value: money(n.liabilities) },
    { kind: "row", label: "子女教育金", indent: true, value: money(n.education) },
    { kind: "subtotal", label: "身故保障需求合计", value: money(n.totalLife) },
    { kind: "group", label: "现有资源" },
    { kind: "row", label: "现有人寿保额", indent: true, value: money(v.resources.lifeCover) },
    { kind: "row", label: "可动用流动资产", indent: true, value: money(v.resources.liquidAssets) },
    {
      kind: "total",
      label: "保障缺口",
      value: money(Math.max(0, n.totalLife - v.resources.lifeCover)),
    },
  ];
}

/** P16: the existing book of policies, finally printed. */
export function policyRows(v: InsuranceView): TableRow[] {
  if (v.policies.length === 0) return [];
  const rows: TableRow[] = v.policies
    .slice()
    .sort((a, b) => (b.sumAssured ?? 0) - (a.sumAssured ?? 0))
    .map((p) => ({
      kind: "row" as const,
      label: p.provider,
      meta: p.type,
      value: p.sumAssured != null ? money(p.sumAssured) : "—",
    }));
  rows.push({ kind: "total", label: "年缴保费合计", value: money(v.annualPremiumTotal) });
  return rows;
}

/**
 * Premium as a share of annual income — the 预算错配 check the blueprint asks
 * for. Rule of thumb is 10%–15%; above that the client is paying for cover at
 * the expense of everything else.
 */
export function premiumBurden(
  v: InsuranceView,
  annualIncome: number | null | undefined,
): { share: number; band: "good" | "warn" | "bad" } | null {
  if (!annualIncome || annualIncome <= 0 || v.annualPremiumTotal <= 0) return null;
  const share = v.annualPremiumTotal / annualIncome;
  return { share, band: share <= 0.15 ? "good" : share <= 0.2 ? "warn" : "bad" };
}
