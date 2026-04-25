import { supabase, findProfileByName, parsePeriod } from './_supabase.js';

// ─── Enum → readable string mappings ──────────────────────────────────────────

const ASSET_KIND = {
  savings:          'Savings',
  fixed_deposit:    'Fixed Deposit',
  money_market_fund:'Money Market Fund For Savings',
  epf_account_1:    'EPF',
  epf_account_2:    'EPF',
  epf_account_3:    'EPF',
  property:         'Property',
  vehicle:          'Vehicle',
  other:            'Other'
};

const LIABILITY_KIND = {
  study_loan:       'Study Loan',
  personal_loan:    'Personal Loan',
  renovation_loan:  'Renovation Loan',
  mortgage:         'Mortgage',
  car_loan:         'Car Loan',
  credit_card:      'Credit Card',
  other:            'Other'
};

// Map income_type enum → category string that larkService.ts calculation logic expects
const INCOME_TYPE = {
  salary:               'Salary',
  bonus:                'Annual Bonus',          // service divides by 12 for this category
  director_fee:         'Director / Advisory / Professional Fees',
  commission:           'Commission / Referral Fee',
  dividend_company:     'Dividend from Own Company',
  dividend_investment:  'Dividend Income',        // service counts as passive income
  rental:               'Rental Income',          // service counts as passive income
  other:                'Other'
};

const INVESTMENT_CLASS = {
  etf:          'ETF',
  bond:         'Bonds',
  stock:        'Stocks',
  unit_trust:   'Unit Trust',
  fixed_deposit:'Fixed Deposit',
  forex:        'Forex',
  money_market: 'Money Market',
  other:        'Other'
};

// ─── Row transformers ──────────────────────────────────────────────────────────

const transformAsset = (row) => {
  const { monthName, year } = parsePeriod(row.acquired_at || row.created_at);
  return {
    id:          row.id,
    create_time: new Date(row.created_at || Date.now()).getTime(),
    fields: {
      "Type":        'Asset',
      "Category":    ASSET_KIND[row.kind] || row.kind,
      "Description": row.name,
      "Value":       parseFloat(row.value) || 0,
      "Month":       monthName,
      "Year":        year
    }
  };
};

const transformLiability = (row) => {
  const { monthName, year } = parsePeriod(row.created_at);
  return {
    id:          row.id,
    create_time: new Date(row.created_at || Date.now()).getTime(),
    fields: {
      "Type":                   'Liability',
      "Category":               LIABILITY_KIND[row.kind] || row.kind,
      "Description":            row.name,
      "Value":                  parseFloat(row.balance)    || 0,
      "Original Loan Amount":   parseFloat(row.principal)  || 0,
      // Linked asset for equity calculation (kept as array for larkService compat)
      "Linked Asset":           row.linked_asset_id ? [row.linked_asset_id] : [],
      "Month":                  monthName,
      "Year":                   year
    }
  };
};

const transformIncome = (row) => {
  const { monthName, year } = parsePeriod(row.period_month);
  return {
    id:          row.id,
    create_time: new Date(row.created_at || Date.now()).getTime(),
    fields: {
      "Category":    INCOME_TYPE[row.income_type] || row.income_type,
      "Description": row.source_note || '',
      "Amount":      parseFloat(row.amount) || 0,
      "Month":       monthName,
      "Year":        year
    }
  };
};

const transformExpense = (row) => {
  const { monthName, year } = parsePeriod(row.period_month);
  return {
    id:          row.id,
    create_time: new Date(row.created_at || Date.now()).getTime(),
    fields: {
      "Category": row.category.charAt(0).toUpperCase() + row.category.slice(1),
      "Type":     row.description || '',   // service checks "Type" for loan repayment etc.
      "Amount":   parseFloat(row.amount) || 0,
      "Month":    monthName,
      "Year":     year
    }
  };
};

// Investment holdings (asset_class) used for investmentAssets calc in financial health
const transformInvestment = (row) => {
  const { monthName, year } = parsePeriod(row.created_at);
  return {
    id:          row.id,
    create_time: new Date(row.created_at || Date.now()).getTime(),
    fields: {
      "Category":    INVESTMENT_CLASS[row.asset_class] || row.asset_class,
      "Description": row.name,
      "Value":       parseFloat(row.current_value) || 0,
      "Amount":      parseFloat(row.current_value) || 0,
      "End Value":   parseFloat(row.current_value) || 0,
      "Month":       monthName,
      "Year":        year
    }
  };
};

const transformInsurance = (row) => ({
  id:          row.id,
  create_time: new Date(row.created_at || Date.now()).getTime(),
  fields: {
    "Type":        row.policy_type,
    "Provider":    row.provider || '',
    "Sum Assured": parseFloat(row.sum_assured) || 0,
    "Premium":     parseFloat(row.premium)     || 0
  }
});

// ─── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'User name is required' });

  const empty = { assets: [], liabilities: [], incomes: [], expenses: [], investments: [], insurance: [], monthlySnapshot: [] };

  try {
    const profile = await findProfileByName(name);
    if (!profile) return res.status(200).json(empty);

    const pid = profile.id;

    // Fetch all tables concurrently
    const [aRes, lRes, incRes, expRes, invRes, insRes] = await Promise.all([
      supabase.from('assets').select('*').eq('profile_id', pid),
      supabase.from('liabilities').select('*').eq('profile_id', pid),
      supabase.from('incomes').select('*').eq('profile_id', pid),
      supabase.from('expenses').select('*').eq('profile_id', pid),
      supabase.from('investments').select('*').eq('profile_id', pid),
      supabase.from('insurance_policies').select('*').eq('profile_id', pid)
    ]);

    return res.status(200).json({
      assets:          (aRes.data   || []).map(transformAsset),
      liabilities:     (lRes.data   || []).map(transformLiability),
      incomes:         (incRes.data || []).map(transformIncome),
      expenses:        (expRes.data || []).map(transformExpense),
      investments:     (invRes.data || []).map(transformInvestment),
      insurance:       (insRes.data || []).map(transformInsurance),
      monthlySnapshot: []   // no monthly_snapshots table in this schema
    });

  } catch (error) {
    console.error('Health Data API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
