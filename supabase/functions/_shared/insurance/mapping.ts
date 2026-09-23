// Maps raw inputs (funnel form text / n8n extraction strings / DB rows) into
// the deterministic CnaInput. No LLM, no network.

import { type CnaCoverageDetail, type CnaInput, incomeBandMidpoint } from "./cna.ts";
import { isLiquid } from "../taxonomy/balance.ts";

/** "RM500,000" / "500000.50" / "unknown" → number (0 when unparseable). */
export function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return isFinite(raw) ? raw : 0;
  if (typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

/** "2 个孩子" / "3" / "无" → dependents count (0 default). */
export function parseDependents(raw: unknown): number {
  if (typeof raw === "number") return Math.max(0, Math.floor(raw));
  if (typeof raw !== "string") return 0;
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

interface ExtractedPolicy {
  policy_type?: string;
  sum_assured?: unknown;
  [k: string]: unknown;
}

const LIFE_TYPES_EXTRACTED = ["term life", "whole life", "investment-linked"];

/** Build CnaInput from funnel profile + Gemini extraction results.
 * manual_coverage carries self-reported amounts when no policy files exist. */
export function buildProspectCnaInput(
  profile: {
    monthly_income_band?: string;
    dependents?: unknown;
    manual_coverage?: {
      life?: number;
      ci?: number;
      medical?: number;
      pa?: number;
      annual_premium?: number;
    };
  },
  extractedPolicies: ExtractedPolicy[],
): CnaInput {
  const mc = profile.manual_coverage ?? {};
  let lifeCover = mc.life ?? 0;
  let ciCover = mc.ci ?? 0;
  let hasMedical = (mc.medical ?? 0) > 0;
  for (const p of extractedPolicies ?? []) {
    const type = (p.policy_type ?? "").toLowerCase();
    const sum = parseAmount(p.sum_assured);
    if (LIFE_TYPES_EXTRACTED.some((t) => type.includes(t))) lifeCover += sum;
    if (type.includes("critical illness")) ciCover += sum;
    if (type.includes("medical")) hasMedical = true;
  }
  return {
    annual_income: incomeBandMidpoint(profile.monthly_income_band ?? "") * 12,
    income_estimated: true,
    liabilities_total: null,
    liquid_assets: null,
    life_cover: lifeCover,
    ci_cover: ciCover,
    has_medical: hasMedical,
    dependents: parseDependents(profile.dependents),
  };
}

const LIFE_POLICY_TYPES = ["life", "investment_linked"];

const PREMIUM_ANNUALIZE: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  single_premium: 0,
};

const CASHFLOW_ANNUALIZE: Record<string, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  one_off: 0,
};

export interface CfpFinancials {
  client: {
    id: string;
    // Identifying fields are optional — cfp-brain never fetches them (PII
    // stays out of the function); only the legacy insurance-brain db.ts does.
    full_name?: string;
    email?: string | null;
    phone?: string | null;
    date_of_birth: string | null;
    number_of_dependants: number;
    occupation: string | null;
    retirement_age: number | null;
    marital_status: string | null;
  };
  inflows: Array<{ amount: number; frequency: string; category: string }>;
  liabilities: Array<{
    // P5 决策 1: matches a policy's `covers_liability_id` so an in-force
    // MRTA/MLTA policy's linked mortgage balance can be netted out of the
    // death/TPD need. Optional — absent on any caller that predates this.
    id?: string | null;
    liability_type: string;
    name: string;
    outstanding_balance: number;
    monthly_payment: number | null;
  }>;
  assets: Array<{ asset_type: string; current_value: number }>;
  policies: Array<{
    policy_type: string;
    provider: string | null;
    sum_assured: number | null;
    premium: number | null;
    premium_frequency: string | null;
    // Extended fields for the CFP section's policy_overview table. They are
    // filled into the section JSON by code AFTER the LLM call — never into
    // prompts (enforced by section.test.ts PII sentinels).
    policy_number?: string | null;
    cash_value?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    // P5 决策 2 (migration 20260926000001_insurance_policy_status.sql):
    // lifecycle + group/MRTA linkage. All optional/nullable so every caller
    // that doesn't select these columns yet keeps compiling and behaves
    // exactly as before (treated as in_force, non-group, no MRTA link).
    status?: string | null;
    is_group_employer?: boolean | null;
    covers_liability_id?: string | null;
    nomination_type?: string | null;
    // P5 决策 1 correction: a standalone medical policy_type='medical' row's
    // own annual limit — insurance_policies has no dedicated column for this
    // (it lives in the row's `metadata` jsonb on some rows), so the caller
    // (db.ts) is responsible for lifting it out into this plain field before
    // building CnaInput; absent/null just means "not recorded".
    annual_limit?: number | null;
    // Per-policy riders — each carries its own coverage category + amount.
    // Non-identifying fields only (no rider/product names) so they can safely
    // feed the LLM prompt.
    policy_riders?: Array<{
      category: string;
      sum_assured: number | null;
      room_board_daily?: number | null;
      annual_limit?: number | null;
      lifetime_limit?: number | null;
    }>;
  }>;
}

type CfpPolicy = CfpFinancials["policies"][number];
type CfpLiability = CfpFinancials["liabilities"][number];

// Rider categories that count toward each protection type (mirrors the advisor
// portal's InsuranceGapPanel so the report matches what the advisor sees).
const CI_RIDER_CATEGORIES = ["critical_illness", "cancer"];

/** P5 决策 1: only in_force (or unset — every pre-P5 row) and paid_up
 * policies count toward cover; paid_up carries no premium (handled in
 * derived.ts) but its sum assured is still real cover. lapsed/surrendered/
 * matured policies count toward nothing. */
function isCoverageCounted(p: { status?: string | null }): boolean {
  return p.status == null || p.status === "in_force" || p.status === "paid_up";
}

/**
 * Aggregates one coverage detail set (decision 1's death/TPD/CI/medical/PA +
 * MRTA offset) from live policy rows. Called twice by buildCfpCnaInput — once
 * over every counted policy, once with `is_group_employer` policies excluded
 * — so `coverage` and `coverage_excluding_group` are built the exact same way
 * and can never silently drift apart.
 */
function buildCoverageDetail(
  policies: CfpPolicy[],
  liabilities: CfpLiability[],
  excludeGroup: boolean,
): CnaCoverageDetail {
  const pool = policies.filter((p) =>
    isCoverageCounted(p) && (!excludeGroup || p.is_group_employer !== true)
  );

  let deathCover = 0, deathHasGroup = false;
  // TPD's OWN cover — policy_type='disability' base plans + 'disability'
  // riders (live-data correction: the schema DOES carry this, on both the
  // base plan and as a rider category — the earlier "always assume TPD rides
  // on the life sum assured" was wrong).
  let disabilityCover = 0, disabilityHasGroup = false;
  let ciCover = 0, ciHasGroup = false;
  let hasMedical = false, medicalHasGroup = false, medicalAnnualLimit = 0;
  // PA — policy_type='accident' base plans + 'accident' riders.
  let paCover = 0, paHasGroup = false;
  const mrtaLiabilityIds = new Set<string>();

  for (const p of pool) {
    const isGroup = p.is_group_employer === true;
    const baseSum = p.sum_assured ?? 0;

    if (LIFE_POLICY_TYPES.includes(p.policy_type)) {
      deathCover += baseSum;
      if (baseSum > 0 && isGroup) deathHasGroup = true;
    }
    if (p.policy_type === "critical_illness") {
      ciCover += baseSum;
      if (baseSum > 0 && isGroup) ciHasGroup = true;
    }
    if (p.policy_type === "disability") {
      disabilityCover += baseSum;
      if (baseSum > 0 && isGroup) disabilityHasGroup = true;
    }
    if (p.policy_type === "accident") {
      paCover += baseSum;
      if (baseSum > 0 && isGroup) paHasGroup = true;
    }
    if (p.policy_type === "medical") {
      hasMedical = true;
      if (isGroup) medicalHasGroup = true;
      // The column lives on `annual_limit` (mapped in by db.ts, possibly out
      // of the row's `metadata` — see the CfpFinancials.policies comment).
      const limit = p.annual_limit ?? 0;
      if (limit > medicalAnnualLimit) medicalAnnualLimit = limit;
    }
    if (p.covers_liability_id) mrtaLiabilityIds.add(p.covers_liability_id);

    for (const r of p.policy_riders ?? []) {
      const riderSum = r.sum_assured ?? 0;
      if (r.category === "life") {
        deathCover += riderSum;
        if (riderSum > 0 && isGroup) deathHasGroup = true;
      } else if (r.category === "disability") {
        disabilityCover += riderSum;
        if (riderSum > 0 && isGroup) disabilityHasGroup = true;
      } else if (CI_RIDER_CATEGORIES.includes(r.category)) {
        ciCover += riderSum;
        if (riderSum > 0 && isGroup) ciHasGroup = true;
      } else if (r.category === "medical") {
        hasMedical = true;
        if (isGroup) medicalHasGroup = true;
        const limit = r.annual_limit ?? 0;
        if (limit > medicalAnnualLimit) medicalAnnualLimit = limit;
      } else if (r.category === "accident") {
        paCover += riderSum;
        if (riderSum > 0 && isGroup) paHasGroup = true;
      }
    }
  }

  const liabilitiesCoveredByPolicy = [...mrtaLiabilityIds].reduce((sum, id) => {
    const l = liabilities.find((x) => x.id === id);
    return sum + (l?.outstanding_balance ?? 0);
  }, 0);

  // TPD: use its own dedicated cover when there is any; ONLY fall back to
  // assuming the life plan's sum assured also covers TPD when there is none
  // on file at all (决策 1 correction).
  const hasOwnTpdCover = disabilityCover > 0;

  return {
    death_cover: deathCover,
    death_has_group: deathHasGroup,
    tpd_cover: hasOwnTpdCover ? disabilityCover : deathCover,
    tpd_has_group: hasOwnTpdCover ? disabilityHasGroup : deathHasGroup,
    tpd_assumed_from_life: !hasOwnTpdCover,
    ci_cover: ciCover,
    ci_has_group: ciHasGroup,
    // No policy_riders category distinguishes early/advance-stage CI payouts
    // today — decision 1's ci_early_cover stays 0 with an explanatory note
    // (computeCna adds it) until that data exists.
    ci_early_cover: 0,
    ci_early_has_group: false,
    has_medical: hasMedical,
    medical_annual_limit: medicalAnnualLimit,
    medical_has_group: medicalHasGroup,
    pa_cover: paCover,
    pa_has_group: paHasGroup,
    liabilities_covered_by_policy: liabilitiesCoveredByPolicy,
  };
}

/**
 * Annualise inflows row by row.
 *
 * Correct ONLY where each row is a standing commitment with its own cadence —
 * which is the prospect path (buildProspectCnaInput), where income arrives as a
 * band rather than as dated records.
 *
 * WRONG for cashflow_entries, where a row is ONE MONTH'S actual amount. Summing
 * June's RM 6,000 and July's RM 4,000 and multiplying each by twelve reports
 * RM 120,000 of income for a client earning RM 60,000. cfp-brain therefore
 * passes the baseline's figure through `overrides.annual_income`; the basis-
 * aware calculation lives in _shared/cashflow/periods.ts.
 */
export function annualizeInflows(
  inflows: CfpFinancials["inflows"],
): number {
  return inflows.reduce(
    (sum, e) => sum + e.amount * (CASHFLOW_ANNUALIZE[e.frequency] ?? 12),
    0,
  );
}

export function annualPremiumTotal(
  policies: CfpFinancials["policies"],
): number {
  return policies.reduce(
    (sum, p) =>
      sum +
      (p.premium ?? 0) * (PREMIUM_ANNUALIZE[p.premium_frequency ?? "annual"] ?? 1),
    0,
  );
}

/** Baseline-driven overrides from the CFP multi-agent orchestrator:
 * liquid_assets = liquid assets AFTER the emergency-fund reservation (stops
 * the same ringgit backing both the emergency fund and the life gap), and
 * education_need = the real education-goal future cost. Prospect mode and
 * legacy callers pass nothing and keep the original behaviour. */
export interface CnaBaselineOverrides {
  liquid_assets?: number;
  education_need?: number;
  /**
   * The household's annual income, already computed on the plan's cashflow
   * basis. Supply it whenever a FinancialBaseline exists — see the note on
   * annualizeInflows for why re-deriving it here gets the wrong answer.
   */
  annual_income?: number;
}

/** Build CnaInput from live DB financials.
 * Coverage now comes from the base plan (death/TPD) PLUS its riders — a plan is
 * a base benefit with categorised riders (medical, CI, cancer, accident, …), so
 * CI/medical live on riders, not the flat policy_type.
 *
 * P5 决策 1: `life_cover`/`ci_cover`/`has_medical` below and the richer
 * `coverage`/`coverage_excluding_group` detail are built from the SAME
 * buildCoverageDetail() aggregation (status-filtered — lapsed/surrendered/
 * matured policies no longer count), so the legacy `gaps` output and the new
 * `death`/`tpd`/`ci`/`medical`/`pa` breakdown can never silently disagree. */
export function buildCfpCnaInput(
  f: CfpFinancials,
  overrides: CnaBaselineOverrides = {},
): CnaInput {
  const coverage = buildCoverageDetail(f.policies, f.liabilities, false);
  const coverageExcludingGroup = buildCoverageDetail(f.policies, f.liabilities, true);

  return {
    // The baseline's figure wins: it was annualised from the months the advisor
    // chose, so the income replacement and CI needs below rest on the same
    // basis as every other figure in the report. Falling back to the row-by-row
    // sum keeps the prospect path (no baseline, income as a band) working.
    annual_income: overrides.annual_income ?? annualizeInflows(f.inflows),
    liabilities_total: f.liabilities.reduce(
      (s, l) => s + (l.outstanding_balance ?? 0),
      0,
    ),
    liquid_assets: overrides.liquid_assets ?? f.assets
      .filter((a) => isLiquid(a.asset_type))
      .reduce((s, a) => s + (a.current_value ?? 0), 0),
    life_cover: coverage.death_cover,
    ci_cover: coverage.ci_cover,
    has_medical: coverage.has_medical,
    dependents: f.client.number_of_dependants ?? 0,
    ...(overrides.education_need != null
      ? { education_need_override: overrides.education_need }
      : {}),
    coverage,
    coverage_excluding_group: coverageExcludingGroup,
  };
}
