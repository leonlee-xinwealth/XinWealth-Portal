// Shared contracts for the CFP multi-agent report brain.
// Design: docs/superpowers/specs/2026-07-16-cfp-multi-agent-report-design.md
//
// IRON RULE (inherited from insurance-brain): every monetary figure is computed
// by deterministic TypeScript; the LLM only narrates. PII discipline: fetchCfpData
// never selects names/NRIC/email/phone — identifying fields stay out of this
// function entirely (the portal UI joins names for display/PDF).

import type { CfpFinancials } from "../_shared/insurance/mapping.ts";

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
  liability_type: string;
  outstanding_balance: number;
  interest_rate: number | null;
  monthly_payment: number | null;
  end_date: string | null;
}

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

/** Full, PII-free financial picture for one client. `policies` reuses the
 * insurance CfpFinancials shape so _shared/insurance code plugs in directly. */
export interface CfpData {
  client: {
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
  };
  /** latest period_month, recurring only, both directions */
  cashflow: CashflowRow[];
  assets: AssetRow[];
  liabilities: LiabilityRow[];
  policies: CfpFinancials["policies"];
  investment_accounts: InvestmentAccountRow[];
  /** latest snapshot_month only */
  holdings: HoldingRow[];
  goals: ClientGoalRow[];
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
  annual_income: number;
  annual_expenses: number;
  monthly_income: number;
  monthly_essential_expenses: number;
  annual_surplus: number;
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
