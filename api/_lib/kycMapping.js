// Pure mapping from the KYC form's vocabulary to the chart of accounts
// (spec 2026-09-22 附录 A). Kept out of api/kyc.js so it can be tested.
import { assetTypeMeta, classifyAsset, classifyCashflowRow, liquidityLevel } from './taxonomy.mjs';

/** KYC income field → cash-flow category. */
export const INCOME_CATEGORY_MAP = {
  salary: 'salary_basic',
  bonus: 'bonus',
  directorFee: 'director_fee',
  commission: 'commission',
  dividendCompany: 'dividend_company',
  dividendInvestment: 'dividend_investment',
  rentalIncome: 'rental_income',
};

/** KYC expense card → the legacy group code the classifier reads notes under. */
const EXPENSE_GROUP_CODES = {
  household: 'household',
  transportation: 'transportation',
  dependants: 'dependants',
  personal: 'personal',
  miscellaneous: 'miscellaneous',
  otherExpenses: 'other_expense',
};

/** The form asks for these two per YEAR (see ExpensesStep getSuffixForType). */
export const KYC_YEARLY_ITEMS = new Set(['Vacation/ Travel', 'Income Tax Expense']);

export function kycIncomeEntry(kycKey) {
  // The form's bonus is the year's bonus; recorded monthly it would be
  // multiplied by twelve.
  return { category: INCOME_CATEGORY_MAP[kycKey], frequency: kycKey === 'bonus' ? 'annual' : 'monthly' };
}

export function kycExpenseEntry(groupKey, item) {
  const note = item?.type || item?.description || null;
  const frequency = KYC_YEARLY_ITEMS.has(item?.type) ? 'annual' : 'monthly';
  const placed = classifyCashflowRow({
    direction: 'outflow',
    category: EXPENSE_GROUP_CODES[groupKey] ?? 'other_expense',
    source_note: note,
    frequency,
    is_recurring: true,
  });
  return {
    category: placed.code,
    frequency: placed.frequency || frequency,
    source_note: note,
    needs_review: placed.needs_review,
    review_reason: placed.review_reason,
  };
}

export function kycAssetFields(assetType, description) {
  const placed = classifyAsset({ asset_type: assetType, name: description });
  return {
    asset_type: placed.asset_type,
    purpose: assetTypeMeta(placed.asset_type)?.default_purpose ?? null,
    liquidity: liquidityLevel(placed.asset_type),
    needs_review: placed.needs_review,
    review_reason: placed.review_reason,
  };
}

const ASSET_INFLOW_CATEGORY = {
  own_residence: 'rental_income',
  investment_property: 'rental_income',
  vehicle: 'side_income',
};
const ASSET_OUTFLOW_CATEGORY = {
  own_residence: 'housing_other',
  investment_property: 'housing_other',
  vehicle: 'transport_other',
};

/**
 * The "Monthly Cash Inflow / Outflow (Maintenance, Tax, etc.)" the form collects
 * per asset, as rows the caller links to the inserted asset. Before
 * 2026-09-23 these figures were collected and then discarded.
 */
export function assetCashflowEntries({ assetType, name, monthlyIncome, monthlyExpenses }) {
  const rows = [];
  if (monthlyIncome > 0) {
    rows.push({
      direction: 'inflow',
      category: ASSET_INFLOW_CATEGORY[assetType] || 'dividend_investment',
      amount: monthlyIncome,
      needs_review: false,
      review_reason: null,
      source_note: `${name} (KYC)`,
    });
  }
  if (monthlyExpenses > 0) {
    const known = ASSET_OUTFLOW_CATEGORY[assetType];
    rows.push({
      direction: 'outflow',
      category: known || 'other_expense',
      amount: monthlyExpenses,
      needs_review: !known,
      review_reason: known ? null : '请确认这笔资产相关支出的类别',
      source_note: `${name} (KYC)`,
    });
  }
  return rows;
}
