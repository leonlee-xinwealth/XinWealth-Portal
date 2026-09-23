// Deterministic Capital Need Analysis. All monetary math lives here — the LLM
// only narrates these numbers and must never compute or alter them.
//
// P5 (2026-09-26-cfp-p5-insurance-design.md, 决策 1): this is now THE ONE
// canonical gap formula — the advisor panel, the client portal and both PDF
// exporters all read this output instead of computing their own. The extra
// `death`/`tpd`/`ci`/`ci_early_cover`/`medical`/`pa`/`excluding_group` fields
// below are ADDITIVE: `needs`/`resources`/`gaps` keep every field and every
// existing test's numbers (when no `coverage` detail is supplied, `gaps`
// behaves exactly as before). The one deliberate value change is that
// `needs.liabilities`/`needs.total_life`/`gaps[key="life"]` now net out any
// liability balance an in-force MRTA/MLTA policy already covers
// (`coverage.liabilities_covered_by_policy`) — that offset defaults to 0, so
// every caller that doesn't pass policy-level detail sees identical numbers.

export const CNA_DEFAULTS = {
  income_replacement_years: 10,
  education_per_child: 80000,
  education_inflation: 0.04,
  education_years: 10,
  ci_income_multiple: 3,
  rounding: 1000,
} as const;

export interface CnaInput {
  annual_income: number;
  /** true when income was estimated from a form band midpoint */
  income_estimated?: boolean;
  /** null = unknown (prospect mode), treated as 0 with an assumption note */
  liabilities_total: number | null;
  liquid_assets: number | null;
  life_cover: number;
  ci_cover: number;
  has_medical: boolean;
  dependents: number;
  /** real education-goal future cost (from client_goals via the CFP baseline);
   * replaces the per-child constant estimate when present */
  education_need_override?: number;
  /**
   * P5 决策 1: full per-category coverage detail (group-employer flags, MRTA
   * offset, medical annual limit, PA, …), built from live policy rows by
   * `buildCfpCnaInput`. Omitted by the prospect path and any legacy caller —
   * `computeCna` then derives an equivalent detail set from `life_cover`/
   * `ci_cover`/`has_medical` alone (no group distinction, TPD assumed from
   * the life sum assured, no medical/PA/early-CI data), so `death`/`tpd`/
   * `ci`/`medical` still come back populated instead of empty.
   */
  coverage?: CnaCoverageDetail;
  /**
   * Same shape as `coverage`, computed with every `is_group_employer` policy
   * excluded — decision 1's "不含团保" gap. Defaults to `coverage` itself
   * (i.e. no visible difference) when omitted; mapping.ts always supplies
   * both together whenever it supplies either.
   */
  coverage_excluding_group?: CnaCoverageDetail;
}

/** One category's live policy detail, aggregated by mapping.ts from DB rows.
 * `liabilities_covered_by_policy` is the outstanding balance of any liability
 * an in-force/paid-up MRTA/MLTA policy (life + `covers_liability_id`) covers —
 * folded into the death/TPD need, never a separate line item. */
export interface CnaCoverageDetail {
  death_cover: number;
  death_has_group: boolean;
  tpd_cover: number;
  tpd_has_group: boolean;
  /** true when no distinct TPD item exists and TPD cover was inferred from
   *  the life/ILP base plan's own sum assured (always true today — the
   *  schema has no separate TPD rider category; kept as a flag so a future
   *  explicit TPD item can turn it off without changing this shape). */
  tpd_assumed_from_life: boolean;
  ci_cover: number;
  ci_has_group: boolean;
  /** early/advance-stage critical illness payout — not separately tracked by
   *  any policy_riders category today, so mapping.ts always reports 0 with an
   *  explanatory note; kept as its own field for when that data exists. */
  ci_early_cover: number;
  ci_early_has_group: boolean;
  has_medical: boolean;
  /** highest annual limit across in-scope medical riders/policies, RM */
  medical_annual_limit: number;
  medical_has_group: boolean;
  /** personal accident cover — supplementary, no need computed against it */
  pa_cover: number;
  pa_has_group: boolean;
  liabilities_covered_by_policy: number;
}

/** A single category's need/cover/gap, decision 1's `{need?, cover, gap?,
 * notes[]}` shape. `need`/`gap` are omitted for categories that are
 * cover-only (medical, PA, early CI) — mirrors `CnaGap.flag_only` below but as
 * an absent field rather than a boolean flag. Every note is bilingual
 * ("中文说明 / English explanation") so either the advisor panel or the
 * client portal can print it verbatim without a second translation pass. */
export interface CnaLineItem {
  need?: number;
  cover: number;
  gap?: number;
  notes: string[];
}

export interface CnaMedicalItem extends CnaLineItem {
  has_cover: boolean;
  annual_limit: number;
  /** annual_limit < RM1,000,000 while has_cover is true — decision 1 */
  low_limit: boolean;
}

export interface CnaProtectionSet {
  death: CnaLineItem;
  tpd: CnaLineItem;
  ci: CnaLineItem;
  ci_early_cover: CnaLineItem;
  medical: CnaMedicalItem;
  pa: CnaLineItem;
}

export interface CnaGap {
  key: "life" | "ci" | "medical";
  label: string;
  need?: number;
  covered?: number;
  gap?: number;
  flag_only?: boolean;
  has_cover?: boolean;
}

export interface CnaResult extends CnaProtectionSet {
  assumptions: string[];
  inputs: CnaInput;
  needs: {
    income_replacement: number;
    liabilities: number;
    education: number;
    total_life: number;
    ci: number;
  };
  resources: {
    life_cover: number;
    ci_cover: number;
    liquid_assets: number;
  };
  gaps: CnaGap[];
  /** true when income is unknown/zero — numbers are not meaningful */
  insufficient: boolean;
  /** P5 决策 1: the same six categories above, recomputed with every
   *  group-employer policy excluded from cover (needs are identical — only
   *  cover/gap/has_cover/annual_limit can differ). */
  excluding_group: CnaProtectionSet;
}

const round = (n: number) =>
  Math.round(n / CNA_DEFAULTS.rounding) * CNA_DEFAULTS.rounding;

/** Midpoint (monthly RM) of the funnel form's income band; 0 if unrecognized. */
export function incomeBandMidpoint(band: string): number {
  const map: Record<string, number> = {
    "RM3,000 以下": 2000,
    "RM3,000-5,000": 4000,
    "RM5,000-8,000": 6500,
    "RM8,000-12,000": 10000,
    "RM12,000 以上": 15000,
  };
  return map[(band ?? "").trim()] ?? 0;
}

const NOTE_GROUP_COVER =
  "含团保，离职即失效 / Includes group-employer cover, which lapses once employment ends";
const NOTE_TPD_ASSUMED =
  "假设寿险含 TPD，保单未单独列明全残保障 / Assumes the life plan's sum assured also covers TPD (no separate TPD benefit on file)";
const NOTE_MEDICAL_LOW_LIMIT =
  "医疗卡年限额偏低（低于 RM1,000,000） / Medical card annual limit is low (below RM1,000,000)";
const NOTE_MEDICAL_NO_COVER =
  "未见医疗卡保障 / No medical card cover on file";
const NOTE_CI_EARLY_NOT_TRACKED =
  "系统未单独记录早期/晚期重疾赔付比例，如保单含此项请人工核对 / Early-stage critical illness payout isn't tracked separately — verify manually if the policy includes one";
const noteMrtaOffset = (amount: number) =>
  `已扣除 MRTA/MLTA 保单覆盖的房贷余额 RM${amount.toLocaleString()} / Excludes RM${amount.toLocaleString()} of mortgage balance already covered by an MRTA/MLTA policy`;

/** `computeCna` callers that only have the legacy flat inputs (prospect mode,
 * or any caller predating decision 1) get an equivalent detail set derived
 * from `life_cover`/`ci_cover`/`has_medical` — no group data, TPD assumed
 * from life, no medical limit/PA/early-CI data. */
function defaultCoverageDetail(input: CnaInput): CnaCoverageDetail {
  return {
    death_cover: input.life_cover,
    death_has_group: false,
    tpd_cover: input.life_cover,
    tpd_has_group: false,
    tpd_assumed_from_life: true,
    ci_cover: input.ci_cover,
    ci_has_group: false,
    ci_early_cover: 0,
    ci_early_has_group: false,
    has_medical: input.has_medical,
    medical_annual_limit: 0,
    medical_has_group: false,
    pa_cover: 0,
    pa_has_group: false,
    liabilities_covered_by_policy: 0,
  };
}

function lineItem(
  need: number | undefined,
  cover: number,
  notes: string[],
): CnaLineItem {
  const item: CnaLineItem = { cover: round(cover), notes };
  if (need != null) {
    item.need = round(need);
    item.gap = round(Math.max(0, need - cover));
  }
  return item;
}

/** Builds the six-category breakdown for one coverage detail set (main, or
 * excluding-group). `needBasis` carries the raw (unrounded) shared figures —
 * income replacement/liabilities/education/liquid assets/CI need — so the
 * main and excluding-group sets are computed off the exact same numbers,
 * differing only in `cov`. */
function buildProtectionSet(
  cov: CnaCoverageDetail,
  needBasis: {
    incomeReplacement: number;
    liabilitiesGross: number;
    education: number;
    liquidAssets: number;
    ciNeed: number;
  },
): CnaProtectionSet {
  const netLiabilities = Math.max(
    0,
    needBasis.liabilitiesGross - cov.liabilities_covered_by_policy,
  );
  // Decision 1's literal formula (need has liquid assets subtracted directly)
  // — algebraically identical to the legacy needs.total_life/gaps[life] split
  // (need = income+liab+edu, covered = cover+liquid) whenever death_cover
  // equals life_cover, which mapping.ts guarantees.
  const lifeNeed = needBasis.incomeReplacement + netLiabilities +
    needBasis.education - needBasis.liquidAssets;

  const deathNotes: string[] = [];
  if (cov.death_has_group) deathNotes.push(NOTE_GROUP_COVER);
  if (cov.liabilities_covered_by_policy > 0) {
    deathNotes.push(noteMrtaOffset(cov.liabilities_covered_by_policy));
  }

  const tpdNotes: string[] = [];
  if (cov.tpd_has_group) tpdNotes.push(NOTE_GROUP_COVER);
  if (cov.tpd_assumed_from_life) tpdNotes.push(NOTE_TPD_ASSUMED);
  if (cov.liabilities_covered_by_policy > 0) {
    tpdNotes.push(noteMrtaOffset(cov.liabilities_covered_by_policy));
  }

  const ciNotes: string[] = [];
  if (cov.ci_has_group) ciNotes.push(NOTE_GROUP_COVER);

  const ciEarlyNotes: string[] = [NOTE_CI_EARLY_NOT_TRACKED];
  if (cov.ci_early_has_group) ciEarlyNotes.push(NOTE_GROUP_COVER);

  const lowLimit = cov.has_medical && cov.medical_annual_limit < 1_000_000;
  const medicalNotes: string[] = [];
  if (!cov.has_medical) medicalNotes.push(NOTE_MEDICAL_NO_COVER);
  if (lowLimit) medicalNotes.push(NOTE_MEDICAL_LOW_LIMIT);
  if (cov.medical_has_group) medicalNotes.push(NOTE_GROUP_COVER);

  const paNotes: string[] = [];
  if (cov.pa_has_group) paNotes.push(NOTE_GROUP_COVER);

  return {
    death: lineItem(lifeNeed, cov.death_cover, deathNotes),
    tpd: lineItem(lifeNeed, cov.tpd_cover, tpdNotes),
    ci: lineItem(needBasis.ciNeed, cov.ci_cover, ciNotes),
    ci_early_cover: lineItem(undefined, cov.ci_early_cover, ciEarlyNotes),
    medical: {
      ...lineItem(undefined, cov.medical_annual_limit, medicalNotes),
      has_cover: cov.has_medical,
      annual_limit: round(cov.medical_annual_limit),
      low_limit: lowLimit,
    },
    pa: lineItem(undefined, cov.pa_cover, paNotes),
  };
}

export function computeCna(input: CnaInput): CnaResult {
  const d = CNA_DEFAULTS;
  const useEducationOverride = input.education_need_override != null;
  const assumptions: string[] = [
    `收入替代年数按 ${d.income_replacement_years} 年计算`,
    useEducationOverride
      ? "教育金需求取自客户的真实教育目标（目标规划模块推算的未来成本）"
      : `教育金按每名受抚养人 RM${d.education_per_child.toLocaleString()}、` +
        `每年 ${d.education_inflation * 100}% 通胀、${d.education_years} 年期估算`,
    `重疾保障需求按年收入 ${d.ci_income_multiple} 倍估算`,
    `所有金额取整到最近 RM${d.rounding.toLocaleString()}`,
  ];

  if (input.income_estimated) {
    assumptions.push("年收入按表单收入区间中值估算，实际数字可能有出入");
  }
  if (input.liabilities_total === null) {
    assumptions.push("未提供负债资料，暂按 RM0 计算，实际缺口可能更大");
  }
  if (input.liquid_assets === null) {
    assumptions.push("未提供流动资产资料，暂按 RM0 计算");
  }

  const liabilities = input.liabilities_total ?? 0;
  const liquidAssets = input.liquid_assets ?? 0;

  const incomeReplacement = input.annual_income * d.income_replacement_years;
  const education = useEducationOverride
    ? input.education_need_override!
    : input.dependents * d.education_per_child *
      Math.pow(1 + d.education_inflation, d.education_years);
  const ciNeed = input.annual_income * d.ci_income_multiple;

  const mainCoverage = input.coverage ?? defaultCoverageDetail(input);
  const exGroupCoverage = input.coverage_excluding_group ?? mainCoverage;

  // Decision 1: the death/TPD need nets out any liability balance an
  // in-force MRTA/MLTA policy already covers — this is now the ONE figure
  // both `needs.total_life`/`gaps[life]` (legacy) and `death`/`tpd` (below)
  // rest on, so they never disagree.
  const netLiabilitiesMain = Math.max(
    0,
    liabilities - mainCoverage.liabilities_covered_by_policy,
  );
  const totalLifeNeed = incomeReplacement + netLiabilitiesMain + education;

  const lifeCovered = input.life_cover + liquidAssets;
  const lifeGap = Math.max(0, totalLifeNeed - lifeCovered);
  const ciGap = Math.max(0, ciNeed - input.ci_cover);

  const needBasis = {
    incomeReplacement,
    liabilitiesGross: liabilities,
    education,
    liquidAssets,
    ciNeed,
  };
  const mainSet = buildProtectionSet(mainCoverage, needBasis);
  const exGroupSet = buildProtectionSet(exGroupCoverage, needBasis);

  return {
    assumptions,
    inputs: input,
    needs: {
      income_replacement: round(incomeReplacement),
      liabilities: round(netLiabilitiesMain),
      education: round(education),
      total_life: round(totalLifeNeed),
      ci: round(ciNeed),
    },
    resources: {
      life_cover: round(input.life_cover),
      ci_cover: round(input.ci_cover),
      liquid_assets: round(liquidAssets),
    },
    gaps: [
      {
        key: "life",
        label: "人寿保障",
        need: round(totalLifeNeed),
        covered: round(lifeCovered),
        gap: round(lifeGap),
      },
      {
        key: "ci",
        label: "重疾保障",
        need: round(ciNeed),
        covered: round(input.ci_cover),
        gap: round(ciGap),
      },
      {
        key: "medical",
        label: "医疗保障",
        flag_only: true,
        has_cover: input.has_medical,
      },
    ],
    insufficient: input.annual_income <= 0,
    death: mainSet.death,
    tpd: mainSet.tpd,
    ci: mainSet.ci,
    ci_early_cover: mainSet.ci_early_cover,
    medical: mainSet.medical,
    pa: mainSet.pa,
    excluding_group: exGroupSet,
  };
}
