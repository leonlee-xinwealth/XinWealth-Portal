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
