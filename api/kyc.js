import { applyCors, configError, supabaseAdmin } from './_lib/supabase.js';

// =============================================================
// Public KYC submission endpoint.
// No auth required: anyone with the URL can submit.
//
// Writes into the current CRM schema:
//   clients            (one row per submission; advisor-owned)
//   assets             (cash/EPF/property/vehicle/investments)
//   liabilities        (loans, incl. those derived from financed assets)
//   cashflow_entries   (income = inflow, expenses = outflow)
//
// The full raw payload + audit fields live on the client row itself
// (kyc_payload / kyc_status / kyc_submitted_at). There is no separate
// kyc_submissions table and no auth-user creation — onboarding is
// advisor-driven, so a public submission just creates a prospect.
// =============================================================

// clients.advisor_id is NOT NULL. Public KYC has no advisor context, so
// every submission is attached to a default advisor. Override per-env if
// the practice ever has more than one advisor.
const DEFAULT_ADVISOR_ID =
  (process.env.KYC_DEFAULT_ADVISOR_ID || '').trim() ||
  '5ac7f25c-421e-4f03-8dac-ac5375626586'; // Leon Lee

// Maps use the exact button values BasicInfoStep.tsx sends (not regex-normalized —
// hyphens like "Self-Employed" / "Tax-Resident" don't survive naive normalization).
// Values with no DB-enum equivalent (e.g. "Separated", "Not Taxable") map to null;
// the original answer is still preserved verbatim in clients.kyc_payload.
const MARITAL_STATUS_MAP = {
  'Single':    'single',
  'Married':   'married',
  'Divorced':  'divorced',
  'Separated': null,
  'Widowed':   'widowed'
};
const EMPLOYMENT_STATUS_MAP = {
  'Employed':      'employed',
  'Self-Employed': 'self_employed',
  'Unemployed':    'unemployed',
  'Retired':       'retired'
};
const TAX_STATUS_MAP = {
  'Tax-Resident': 'resident',
  'Non Resident': 'non_resident',
  'Not Taxable':  null
};

// Income field -> cashflow_categories.code (inflow)
const INCOME_CATEGORY_MAP = {
  salary:             'salary',
  bonus:              'bonus',
  directorFee:        'director_fee',
  commission:         'commission',
  dividendCompany:    'dividend',
  dividendInvestment: 'investment_return',
  rentalIncome:       'rental_income'
};

// Expense field -> cashflow_categories.code (outflow)
const EXPENSE_CATEGORY_MAP = {
  household:      'household',
  transportation: 'transportation',
  dependants:     'dependants',
  personal:       'personal',
  miscellaneous:  'miscellaneous',
  otherExpenses:  'other_expense'
};

// Simple single-amount asset fields -> [kycKey, asset_type, display name]
const SIMPLE_ASSET_FIELDS = [
  ['savingsAccount',  'savings',       'Savings/Current Account'],
  ['fixedDeposit',    'fixed_deposit', 'Fixed Deposit'],
  ['moneyMarketFund', 'money_market',  'Money Market Fund'],
  ['epfPersaraan',    'epf_account_1', 'EPF Account 1 (Akaun Persaraan)'],
  ['epfSejahtera',    'epf_account_2', 'EPF Account 2 (Akaun Sejahtera)'],
  ['epfFleksibel',    'epf_account_3', 'EPF Account 3 (Akaun Fleksibel)']
];

// List-type assets -> [kycKey, asset_type, derived liability_type | null]
const ASSET_LIST_TYPES = [
  ['properties',  'property', 'mortgage'],
  ['vehicles',    'vehicle',  'car_loan'],
  ['otherAssets', 'other',    null]
];

// Liability list fields -> liability_type
const LIABILITY_LIST_TYPES = [
  ['studyLoans',      'study_loan'],
  ['personalLoans',   'personal_loan'],
  ['renovationLoans', 'renovation_loan'],
  ['otherLoans',      'other']
];

// Investment field -> asset_type (decision: investments are stored as assets).
// NOTE: despite its name, "fixedDeposits" is relabeled in the UI as "Properties
// (for investment purpose only)" (see LanguageContext.tsx investments.fixedDeposits)
// — real fixed deposits are already captured under Net Worth's SIMPLE_ASSET_FIELDS.
const INVESTMENT_ASSET_TYPE_MAP = {
  etf:              'etf',
  stocks:           'stock',
  bonds:            'bond',
  unitTrusts:       'unit_trust',
  fixedDeposits:    'property',
  forex:            'other',
  moneyMarket:      'money_market',
  otherInvestments: 'other'
};

// asset_type -> liquidity_level (assets.liquidity is NOT NULL, default 'medium')
const LIQUIDITY_BY_TYPE = {
  savings:       'high',
  money_market:  'high',
  etf:           'high',
  stock:         'high',
  unit_trust:    'high',
  bond:          'medium',
  fixed_deposit: 'medium',
  epf_account_1: 'low',
  epf_account_2: 'low',
  epf_account_3: 'low',
  property:      'low',
  vehicle:       'low',
  business:      'low',
  other:         'medium'
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

const mapEnum = (value, map) => (value != null && map.hasOwnProperty(value)) ? map[value] : null;

const liquidityFor = (assetType) => LIQUIDITY_BY_TYPE[assetType] || 'medium';

// First day of the reporting month (YYYY-MM-01) for cashflow_entries.period_month
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

const buildFullName = (basic) => {
  const parts = [];
  if (basic.givenName)  parts.push(String(basic.givenName).trim());
  if (basic.familyName) parts.push(String(basic.familyName).trim());
  const joined = parts.join(' ').trim();
  return joined || null;
};

// ---------- handler ----------

// GET /api/kyc?email= — lightweight pre-check called by the KYC form before
// submitting (absorbed from the former /api/check-email to stay within the
// Vercel Hobby 12-function limit). Same trust boundary as the POST itself:
// no auth, and we only reveal a yes/no — never any profile data.
async function handleEmailCheck(req, res) {
  const raw = req.query?.email;
  const email = String(raw || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  // Mirrors the POST rule below: a first-time email, or one that belongs to a
  // prospect whose KYC is still 'pending' (advisor pre-created them), may submit.
  // Only an already-submitted KYC blocks re-entry. (The old /api/check-email
  // queried a nonexistent 'profiles' table and always 500'd.)
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id, kyc_status')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    console.error('kyc email pre-check lookup error:', error);
    return res.status(500).json({ error: error.message });
  }

  if (data && data.kyc_status && data.kyc_status !== 'pending') {
    return res.status(200).json({ available: false, reason: 'DUPLICATE_EMAIL' });
  }
  return res.status(200).json({ available: true });
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabaseAdmin) return configError(res);
  if (req.method === 'GET') {
    try {
      return await handleEmailCheck(req, res);
    } catch (err) {
      console.error('kyc email pre-check error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};
    const { income, assets, liabilities, expenses, investments, ...basic } = payload;

    const email = String(basic.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!basic.pdpaAccepted) return res.status(400).json({ error: 'PDPA acceptance is required' });

    const fullName = buildFullName(basic);
    if (!fullName) return res.status(400).json({ error: 'Name is required' });

    // Resolve which advisor this submission belongs to, from the ?ref=<code>
    // shared link (advisors.referral_code). Falls back to the default advisor
    // when ref is missing or unknown, so legacy /kyc links keep working.
    const ref = String(basic.advisorRef || req.query?.ref || '').trim().toLowerCase();
    let advisorId = DEFAULT_ADVISOR_ID;
    if (ref) {
      const { data: refAdvisor } = await supabaseAdmin
        .from('advisors')
        .select('id')
        .eq('referral_code', ref)
        .eq('status', 'active')
        .maybeSingle();
      if (refAdvisor) advisorId = refAdvisor.id;
    }

    // Look up any existing client with this email. /kyc enriches a prospect the
    // advisor already created (kyc_status still 'pending'); once a KYC has been
    // submitted, further public submissions are blocked (contact your advisor).
    const { data: existingClient, error: lookupErr } = await supabaseAdmin
      .from('clients')
      .select('id, kyc_status')
      .ilike('email', email)
      .maybeSingle();
    if (lookupErr) {
      throw new Error(`Failed to check existing client: ${lookupErr.message}`);
    }
    const isUpdate = Boolean(
      existingClient && (!existingClient.kyc_status || existingClient.kyc_status === 'pending')
    );
    if (existingClient && !isUpdate) {
      return res.status(409).json({
        error: 'This email has already been registered. Please contact your financial advisor to update your information.',
        code: 'DUPLICATE_EMAIL'
      });
    }

    const periodMonth = periodMonthFromKyc(basic);

    // 1. Create or enrich the client (prospect) and capture its id
    const retirementAgeRaw = parseInt(basic.retirementAge, 10);
    const retirementAge = Number.isFinite(retirementAgeRaw) && retirementAgeRaw >= 40 && retirementAgeRaw <= 100
      ? retirementAgeRaw
      : 55;

    // Fields written on both create and enrich. advisor_id / status /
    // pipeline_stage are set only on create — enriching an existing prospect
    // never reassigns it to a different advisor.
    const clientData = {
      full_name:         fullName,
      salutation:        basic.salutation || null,
      email,
      date_of_birth:     toIsoDate(basic.dateOfBirth),
      nationality:       basic.nationality || null,
      residency:         basic.residency || null,
      marital_status:    mapEnum(basic.maritalStatus, MARITAL_STATUS_MAP),
      employment_status: mapEnum(basic.employmentStatus, EMPLOYMENT_STATUS_MAP),
      tax_residency:     mapEnum(basic.taxStatus, TAX_STATUS_MAP),
      occupation:        basic.occupation || null,
      retirement_age:    retirementAge,
      pdpa_accepted_at:  basic.pdpaAccepted ? new Date().toISOString() : null,
      kyc_payload:       payload,
      kyc_status:        'submitted',
      kyc_submitted_at:  new Date().toISOString()
    };

    let clientId;
    if (isUpdate) {
      const { data: updatedClient, error: updateErr } = await supabaseAdmin
        .from('clients')
        .update(clientData)
        .eq('id', existingClient.id)
        .select('id')
        .single();
      if (updateErr) throw new Error(`Failed to update client: ${updateErr.message}`);
      clientId = updatedClient.id;
    } else {
      const { data: insertedClient, error: clientErr } = await supabaseAdmin
        .from('clients')
        .insert({
          ...clientData,
          advisor_id:     advisorId,
          status:         'prospect',
          // CHECK chk_prospect_has_stage: a prospect must carry a pipeline stage
          pipeline_stage: 'new_lead'
        })
        .select('id')
        .single();
      if (clientErr) {
        // Unique violation (race on email/nric) -> treat as duplicate
        if (clientErr.code === '23505') {
          return res.status(409).json({
            error: 'This email has already been registered. Please contact your financial advisor to update your information.',
            code: 'DUPLICATE_EMAIL'
          });
        }
        throw new Error(`Failed to create client: ${clientErr.message}`);
      }
      clientId = insertedClient.id;
    }

    // 2. Build asset rows (simple fields, then list types, then investments)
    const assetRows = [];

    for (const [key, assetType, name] of SIMPLE_ASSET_FIELDS) {
      const amt = parseAmount(assets?.[key]);
      if (amt > 0) {
        assetRows.push({
          client_id:     clientId,
          asset_type:    assetType,
          name,
          current_value: amt,
          currency:      'MYR',
          liquidity:     liquidityFor(assetType),
          metadata:      {}
        });
      }
    }

    // List assets — track loan-linked items so we can create matching liabilities
    const linkedLoanMeta = []; // { rowIndex, liabilityType, ... }
    for (const [key, assetType, derivedLiabilityType] of ASSET_LIST_TYPES) {
      const items = assets?.[key] || [];
      for (const it of items) {
        const amt = parseAmount(it.amount);
        if (amt <= 0 && !it.description) continue;
        const rowIndex = assetRows.length;
        assetRows.push({
          client_id:     clientId,
          asset_type:    assetType,
          name:          it.description || `${assetType} item`,
          current_value: amt,
          currency:      'MYR',
          liquidity:     liquidityFor(assetType),
          metadata: {
            purchasePrice: it.purchasePrice ?? null,
            tenure:        it.tenure ?? null,
            interestRate:  it.interestRate ?? null
          }
        });
        if (it.isUnderLoan && derivedLiabilityType) {
          linkedLoanMeta.push({
            rowIndex,
            liabilityType:      derivedLiabilityType,
            outstandingBalance: it.outstandingBalance,
            originalLoanAmount: it.originalLoanAmount,
            monthlyInstallment: it.monthlyInstallment,
            interestRate:       it.interestRate,
            displayName:        it.description
          });
        }
      }
    }

    // Investments -> assets
    for (const [key, assetType] of Object.entries(INVESTMENT_ASSET_TYPE_MAP)) {
      const items = investments?.[key] || [];
      for (const it of items) {
        const amt = parseAmount(it.amount);
        if (amt <= 0 && !it.description) continue;
        assetRows.push({
          client_id:     clientId,
          asset_type:    assetType,
          name:          it.description || `${assetType} holding`,
          current_value: amt,
          cost_value:    amt > 0 ? amt : null,
          currency:      'MYR',
          liquidity:     liquidityFor(assetType),
          metadata:      {}
        });
      }
    }

    // Insert assets, capturing generated ids in insertion order
    let insertedAssets = [];
    if (assetRows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('assets')
        .insert(assetRows)
        .select('id');
      if (error) throw new Error(`Failed to insert assets: ${error.message}`);
      insertedAssets = data || [];
    }

    // 3. Build liability rows (explicit lists, then asset-derived loans)
    const liabilityRows = [];
    for (const [key, liabilityType] of LIABILITY_LIST_TYPES) {
      const items = liabilities?.[key] || [];
      for (const it of items) {
        const balance   = parseAmount(it.outstandingBalance ?? it.amount);
        const principal = parseAmount(it.originalLoanAmount);
        if (balance <= 0 && principal <= 0 && !it.description) continue;
        liabilityRows.push({
          client_id:           clientId,
          liability_type:      liabilityType,
          name:                it.description || `${liabilityType} item`,
          original_principal:  principal > 0 ? principal : null,
          outstanding_balance: balance,
          interest_rate:       parseRate(it.interestRate),
          monthly_payment:     parseAmount(it.monthlyInstallment) || null,
          linked_asset_id:     null
        });
      }
    }
    for (const meta of linkedLoanMeta) {
      const balance   = parseAmount(meta.outstandingBalance);
      const principal = parseAmount(meta.originalLoanAmount);
      if (balance <= 0 && principal <= 0) continue;
      liabilityRows.push({
        client_id:           clientId,
        liability_type:      meta.liabilityType,
        name:                meta.displayName ? `${meta.displayName} (loan)` : `${meta.liabilityType} item`,
        original_principal:  principal > 0 ? principal : null,
        outstanding_balance: balance,
        interest_rate:       parseRate(meta.interestRate),
        monthly_payment:     parseAmount(meta.monthlyInstallment) || null,
        linked_asset_id:     insertedAssets[meta.rowIndex]?.id || null
      });
    }

    // 4. Build cashflow rows (income = inflow, expenses = outflow)
    const cashflowRows = [];

    for (const [kycKey, category] of Object.entries(INCOME_CATEGORY_MAP)) {
      const amt = parseAmount(income?.[kycKey]);
      if (amt > 0) {
        cashflowRows.push({
          client_id:    clientId,
          direction:    'inflow',
          category,
          amount:       amt,
          currency:     'MYR',
          period_month: periodMonth,
          is_recurring: kycKey !== 'bonus',
          frequency:    'monthly',
          source_note:  null
        });
      }
    }

    for (const [kycKey, category] of Object.entries(EXPENSE_CATEGORY_MAP)) {
      const items = expenses?.[kycKey] || [];
      for (const it of items) {
        const amt = parseAmount(it.amount);
        if (amt <= 0) continue;
        cashflowRows.push({
          client_id:    clientId,
          direction:    'outflow',
          category,
          amount:       amt,
          currency:     'MYR',
          period_month: periodMonth,
          is_recurring: true,
          frequency:    'monthly',
          source_note:  it.type || it.description || null
        });
      }
    }

    // 5. Insert child rows
    if (liabilityRows.length > 0) {
      const { error } = await supabaseAdmin.from('liabilities').insert(liabilityRows);
      if (error) throw new Error(`Failed to insert liabilities: ${error.message}`);
    }
    if (cashflowRows.length > 0) {
      const { error } = await supabaseAdmin.from('cashflow_entries').insert(cashflowRows);
      if (error) throw new Error(`Failed to insert cashflow entries: ${error.message}`);
    }

    return res.status(200).json({
      success:      true,
      submissionId: clientId,
      clientId
    });

  } catch (error) {
    console.error('KYC Submission Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
