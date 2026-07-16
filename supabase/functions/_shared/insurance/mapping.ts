// Maps raw inputs (funnel form text / n8n extraction strings / DB rows) into
// the deterministic CnaInput. No LLM, no network.

import { type CnaInput, incomeBandMidpoint } from "./cna.ts";

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

const LIQUID_ASSET_TYPES = ["savings", "fixed_deposit", "money_market"];
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

// Rider categories that count toward each protection type (mirrors the advisor
// portal's InsuranceGapPanel so the report matches what the advisor sees).
const CI_RIDER_CATEGORIES = ["critical_illness", "cancer"];

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
}

/** Build CnaInput from live DB financials.
 * Coverage now comes from the base plan (death/TPD) PLUS its riders — a plan is
 * a base benefit with categorised riders (medical, CI, cancer, accident, …), so
 * CI/medical live on riders, not the flat policy_type. */
export function buildCfpCnaInput(
  f: CfpFinancials,
  overrides: CnaBaselineOverrides = {},
): CnaInput {
  const allRiders = f.policies.flatMap((p) => p.policy_riders ?? []);
  const riderSumByCategories = (cats: string[]) =>
    allRiders
      .filter((r) => cats.includes(r.category))
      .reduce((s, r) => s + (r.sum_assured ?? 0), 0);

  // Life = base death/TPD sum (life/ILP plans) + any additional 'life' riders.
  const lifeCover = f.policies
    .filter((p) => LIFE_POLICY_TYPES.includes(p.policy_type))
    .reduce((s, p) => s + (p.sum_assured ?? 0), 0) +
    riderSumByCategories(["life"]);

  // Critical illness = CI/cancer riders, plus any legacy row still tagged with
  // the flat policy_type='critical_illness'.
  const ciCover = riderSumByCategories(CI_RIDER_CATEGORIES) +
    f.policies
      .filter((p) => p.policy_type === "critical_illness")
      .reduce((s, p) => s + (p.sum_assured ?? 0), 0);

  const hasMedical = f.policies.some((p) => p.policy_type === "medical") ||
    allRiders.some((r) => r.category === "medical");

  return {
    annual_income: annualizeInflows(f.inflows),
    liabilities_total: f.liabilities.reduce(
      (s, l) => s + (l.outstanding_balance ?? 0),
      0,
    ),
    liquid_assets: overrides.liquid_assets ?? f.assets
      .filter((a) => LIQUID_ASSET_TYPES.includes(a.asset_type))
      .reduce((s, a) => s + (a.current_value ?? 0), 0),
    life_cover: lifeCover,
    ci_cover: ciCover,
    has_medical: hasMedical,
    dependents: f.client.number_of_dependants ?? 0,
    ...(overrides.education_need != null
      ? { education_need_override: overrides.education_need }
      : {}),
  };
}
