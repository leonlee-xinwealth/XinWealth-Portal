import { supabaseAdmin } from './_lib/supabase.js';

// =============================================================
// Public KYC submission endpoint.
// No auth required: anyone with the URL can submit.
// Creates (or reuses) an auth user + profile, writes child rows
// into incomes / expenses / assets / liabilities / investments,
// and stores the raw payload in kyc_submissions for audit.
// Does NOT send a recovery email — onboarding is advisor-driven.
// =============================================================

const MARITAL_STATUSES   = ['single', 'married', 'divorced', 'widowed'];
const EMPLOYMENT_STATUSES = ['employed', 'self_employed', 'unemployed', 'retired', 'student'];
const TAX_STATUSES       = ['resident', 'non_resident'];

const INCOME_TYPE_MAP = {
  salary:             'salary',
  bonus:              'bonus',
  directorFee:        'director_fee',
  commission:         'commission',
  dividendCompany:    'dividend_company',
  dividendInvestment: 'dividend_investment',
  rentalIncome:       'rental'
};

const EXPENSE_CATEGORY_MAP = {
  household:      'household',
  transportation: 'transportation',
  dependants:     'dependants',
  personal:       'personal',
  miscellaneous:  'miscellaneous',
  otherExpenses:  'other'
};

const SIMPLE_ASSET_FIELDS = [
  ['savingsAccount',   'savings',           'Savings/Current Account'],
  ['fixedDeposit',     'fixed_deposit',     'Fixed Deposit'],
  ['moneyMarketFund',  'money_market_fund', 'Money Market Fund'],
  ['epfPersaraan',     'epf_account_1',     'EPF Account 1 (Akaun Persaraan)'],
  ['epfSejahtera',     'epf_account_2',     'EPF Account 2 (Akaun Sejahtera)'],
  ['epfFleksibel',     'epf_account_3',     'EPF Account 3 (Akaun Fleksibel)']
];

const ASSET_LIST_TYPES = [
  // [kycKey, asset_kind, derived_loan_kind | null]
  ['properties',  'property', 'mortgage'],
  ['vehicles',    'vehicle',  'car_loan'],
  ['otherAssets', 'other',    null]
];

const LIABILITY_LIST_TYPES = [
  ['studyLoans',      'study_loan'],
  ['personalLoans',   'personal_loan'],
  ['renovationLoans', 'renovation_loan'],
  ['otherLoans',      'other']
];

const INVESTMENT_CLASS_MAP = {
  etf:              'etf',
  stocks:           'stock',
  bonds:            'bond',
  unitTrusts:       'unit_trust',
  fixedDeposits:    'fixed_deposit',
  forex:            'forex',
  moneyMarket:      'money_market',
  otherInvestments: 'other'
};

// ---------- helpers ----------

const parseAmount = (val) => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/RM/gi, '').replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const parseRate = (val) => {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(/%/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

const normalizeEnum = (value, allowed) => {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
  return v && allowed.includes(v) ? v : null;
};

const periodMonthFromKyc = (basic) => {
  const rawMonth = basic.globalMonth != null && basic.globalMonth !== ''
    ? basic.globalMonth
    : new Date().getMonth();
  const rawYear = basic.globalYear != null && basic.globalYear !== ''
    ? basic.globalYear
    : new Date().getFullYear();
  const m = parseInt(rawMonth, 10);
  const y = parseInt(rawYear, 10);
  const month = Number.isFinite(m) && m >= 0 && m <= 11 ? m : new Date().getMonth();
  const year  = Number.isFinite(y) ? y : new Date().getFullYear();
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
};

const toIsoDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
};

// Look up an existing auth user by email; create one if missing.
// Returns { userId, isNewUser }.
async function findOrCreateAuthUser(email) {
  // Prefer the profiles table (cheap, indexed)
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile?.id) {
    return { userId: existingProfile.id, isNewUser: false };
  }

  // No profile yet — try to create the auth user.
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true
  });

  if (!createErr && created?.user?.id) {
    return { userId: created.user.id, isNewUser: true };
  }

  // Auth user may already exist without a profile — find it.
  const msg = createErr?.message || '';
  if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find(u => (u.email || '').toLowerCase() === email);
    if (existing?.id) return { userId: existing.id, isNewUser: false };
  }

  throw new Error(`Failed to create auth user: ${msg || 'unknown error'}`);
}

// ---------- handler ----------

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({
      error: 'Server Config Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    });
  }

  try {
    const payload = req.body || {};
    const { income, assets, liabilities, expenses, investments, ...basic } = payload;

    const email = String(basic.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!basic.pdpaAccepted) return res.status(400).json({ error: 'PDPA acceptance is required' });

    const periodMonth = periodMonthFromKyc(basic);

    // 1. Find or create auth user
    const { userId, isNewUser } = await findOrCreateAuthUser(email);

    // 2. Upsert profile (one row per auth user)
    const retirementAgeRaw = parseInt(basic.retirementAge, 10);
    const retirementAge = Number.isFinite(retirementAgeRaw) && retirementAgeRaw >= 40 && retirementAgeRaw <= 100
      ? retirementAgeRaw
      : 55;

    const profileData = {
      id:                userId,
      role:              'client',
      email,
      family_name:       basic.familyName || null,
      given_name:        basic.givenName || null,
      salutation:        basic.salutation || null,
      date_of_birth:     toIsoDate(basic.dateOfBirth),
      nationality:       basic.nationality || null,
      residency:         basic.residency || null,
      marital_status:    normalizeEnum(basic.maritalStatus, MARITAL_STATUSES),
      employment_status: normalizeEnum(basic.employmentStatus, EMPLOYMENT_STATUSES),
      tax_status:        normalizeEnum(basic.taxStatus, TAX_STATUSES),
      occupation:        basic.occupation || null,
      retirement_age:    retirementAge,
      pdpa_accepted_at:  basic.pdpaAccepted ? new Date().toISOString() : null
    };

    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });
    if (profileErr) throw new Error(`Failed to upsert profile: ${profileErr.message}`);

    // 3. Determine version for kyc_submissions
    const { data: existingSubs } = await supabaseAdmin
      .from('kyc_submissions')
      .select('version')
      .eq('profile_id', userId)
      .order('version', { ascending: false })
      .limit(1);
    const nextVersion = (existingSubs?.[0]?.version || 0) + 1;

    // 4. Insert raw kyc_submissions audit row
    const { error: kycErr } = await supabaseAdmin
      .from('kyc_submissions')
      .insert({
        profile_id:  userId,
        version:     nextVersion,
        status:      'submitted',
        raw_payload: payload
      });
    if (kycErr) throw new Error(`Failed to record kyc submission: ${kycErr.message}`);

    // 5. Build child-table rows
    // Incomes (single-amount per type; only insert if > 0)
    const incomeRows = [];
    for (const [kycKey, enumVal] of Object.entries(INCOME_TYPE_MAP)) {
      const amt = parseAmount(income?.[kycKey]);
      if (amt > 0) {
        incomeRows.push({
          profile_id:   userId,
          income_type:  enumVal,
          amount:       amt,
          currency:     'MYR',
          period_month: periodMonth,
          is_recurring: kycKey !== 'bonus',
          source_note:  null
        });
      }
    }

    // Expenses (arrays of items)
    const expenseRows = [];
    for (const [kycKey, catEnum] of Object.entries(EXPENSE_CATEGORY_MAP)) {
      const items = expenses?.[kycKey] || [];
      for (const it of items) {
        const amt = parseAmount(it.amount);
        if (amt <= 0) continue;
        expenseRows.push({
          profile_id:   userId,
          category:     catEnum,
          amount:       amt,
          currency:     'MYR',
          period_month: periodMonth,
          is_fixed:     true,
          description:  it.type || it.description || null
        });
      }
    }

    // Assets — simple fields first
    const assetRows = [];
    for (const [key, kind, name] of SIMPLE_ASSET_FIELDS) {
      const amt = parseAmount(assets?.[key]);
      if (amt > 0) {
        assetRows.push({
          profile_id: userId,
          kind,
          name,
          value:      amt,
          currency:   'MYR',
          metadata:   {}
        });
      }
    }

    // Assets — list types (properties / vehicles / other), tracking loan-linked items
    // so we can later create matching liability rows pointing at the inserted asset id.
    const linkedLoanMeta = []; // { rowIndex, loanKind, ... }
    for (const [key, kind, derivedLoanKind] of ASSET_LIST_TYPES) {
      const items = assets?.[key] || [];
      for (const it of items) {
        const amt = parseAmount(it.amount);
        if (amt <= 0 && !it.description) continue;
        const row = {
          profile_id:  userId,
          kind,
          name:        it.description || `${kind} item`,
          value:       amt,
          currency:    'MYR',
          acquired_at: null,
          metadata: {
            purchasePrice: it.purchasePrice ?? null,
            tenure:        it.tenure ?? null,
            interestRate:  it.interestRate ?? null
          }
        };
        const rowIndex = assetRows.length;
        assetRows.push(row);
        if (it.isUnderLoan && derivedLoanKind) {
          linkedLoanMeta.push({
            rowIndex,
            loanKind:           derivedLoanKind,
            outstandingBalance: it.outstandingBalance,
            originalLoanAmount: it.originalLoanAmount,
            monthlyInstallment: it.monthlyInstallment,
            interestRate:       it.interestRate,
            displayName:        it.description
          });
        }
      }
    }

    // Insert assets and capture their generated ids in the same order
    let insertedAssets = [];
    if (assetRows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('assets')
        .insert(assetRows)
        .select('id');
      if (error) throw new Error(`Failed to insert assets: ${error.message}`);
      insertedAssets = data || [];
    }

    // Liabilities — explicit list types (study/personal/renovation/other)
    const liabilityRows = [];
    for (const [key, kind] of LIABILITY_LIST_TYPES) {
      const items = liabilities?.[key] || [];
      for (const it of items) {
        const balance   = parseAmount(it.outstandingBalance ?? it.amount);
        const principal = parseAmount(it.originalLoanAmount);
        if (balance <= 0 && principal <= 0 && !it.description) continue;
        liabilityRows.push({
          profile_id:      userId,
          kind,
          name:            it.description || `${kind} item`,
          principal:       principal > 0 ? principal : null,
          balance,
          interest_rate:   parseRate(it.interestRate),
          monthly_payment: parseAmount(it.monthlyInstallment) || null,
          start_date:      null,
          end_date:        null,
          linked_asset_id: null
        });
      }
    }

    // Liabilities — derived from assets that have loans (mortgage / car_loan)
    for (const meta of linkedLoanMeta) {
      const balance   = parseAmount(meta.outstandingBalance);
      const principal = parseAmount(meta.originalLoanAmount);
      if (balance <= 0 && principal <= 0) continue;
      const linkedId = insertedAssets[meta.rowIndex]?.id || null;
      liabilityRows.push({
        profile_id:      userId,
        kind:            meta.loanKind,
        name:            meta.displayName ? `${meta.displayName} (loan)` : `${meta.loanKind} item`,
        principal:       principal > 0 ? principal : null,
        balance,
        interest_rate:   parseRate(meta.interestRate),
        monthly_payment: parseAmount(meta.monthlyInstallment) || null,
        start_date:      null,
        end_date:        null,
        linked_asset_id: linkedId
      });
    }

    // Investments
    const investmentRows = [];
    for (const [key, classEnum] of Object.entries(INVESTMENT_CLASS_MAP)) {
      const items = investments?.[key] || [];
      for (const it of items) {
        const amt = parseAmount(it.amount);
        if (amt <= 0 && !it.description) continue;
        investmentRows.push({
          profile_id:    userId,
          asset_class:   classEnum,
          name:          it.description || `${classEnum} holding`,
          cost_basis:    amt > 0 ? amt : null,
          current_value: amt > 0 ? amt : null,
          currency:      'MYR',
          metadata:      {}
        });
      }
    }

    // 6. Insert child rows (incomes / expenses / liabilities / investments)
    if (incomeRows.length > 0) {
      const { error } = await supabaseAdmin.from('incomes').insert(incomeRows);
      if (error) throw new Error(`Failed to insert incomes: ${error.message}`);
    }
    if (expenseRows.length > 0) {
      const { error } = await supabaseAdmin.from('expenses').insert(expenseRows);
      if (error) throw new Error(`Failed to insert expenses: ${error.message}`);
    }
    if (liabilityRows.length > 0) {
      const { error } = await supabaseAdmin.from('liabilities').insert(liabilityRows);
      if (error) throw new Error(`Failed to insert liabilities: ${error.message}`);
    }
    if (investmentRows.length > 0) {
      const { error } = await supabaseAdmin.from('investments').insert(investmentRows);
      if (error) throw new Error(`Failed to insert investments: ${error.message}`);
    }

    return res.status(200).json({
      success:      true,
      submissionId: userId,
      version:      nextVersion,
      isNewUser
    });

  } catch (error) {
    console.error('KYC Submission Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
