import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';

const parseAmount = (val) => {
  if (val == null || val === '') return 0;
  const n = parseFloat(String(val).replace(/RM/gi, '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

const periodMonth = (targetMonth, targetYear) => {
  const m = parseInt(targetMonth, 10);
  const y = parseInt(targetYear, 10);
  const month = Number.isFinite(m) && m >= 0 && m <= 11 ? m : new Date().getMonth();
  const year = Number.isFinite(y) ? y : new Date().getFullYear();
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
};

const assetTypeFromCategory = (cat) => {
  const c = String(cat || '').toLowerCase();
  if (c.includes('fixed')) return 'fixed_deposit';
  if (c.includes('money market')) return 'money_market';
  if (c.includes('cash') || c.includes('savings')) return 'savings';
  if (c.includes('epf')) return 'epf_account_1';
  if (c.includes('property')) return 'property';
  if (c.includes('vehicle')) return 'vehicle';
  if (c.includes('etf')) return 'etf';
  if (c.includes('stock')) return 'stock';
  if (c.includes('unit trust')) return 'unit_trust';
  if (c.includes('bond')) return 'bond';
  return 'other';
};

const liabilityTypeFromCategory = (cat) => {
  const c = String(cat || '').toLowerCase();
  if (c.includes('mortgage') || c.includes('property')) return 'mortgage';
  if (c.includes('vehicle') || c.includes('car')) return 'car_loan';
  if (c.includes('study')) return 'study_loan';
  if (c.includes('personal')) return 'personal_loan';
  if (c.includes('renovation')) return 'renovation_loan';
  return 'other';
};

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseAdmin) return configError(res);

  const { user, error } = await getAuthUser(req);
  if (error || !user) {
    return res.status(401).json({ error: `Unauthorized: ${error || 'Invalid token'}` });
  }

  const email = (user.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Missing email on auth user' });

  const { data: clientRow, error: clientErr } = await supabaseAdmin
    .from('clients')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (clientErr) return res.status(500).json({ error: 'Error fetching client', details: clientErr.message });
  if (!clientRow?.id) return res.status(404).json({ error: 'Client profile not found' });

  const {
    targetMonth,
    targetYear,
    incomes,
    expenses,
    assets,
    liabilities,
    investments
  } = req.body || {};

  if (targetMonth == null || targetYear == null) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const monthDate = periodMonth(targetMonth, targetYear);
  const clientId = clientRow.id;

  const cashflowRows = [];
  for (const i of incomes || []) {
    cashflowRows.push({
      client_id: clientId,
      direction: 'inflow',
      amount: parseAmount(i.amount),
      currency: 'MYR',
      period_month: monthDate,
      is_recurring: true,
      frequency: 'monthly',
      category: i.category || 'Income',
      source_note: i.description || null
    });
  }
  for (const e of expenses || []) {
    cashflowRows.push({
      client_id: clientId,
      direction: 'outflow',
      amount: parseAmount(e.amount),
      currency: 'MYR',
      period_month: monthDate,
      is_recurring: true,
      frequency: 'monthly',
      category: e.type || e.category || 'Expense',
      source_note: e.description || null
    });
  }

  const assetRows = [];
  for (const a of assets || []) {
    assetRows.push({
      client_id: clientId,
      asset_type: assetTypeFromCategory(a.category),
      name: a.description || a.category || 'Asset',
      institution: null,
      account_number: null,
      ownership_type: 'sole',
      current_value: parseAmount(a.amount),
      cost_value: null,
      currency: 'MYR',
      valuation_date: monthDate,
      acquired_at: null,
      liquidity: 'medium',
      metadata: { source: 'level_up', category_label: a.category || null }
    });
  }
  for (const inv of investments || []) {
    assetRows.push({
      client_id: clientId,
      asset_type: assetTypeFromCategory(inv.category),
      name: inv.description || inv.category || 'Investment',
      institution: null,
      account_number: null,
      ownership_type: 'sole',
      current_value: parseAmount(inv.amount),
      cost_value: null,
      currency: 'MYR',
      valuation_date: monthDate,
      acquired_at: null,
      liquidity: 'medium',
      metadata: { source: 'level_up', category_label: inv.category || null, is_investment: true }
    });
  }

  const liabilityRows = [];
  for (const l of liabilities || []) {
    liabilityRows.push({
      client_id: clientId,
      liability_type: liabilityTypeFromCategory(l.category),
      name: l.description || l.category || 'Liability',
      lender: null,
      original_principal: null,
      outstanding_balance: parseAmount(l.amount),
      interest_rate: null,
      monthly_payment: null,
      start_date: monthDate,
      end_date: null,
      linked_asset_id: null,
      currency: 'MYR',
      metadata: { source: 'level_up', category_label: l.category || null }
    });
  }

  const inserts = [];
  if (cashflowRows.length > 0) inserts.push(supabaseAdmin.from('cashflow_entries').insert(cashflowRows));
  if (assetRows.length > 0) inserts.push(supabaseAdmin.from('assets').insert(assetRows));
  if (liabilityRows.length > 0) inserts.push(supabaseAdmin.from('liabilities').insert(liabilityRows));

  if (inserts.length > 0) {
    const results = await Promise.all(inserts);
    const firstError = results.find(r => r.error)?.error;
    if (firstError) {
      return res.status(500).json({ error: 'Failed to level up', details: firstError.message });
    }
  }

  return res.status(200).json({ success: true });
}

