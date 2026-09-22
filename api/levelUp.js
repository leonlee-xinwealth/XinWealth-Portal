import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';
import {
  assetTypeMeta, classifyCashflowRow, levelUpAsset, levelUpLiabilityType, liquidityLevel,
} from './_lib/taxonomy.mjs';

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

  // The form's option labels ('Household', 'Salary', …) are read into the chart
  // of accounts; writing them raw failed the cashflow_categories foreign key.
  // cashflow_entries.amount is CHECK (amount > 0), so empty lines are dropped.
  const cashRow = (direction, label, description, amount) => {
    const placed = classifyCashflowRow({
      direction, category: label, source_note: description || null,
      frequency: 'monthly', is_recurring: true,
    });
    return {
      client_id: clientId, direction, amount, currency: 'MYR', period_month: monthDate,
      is_recurring: placed.is_recurring ?? true, frequency: placed.frequency || 'monthly',
      category: placed.code, source_note: description || null,
      needs_review: placed.needs_review, review_reason: placed.review_reason,
    };
  };
  const cashflowRows = [
    ...(incomes || []).map((i) => cashRow('inflow', i.category || 'Other', i.description, parseAmount(i.amount))),
    ...(expenses || []).map((e) => cashRow('outflow', e.type || e.category || 'Other Expenses', e.description, parseAmount(e.amount))),
  ].filter((r) => r.amount > 0);

  const assetRows = [];
  for (const a of assets || []) {
    const placed = levelUpAsset(a.category, a.description);
    assetRows.push({
      client_id: clientId,
      asset_type: placed.asset_type,
      purpose: assetTypeMeta(placed.asset_type)?.default_purpose ?? null,
      needs_review: placed.needs_review,
      review_reason: placed.review_reason,
      name: a.description || a.category || 'Asset',
      institution: null,
      account_number: null,
      ownership_type: 'sole',
      current_value: parseAmount(a.amount),
      cost_value: null,
      currency: 'MYR',
      valuation_date: monthDate,
      acquired_at: null,
      liquidity: liquidityLevel(placed.asset_type),
      metadata: { source: 'level_up', category_label: a.category || null }
    });
  }
  for (const inv of investments || []) {
    const placed = levelUpAsset(inv.category, inv.description);
    assetRows.push({
      client_id: clientId,
      asset_type: placed.asset_type,
      purpose: assetTypeMeta(placed.asset_type)?.default_purpose ?? null,
      needs_review: placed.needs_review,
      review_reason: placed.review_reason,
      name: inv.description || inv.category || 'Investment',
      institution: null,
      account_number: null,
      ownership_type: 'sole',
      current_value: parseAmount(inv.amount),
      cost_value: null,
      currency: 'MYR',
      valuation_date: monthDate,
      acquired_at: null,
      liquidity: liquidityLevel(placed.asset_type),
      metadata: { source: 'level_up', category_label: inv.category || null, is_investment: true }
    });
  }

  const liabilityRows = [];
  for (const l of liabilities || []) {
    liabilityRows.push({
      client_id: clientId,
      liability_type: levelUpLiabilityType(l.category),
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

