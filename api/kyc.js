import { supabase } from './_supabase.js';

const parseAmount = (val) => parseFloat(String(val || 0).replace(/,/g, '')) || 0;

// Build a period_month date string ("YYYY-MM-01") from globalMonth (0-11) and globalYear
const toPeriodMonth = (month, year) => {
  if (!year) return null;
  const m = String(parseInt(month || 0) + 1).padStart(2, '0');
  return `${year}-${m}-01`;
};

// Enum converters
const toEmploymentEnum = (val) => {
  const m = { 'employed':'employed', 'self-employed':'self_employed', 'self_employed':'self_employed',
              'unemployed':'unemployed', 'retired':'retired', 'student':'student' };
  return m[String(val||'').toLowerCase().replace(/\s+/g,'_')] || null;
};
const toTaxEnum = (val) =>
  String(val||'').toLowerCase().replace(/[-\s]/g,'_').includes('non') ? 'non_resident' : 'resident';

const toMaritalEnum = (val) =>
  ({ single:'single', married:'married', divorced:'divorced', widowed:'widowed' })[String(val||'').toLowerCase()] || null;

const toGenderEnum = (val) =>
  ({ male:'male', female:'female', other:'other' })[String(val||'').toLowerCase()] || null;

// Income type mapping (KYC form key → income_type enum)
const INCOME_TYPE_MAP = {
  salary:             'salary',
  bonus:              'bonus',
  directorFee:        'director_fee',
  commission:         'commission',
  dividendCompany:    'dividend_company',
  dividendInvestment: 'dividend_investment',
  rentalIncome:       'rental'
};

// Asset kind mapping
const ASSET_KIND_MAP = {
  savingsAccount:  'savings',
  fixedDeposit:    'fixed_deposit',
  moneyMarketFund: 'money_market_fund',
  epfPersaraan:    'epf_account_1',
  epfSejahtera:    'epf_account_2',
  epfFleksibel:    'epf_account_3'
};

// Investment asset_class mapping
const INVEST_CLASS_MAP = {
  etf:              'etf',
  stocks:           'stock',
  bonds:            'bond',
  unitTrusts:       'unit_trust',
  fixedDeposits:    'fixed_deposit',
  forex:            'forex',
  moneyMarket:      'money_market',
  otherInvestments: 'other'
};

// Liability kind mapping
const LIABILITY_KIND_MAP = {
  studyLoans:      'study_loan',
  personalLoans:   'personal_loan',
  renovationLoans: 'renovation_loan',
  otherLoans:      'other'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { income, assets, liabilities, expenses, investments, ...basic } = req.body;
  const periodMonth = toPeriodMonth(basic.globalMonth, basic.globalYear);

  try {
    // 1. Create auth user + profile
    const cleanEmail = String(basic.email || '').trim().toLowerCase();
    const givenName  = String(basic.givenName  || '').trim();
    const familyName = String(basic.familyName || '').trim();
    const fullName   = `${givenName} ${familyName}`.trim();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email:         cleanEmail,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (authError) throw new Error(`Auth user creation failed: ${authError.message}`);

    const profileId = authData.user.id;

    const { error: profileError } = await supabase.from('profiles').insert({
      id:                profileId,
      given_name:        givenName   || null,
      family_name:       familyName  || null,
      salutation:        basic.salutation   || null,
      email:             cleanEmail,
      date_of_birth:     basic.dateOfBirth ? new Date(basic.dateOfBirth).toISOString().split('T')[0] : null,
      nationality:       basic.nationality  || null,
      residency:         basic.residency    || null,
      marital_status:    toMaritalEnum(basic.maritalStatus),
      retirement_age:    parseInt(basic.retirementAge) || null,
      employment_status: toEmploymentEnum(basic.employmentStatus),
      tax_status:        toTaxEnum(basic.taxStatus),
      occupation:        basic.occupation || null,
      pdpa_accepted_at:  basic.pdpaAccepted ? new Date().toISOString() : null
    });
    if (profileError) {
      await supabase.auth.admin.deleteUser(profileId);
      throw new Error(`Profile creation failed: ${profileError.message}`);
    }

    // 2. Income records
    const incomeRows = Object.entries(INCOME_TYPE_MAP)
      .filter(([key]) => income?.[key])
      .map(([key, income_type]) => ({
        profile_id:   profileId,
        income_type,
        amount:       parseAmount(income[key]),
        period_month: periodMonth,
        is_recurring: income_type === 'salary'
      }));
    if (incomeRows.length > 0) {
      const { error } = await supabase.from('incomes').insert(incomeRows);
      if (error) console.error('Incomes insert error:', error.message);
    }

    // 3. Assets (properties, vehicles, other arrays)
    const assetRows = [];
    (assets?.properties || []).forEach(p => assetRows.push({
      profile_id: profileId, kind: 'property', name: p.description || 'Property',
      value: parseAmount(p.amount), acquired_at: periodMonth
    }));
    (assets?.vehicles || []).forEach(v => assetRows.push({
      profile_id: profileId, kind: 'vehicle', name: v.description || 'Vehicle',
      value: parseAmount(v.amount), acquired_at: periodMonth
    }));
    (assets?.otherAssets || []).forEach(o => assetRows.push({
      profile_id: profileId, kind: 'other', name: o.description || 'Other Asset',
      value: parseAmount(o.amount), acquired_at: periodMonth
    }));
    // Scalar assets
    Object.entries(ASSET_KIND_MAP).forEach(([key, kind]) => {
      if (assets?.[key]) assetRows.push({
        profile_id: profileId, kind, name: key, value: parseAmount(assets[key]), acquired_at: periodMonth
      });
    });
    if (assetRows.length > 0) {
      const { error } = await supabase.from('assets').insert(assetRows);
      if (error) console.error('Assets insert error:', error.message);
    }

    // 4. Investment holdings
    const investRows = [];
    Object.entries(INVEST_CLASS_MAP).forEach(([key, asset_class]) => {
      (investments?.[key] || []).forEach(item => investRows.push({
        profile_id:    profileId,
        asset_class,
        name:          item.description || asset_class,
        current_value: parseAmount(item.amount),
        cost_basis:    parseAmount(item.purchasePrice || item.amount)
      }));
    });
    if (investRows.length > 0) {
      const { error } = await supabase.from('investments').insert(investRows);
      if (error) console.error('Investments insert error:', error.message);
    }

    // 5. Liabilities (from standalone liability arrays)
    const liabilityRows = [];
    Object.entries(LIABILITY_KIND_MAP).forEach(([key, kind]) => {
      (liabilities?.[key] || []).forEach(l => liabilityRows.push({
        profile_id: profileId, kind, name: l.description || kind,
        balance: parseAmount(l.amount), principal: parseAmount(l.originalLoanAmount || l.amount)
      }));
    });
    // Liabilities linked to assets that are under loan
    (assets?.properties || []).filter(p => p.isUnderLoan).forEach(p => liabilityRows.push({
      profile_id: profileId, kind: 'mortgage',
      name: `Mortgage – ${p.description || 'Property'}`,
      balance: parseAmount(p.outstandingBalance), principal: parseAmount(p.originalLoanAmount)
    }));
    (assets?.vehicles || []).filter(v => v.isUnderLoan).forEach(v => liabilityRows.push({
      profile_id: profileId, kind: 'car_loan',
      name: `Car Loan – ${v.description || 'Vehicle'}`,
      balance: parseAmount(v.outstandingBalance), principal: parseAmount(v.originalLoanAmount)
    }));
    if (liabilityRows.length > 0) {
      const { error } = await supabase.from('liabilities').insert(liabilityRows);
      if (error) console.error('Liabilities insert error:', error.message);
    }

    // 6. Expense records
    const expenseCategories = {
      household: 'household', transportation: 'transportation', dependants: 'dependants',
      personal: 'personal', miscellaneous: 'miscellaneous', otherExpenses: 'other'
    };
    const expenseRows = [];
    Object.entries(expenseCategories).forEach(([key, category]) => {
      (expenses?.[key] || []).forEach(e => expenseRows.push({
        profile_id:   profileId,
        category,
        amount:       parseAmount(e.amount),
        period_month: periodMonth,
        description:  e.type || null
      }));
    });
    if (expenseRows.length > 0) {
      const { error } = await supabase.from('expenses').insert(expenseRows);
      if (error) console.error('Expenses insert error:', error.message);
    }

    // 7. Store raw KYC payload for record keeping
    await supabase.from('kyc_submissions').insert({
      profile_id:   profileId,
      version:      1,
      status:       'submitted',
      raw_payload:  req.body
    });

    return res.status(200).json({ success: true, submissionId: profileId });

  } catch (error) {
    console.error('KYC Submission Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
