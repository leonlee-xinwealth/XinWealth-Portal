// Labels for the client portal payload (api/health.js). services/apiService.ts
// computes a few figures by matching these exact strings ('Annual Bonus',
// 'Loan Repayment', 'Vacation/ Travel', …), so the codes behind them keep those
// strings; everything else shows its taxonomy label.
import { assetTypeLabel, resolveCategory } from './taxonomy.mjs';

const PORTAL_CASHFLOW_LABELS = {
  salary_basic: 'Salary',
  bonus: 'Annual Bonus',
  rental_income: 'Rental Income',
  dividend_company: 'Dividend Income',
  dividend_investment: 'Dividend Income',
  interest_income: 'Dividend Income',
  income_tax: 'Income Tax Expense',
  travel: 'Vacation/ Travel',
};

export function cashflowLabel(direction, category) {
  const c = resolveCategory(category);
  if (!c) return category || (direction === 'inflow' ? 'Income' : 'Expense');
  if (PORTAL_CASHFLOW_LABELS[c.code]) return PORTAL_CASHFLOW_LABELS[c.code];
  if (c.group === 'O2' && c.wealth_effect === 'split') return 'Loan Repayment';
  return c.label_en;
}

const PORTAL_ASSET_LABELS = {
  savings: 'Savings/Current Account',
  fixed_deposit: 'Fixed Deposit',
  money_market: 'Money Market Fund For Savings',
  epf_account_1: 'EPF Account 1 (Akaun Persaraan)',
  epf_account_2: 'EPF Account 2 (Akaun Sejahtera)',
  epf_account_3: 'EPF Account 3 (Akaun Fleksibel)',
};

export function assetCategory(assetType) {
  if (!assetType) return 'Other';
  return PORTAL_ASSET_LABELS[assetType] || assetTypeLabel(assetType, 'en') || 'Other';
}
