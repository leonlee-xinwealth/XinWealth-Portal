// Types for the plain-JS KYC mapping so its vitest suite type-checks under `strict`.
export declare const INCOME_CATEGORY_MAP: Readonly<Record<string, string>>;
export declare const KYC_YEARLY_ITEMS: ReadonlySet<string>;

export declare function kycIncomeEntry(kycKey: string): { category: string; frequency: 'monthly' | 'annual' };

export declare function kycExpenseEntry(
  groupKey: string,
  item: { type?: string | null; description?: string | null } | null | undefined,
): {
  category: string;
  frequency: string;
  source_note: string | null;
  needs_review: boolean;
  review_reason: string | null;
};

export declare function kycAssetFields(
  assetType: string,
  description?: string | null,
): {
  asset_type: string;
  purpose: 'personal_use' | 'income_producing' | 'investment' | null;
  liquidity: 'high' | 'medium' | 'low';
  needs_review: boolean;
  review_reason: string | null;
};

export interface AssetCashflowEntry {
  direction: 'inflow' | 'outflow';
  category: string;
  amount: number;
  needs_review: boolean;
  review_reason: string | null;
  source_note: string;
}

export declare function assetCashflowEntries(m: {
  assetType: string;
  name: string;
  monthlyIncome: number;
  monthlyExpenses: number;
}): AssetCashflowEntry[];
