// Shared contracts for the CFP multi-agent report brain.
// Design: docs/superpowers/specs/2026-07-16-cfp-multi-agent-report-design.md
//
// IRON RULE (inherited from insurance-brain): every monetary figure is computed
// by deterministic TypeScript; the LLM only narrates. PII discipline: fetchCfpData
// never selects names/NRIC/email/phone — identifying fields stay out of this
// function entirely (the portal UI joins names for display/PDF).

import type { CfpFinancials } from "../_shared/insurance/mapping.ts";
import type { DerivedItem } from "../_shared/finance/derived.ts";
import type { RateType } from "../_shared/finance/loans.ts";
import type { StandingItem } from "../_shared/cashflow/items.ts";

export type SectionType =
  | "cashflow_planning"
  | "insurance_planning"
  | "investment_planning"
  | "retirement_planning"
  | "tax_planning"
  | "legacy_planning"
  | "goals_planning"
  | "financial_health";

export const SECTION_ORDER: SectionType[] = [
  "cashflow_planning",
  "goals_planning",
  "insurance_planning",
  "investment_planning",
  "retirement_planning",
  "tax_planning",
  "legacy_planning",
  "financial_health",
];

// ---------------------------------------------------------------- client data

export interface ClientGoalRow {
  id: string;
  goal_type: "education" | "house" | "business" | "other";
  name: string;
  target_amount: number;
  target_year: number;
  current_saved: number;
  monthly_contribution: number;
  inflation_override: number | null;
  priority: number;
}

export interface CashflowRow {
  direction: "inflow" | "outflow";
  amount: number;
  frequency: string;
  category: string | null;
  /** YYYY-MM-DD — the month this figure belongs to. A row records THAT MONTH'S
   *  actual amount, not a standing monthly commitment. */
  period_month: string;
  /** non-null = transfer to/from the client's own asset (小会计: not a true
   * expense/income — e.g. savings → investment account) */
  linked_asset_id?: string | null;
  /** non-null = loan repayment (still a true expense / debt service) */
  linked_liability_id?: string | null;
}

export interface AssetRow {
  asset_type: string;
  current_value: number;
  cost_value: number | null;
  ownership_type: string | null;
}

export interface LiabilityRow {
  /** P2a: identifies the row for the D1 estimator's derived cash-flow item
   *  (supabase/functions/_shared/finance/derived.ts) and its dedupe check. */
  id?: string | null;
  name?: string | null;
  liability_type: string;
  outstanding_balance: number;
  interest_rate: number | null;
  monthly_payment: number | null;
  end_date: string | null;
  /** P2a loan terms the D1 estimator reads when present (migration
   *  20260924000001_liability_loan_terms.sql) — optional because most rows
   *  predate it and estimateLoan fills what's missing. */
  original_principal?: number | null;
  remaining_months?: number | null;
  rate_type?: RateType | null;
}

/** P2a: `CfpFinancials["policies"]` (the legacy insurance-brain shape) plus
 *  the two fields the D1 premium-derivation needs (`id` for the dedupe key,
 *  `plan_name` for the derived item's display name) — kept as an intersection
 *  here rather than edited into _shared/insurance/mapping.ts so this stays a
 *  Task B-only change. */
export type CfpPolicyRow = CfpFinancials["policies"][number] & {
  id?: string | null;
  plan_name?: string | null;
};

export interface InvestmentAccountRow {
  account_type: string | null;
  prs_sub_account_a: number | null;
  prs_sub_account_b: number | null;
}

export interface HoldingRow {
  snapshot_month: string;
  instrument_code: string | null;
  market_value: number | null;
  cost_basis: number | null;
}

export interface CfpClient {
  id: string;
  date_of_birth: string | null;
  marital_status: string | null;
  number_of_dependants: number;
  employment_status: string | null;
  occupation: string | null;
  tax_residency: string | null;
  risk_profile: string | null;
  retirement_age: number | null;
  has_epf_account: boolean;
  has_prs_account: boolean;
  /** P2b 决策 6: `clients.has_epf` — the client is a salaried employee whose
   *  pay runs through EPF/SOCSO/EIS, as opposed to `has_epf_account` above
   *  (merely "an EPF account number is on file"). Only when this is `true`
   *  does planCashflow derive the statutory items; `null`/`false`/unset never
   *  guesses "yes". */
  has_epf: boolean | null;
}

/** One spouse's own figures, kept alongside the merged household view for the
 * modules that must analyse each life separately (insurance CNA) and for the
 * PDF's per-owner attribution. */
export interface PersonSlice {
  role: "primary" | "partner";
  client: CfpClient;
  cashflow: CashflowRow[];
  assets: AssetRow[];
  liabilities: LiabilityRow[];
  policies: CfpPolicyRow[];
  /** P2b: this spouse's own standing items — still tagged with their own
   *  client_id after the household merge, so per-employee statutory (决策 6)
   *  can group them back apart. */
  items: StandingItem[];
}

/** A row present on both spouses with identical type+amount — almost always the
 * same jointly-owned asset entered twice. Surfaced as a warning; the engine
 * never silently drops it (advisor decides). */
export interface DuplicateHolding {
  kind: "asset" | "liability";
  type: string;
  amount: number;
}

/** Full, PII-free financial picture for one client. `policies` reuses the
 * insurance CfpFinancials shape so _shared/insurance code plugs in directly.
 *
 * JOINT REPORTS: the top-level fields hold the MERGED household figures, so
 * every module's calculator keeps working unchanged; `household` carries the
 * per-spouse breakdown for the few that need it. See household.ts. */
export interface CfpData {
  client: CfpClient;
  /** every recurring row, across every month — the planning basis is chosen
   *  in the calculation layer, never at the fetch (see db.ts) */
  cashflow: CashflowRow[];
  assets: AssetRow[];
  liabilities: LiabilityRow[];
  policies: CfpPolicyRow[];
  investment_accounts: InvestmentAccountRow[];
  /** latest snapshot_month only */
  holdings: HoldingRow[];
  goals: ClientGoalRow[];
  /** P2b 决策 1: every standing item, every version — the plan. Empty for a
   *  client who has never used items, in which case planCashflow falls back
   *  to averaging `cashflow` actuals (source:'actuals'). */
  items: StandingItem[];
  /** present only on joint household reports */
  household?: {
    primary: PersonSlice;
    partner: PersonSlice;
    duplicates: DuplicateHolding[];
  };
}

// ------------------------------------------------------------ planning inputs

/** Advisor-entered inputs stored on financial_reports.planning_inputs. */
export interface PlanningInputs {
  tax?: {
    /** relief key → RM already claimed/committed this year */
    reliefs?: Record<string, number>;
  };
  estate?: {
    regime?: "conventional" | "syariah" | "unknown";
    will_status?: "has_will" | "no_will" | "unknown";
    epf_nomination?: boolean;
    insurance_nomination?: boolean;
    /** 资产达人: creditor-isolation advice (absolute assignment / trust) */
    business_owner?: boolean;
    bankruptcy_risk?: boolean;
  };
  assumption_overrides?: Partial<BaselineAssumptions>;
  /** Which months of actuals the plan is annualised from. Absent = derive it
   *  from whatever the client has recorded (see defaultBasis). */
  cashflow_basis?: { year: number; from_month: number; to_month: number };
}

// ---------------------------------------------------------------- baseline

export interface BaselineAssumptions {
  epf_dividend: number;
  inflation: number;
  education_inflation: number;
  retirement_replacement_ratio: number;
  withdrawal_rate: number;
  life_expectancy: number;
  default_retirement_age: number;
  emergency_months_low: number;
  emergency_months_high: number;
  investment_return_by_band: Record<string, number>;
  /** resolved from client risk_profile band */
  client_investment_return: number;
}

/** Single source of truth every module's calculator consumes. Computed once
 * per generation by computeBaseline, then enriched by module updateBaseline
 * hooks in SECTION_ORDER (goals → education need, insurance → premium). */
export interface FinancialBaseline {
  version: 1;
  // cashflow
  /** the months of actuals every income and expense figure below is built on —
   *  printed on the report so the client can see the assumption */
  cashflow_basis: { year: number; from_month: number; to_month: number } | null;
  /** months the basis spans, vs the ones that actually hold data. When these
   *  differ the advisor has a gap in the record, which no arithmetic can fix. */
  cashflow_basis_months: number;
  cashflow_months_with_data: number[];
  annual_income: number;
  annual_expenses: number;
  monthly_income: number;
  monthly_essential_expenses: number;
  annual_surplus: number;
  /** P2b 决策 1: which of cashflow_items / cashflow_entries every figure
   *  above was built from. */
  cashflow_source: "items" | "actuals";
  /** P2b 决策 6: employee EPF — a transfer (O1), already excluded from
   *  annual_expenses; kept here so retirement/tax can use the exact
   *  statutory figure instead of re-deriving it. 0 when has_epf isn't true. */
  monthly_employee_epf: number;
  /** P2b 决策 6: employer EPF — never in the client's own cash flow at all
   *  (it doesn't reach their pocket), surfaced only for net-worth reconciliation. */
  monthly_employer_epf: number;
  /** P2b 决策 6: SOCSO + EIS — a real expense (O9), already folded into
   *  annual_expenses like any other derived item. */
  monthly_socso_eis: number;
  /** P2b 决策 6: annual_surplus minus the employee EPF that's forced savings
   *  and can't be redirected — what the budget waterfall actually allocates.
   *  Equals annual_surplus when there's no statutory EPF (monthly_employee_epf
   *  is 0 on the actuals path and whenever has_epf isn't true). */
  annual_disposable_surplus: number;
  /** P2b 决策 4: one_off items near "now"; always empty on the actuals path
   *  (periods.ts has no such concept). */
  one_off_items: StandingItem[];
  /** P2b: the 'YYYY-MM-01' month items were evaluated "as of" when
   *  cashflow_source is 'items' (null on the actuals path). Threaded through
   *  so a module needing an items-path breakdown (modules/cashflow/calc.ts)
   *  re-filters the SAME active items this baseline was built from, instead
   *  of a fresh `new Date()` that could disagree with it. */
  items_as_of: string | null;
  // emergency fund (resolves the double-count coupling with insurance CNA)
  emergency_fund_need_low: number;
  emergency_fund_need_high: number;
  emergency_fund_actual: number;
  liquid_assets_total: number;
  liquid_assets_after_emergency: number;
  // debt & ratios
  total_assets: number;
  net_worth: number;
  total_liabilities: number;
  monthly_debt_service: number;
  /** P2a: the principal portion of monthly_debt_service (wealth-building view,
   *  spec 决策 5 — kept separate from the cash view every ratio above uses). */
  monthly_principal: number;
  /** P2a: installments and premiums this generation derived from liabilities/
   *  policies and folded into income/expenses (supabase/functions/_shared/
   *  finance/derived.ts). Empty when the client has none. */
  derived_items: DerivedItem[];
  /** P2a: count of manually-keyed cashflow rows excluded from the totals
   *  because a derived item now covers the same obligation (决策 4). */
  superseded_manual: number;
  debt_service_ratio: number | null;
  savings_ratio: number | null;
  solvency_ratio: number | null;
  // demographics
  current_year: number;
  age: number | null;
  retirement_age: number;
  years_to_retirement: number | null;
  dependents: number;
  marital_status: string | null;
  /** joint household report — every figure above is the couple's combined
   * position, and age/retirement_age are the PRIMARY client's */
  household_mode?: boolean;
  partner_age?: number | null;
  partner_retirement_age?: number | null;
  // unified economic assumptions
  assumptions: BaselineAssumptions;
  // filled back by earlier modules for later ones
  goal_education_need?: number;
  annual_premium_current?: number;
  /** 首席规划师's deterministic budget waterfall (保障→紧急→退休→目标→增值),
   * written back by computeAll AFTER all modules run so every section's
   * NARRATIVE is drafted against the same allocation — interlinked, never
   * isolated. Absent only while the synthesis module is unregistered. */
  budget_summary?: {
    annual_surplus: number;
    required_total: number;
    over_budget: boolean;
    lines: Array<{
      key: string;
      label_zh: string;
      label_en: string;
      required_annual: number;
      allocated_annual: number;
      deferred_annual: number;
    }>;
  };
  baseline_notes: string[];
}

// ---------------------------------------------------------------- modules

export type ModuleOutputs = Partial<Record<SectionType, unknown>>;

export interface PromptSpec {
  prompt: string;
  /** Gemini structured-output responseSchema */
  schema: unknown;
}

export interface CfpModule<TDet = unknown, TNarrative = unknown, TContent = unknown> {
  section_type: SectionType;
  /** persona identifier written to report_sections.agent */
  agent: string;
  /** deterministic calculation — pure, unit-tested, no LLM. `inputs` carries
   * advisor-entered planning inputs (tax reliefs, estate regime, …) */
  compute(
    f: CfpData,
    b: FinancialBaseline,
    prior: ModuleOutputs,
    inputs: PlanningInputs,
  ): TDet;
  /** optional baseline enrichment consumed by later modules */
  updateBaseline?(b: FinancialBaseline, det: TDet): FinancialBaseline;
  /** narrative prompt — PII whitelist only */
  buildPrompt(det: TDet, b: FinancialBaseline, f: CfpData): PromptSpec;
  /** merge deterministic numbers + narrative into report_sections.content */
  assemble(det: TDet, narrative: TNarrative, f: CfpData): TContent;
  /** PII-free payload for the generic layman client-view pass */
  clientViewInput?(content: TContent): unknown;
  /** PII-free narrative payload for the advisor chat pass; defaults to
   * clientViewInput when absent. Must never include identifying fields
   * (policy numbers, providers, names). */
  chatContext?(content: TContent): unknown;
  /** custom client-view generator (insurance keeps its legacy PDF shape);
   * wins over clientViewInput when both exist */
  generateClientView?(
    content: TContent,
    language: "en" | "zh",
    apiKey: string,
  ): Promise<unknown>;
}
