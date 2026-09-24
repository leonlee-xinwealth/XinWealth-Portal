// Types for the plain-JS portal-derived helpers so its vitest suite type-checks under `strict`.
export declare const MONTH_NAMES: readonly string[];

export interface PortalRecordLike {
  fields?: { Year?: string | null; Month?: string | null } | null;
}

export declare function latestMonthYear(
  expenseRecords: PortalRecordLike[] | null | undefined,
  today?: Date,
): { month: string; year: string };

export interface PortalInvestmentAccountLike {
  id?: string | null;
  asset_id?: string | null;
}

export interface PortalHoldingLike {
  account_id?: string | null;
  [key: string]: unknown;
}

export declare function legacyHoldings<H extends PortalHoldingLike>(
  holdings: H[] | null | undefined,
  accounts: PortalInvestmentAccountLike[] | null | undefined,
): H[];

export declare function isSupersededOutflow(
  row: { direction?: string | null; category?: string | null } | null | undefined,
  liabilities: any[],
  policies: any[],
): boolean;

export interface PortalExpenseRecord {
  id: string;
  fields: {
    Category: string;
    Type: string;
    Description: string;
    Amount: number;
    Month: string;
    Year: string;
    Date: number | null;
  };
}

export declare function buildDerivedExpenseRecords(input: {
  liabilities: any[];
  policies: any[];
  month: string;
  year: string;
  today?: Date;
}): PortalExpenseRecord[];

/** `client` param of buildCurrentPlan below — planCashflow's own
 *  PlanCashflowClientInfo (has_epf/date_of_birth for the EPF/SOCSO/EIS
 *  estimate, tax_residency for the income-tax estimate: a non-resident pays
 *  the flat 30% with no reliefs). Kept as a local structural type (not an
 *  import from _shared/finance/derived.ts) — same reasoning as every other
 *  type in this file: portalDerived.js is plain JS consumed by the Vercel
 *  functions runtime, and this .d.ts only exists so its vitest suite
 *  type-checks under `strict`. */
export interface PortalPlanClientLike {
  has_epf?: boolean | null;
  date_of_birth?: string | null;
  tax_residency?: string | null;
}

/**
 * The client portal's CURRENT position — P2b followup (cash-flow-correctness
 * fix) adds take-home/statutory/living/savable/planned-savings/net-cash-flow
 * on top of the original income/expenses/surplus/debt-service shape, all
 * straight off planCashflow's own fields (see buildCurrentPlan's JSDoc).
 */
export interface PortalCurrentPlan {
  source: string;
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  annual_income: number;
  annual_expenses: number;
  monthly_debt_service: number;
  monthly_principal: number;
  monthly_interest: number;
  monthly_premiums: number;
  monthly_employee_epf: number;
  monthly_employer_epf: number;
  monthly_socso_eis: number;
  monthly_income_tax: number;
  monthly_statutory: number;
  monthly_take_home: number;
  monthly_living: number;
  monthly_savable: number;
  monthly_planned_savings: number;
  monthly_net_cash_flow: number;
}

export declare function buildCurrentPlan(input: {
  rows: any[];
  liabilities: any[];
  policies: any[];
  items: any[];
  client?: PortalPlanClientLike;
  basis?: unknown;
  today?: Date;
}): PortalCurrentPlan;
