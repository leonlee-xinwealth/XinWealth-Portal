import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';
import { assetCategory, cashflowLabel } from './_lib/portalLabels.js';
import { categoryLabel, isTransferCategory } from './_lib/taxonomy.mjs';
import {
  MONTH_NAMES, buildDerivedExpenseRecords, isSupersededOutflow, latestMonthYear,
} from './_lib/portalDerived.js';

const monthName = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return MONTH_NAMES[d.getMonth()] || '';
};

const yearString = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return String(d.getFullYear());
};

const toMs = (dateStr) => {
  const d = new Date(dateStr);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
};

const record = (id, fields) => ({ id, record_id: id, fields });

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
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
  if (!clientRow?.id) {
    return res.status(200).json({
      assets: [],
      liabilities: [],
      incomes: [],
      expenses: [],
      investments: [],
      insurances: [],
      snapshots: []
    });
  }

  const clientId = clientRow.id;

  const [
    { data: assets, error: assetsErr },
    { data: liabilities, error: liabilitiesErr },
    { data: cashflows, error: cashflowErr },
    { data: insurances, error: insuranceErr },
    { data: snapshots, error: snapshotsErr },
    { data: holdings, error: holdingsErr }
  ] = await Promise.all([
    supabaseAdmin.from('assets').select('*').eq('client_id', clientId),
    supabaseAdmin.from('liabilities').select('*').eq('client_id', clientId),
    supabaseAdmin.from('cashflow_entries').select('*').eq('client_id', clientId),
    supabaseAdmin.from('insurance_policies').select('*').eq('client_id', clientId),
    supabaseAdmin.from('health_snapshots').select('*').eq('client_id', clientId),
    supabaseAdmin.from('portfolio_holdings').select('*').eq('client_id', clientId)
  ]);

  if (assetsErr) return res.status(500).json({ error: 'Failed to fetch assets', details: assetsErr.message });
  if (liabilitiesErr) return res.status(500).json({ error: 'Failed to fetch liabilities', details: liabilitiesErr.message });
  if (cashflowErr) return res.status(500).json({ error: 'Failed to fetch cashflow', details: cashflowErr.message });
  if (insuranceErr) return res.status(500).json({ error: 'Failed to fetch insurance', details: insuranceErr.message });
  if (snapshotsErr) return res.status(500).json({ error: 'Failed to fetch snapshots', details: snapshotsErr.message });
  if (holdingsErr) return res.status(500).json({ error: 'Failed to fetch holdings', details: holdingsErr.message });

  const assetRecords = (assets || []).map((a) => {
    if (a?.metadata && typeof a.metadata === 'object' && a.metadata.is_investment) return null;
    const date = a.valuation_date || a.acquired_at || a.created_at;
    return record(a.id, {
      'Type': 'Asset',
      'Category': assetCategory(a.asset_type),
      'Description': a.name || '',
      'Value': Number(a.current_value || 0),
      'Original Purchase Price/Principal': a.cost_value != null ? Number(a.cost_value) : null,
      'Month': monthName(date) || '',
      'Year': yearString(date) || '',
      'Date': toMs(date)
    });
  }).filter(Boolean);

  const liabilityRecords = (liabilities || []).map((l) => {
    const date = l.start_date || l.created_at;
    return record(l.id, {
      'Type': 'Liability',
      'Category': l.liability_type || '',
      'Description': l.name || '',
      'Value': Number(l.outstanding_balance || 0),
      'Month': monthName(date) || '',
      'Year': yearString(date) || '',
      'Date': toMs(date)
    });
  });

  const incomeRecords = (cashflows || [])
    // transfers (selling an asset, drawing on savings, a loan drawdown) are the
    // client's own money changing form — not income (spec 2026-09-22 §1)
    .filter((c) => c.direction === 'inflow' && !isTransferCategory(c.category, 'inflow'))
    .map((c) => {
      const date = c.period_month || c.created_at;
      const cat = cashflowLabel('inflow', c.category);
      return record(c.id, {
        'Category': cat,
        'Description': c.source_note || '',
        'Amount': Number(c.amount || 0),
        'Month': monthName(date) || '',
        'Year': yearString(date) || '',
        'Date': toMs(date)
      });
    });

  const expenseRecords = (cashflows || [])
    // saving and investing is not spending; a row now covered by a liability's
    // or policy's own derived installment/premium is dropped here too (决策 4)
    // so it isn't double-counted against the derived record appended below.
    .filter((c) => c.direction === 'outflow' && !isTransferCategory(c.category, 'outflow'))
    .filter((c) => !isSupersededOutflow(c, liabilities || [], insurances || []))
    .map((c) => {
      const date = c.period_month || c.created_at;
      const type = cashflowLabel('outflow', c.category);
      return record(c.id, {
        'Category': categoryLabel(c.category, 'en'),
        'Type': type,
        'Description': c.source_note || '',
        'Amount': Number(c.amount || 0),
        'Month': monthName(date) || '',
        'Year': yearString(date) || '',
        'Date': toMs(date)
      });
    });

  // Installments (from liabilities) and premiums (from active policies) never
  // live in cashflow_entries (spec decision 1) — computed here at read time
  // and filed under the same Year/Month the client portal already treats as
  // "latest" (services/apiService.ts getLatestRecords), so they're picked up
  // alongside the manual rows for that period instead of being invisible.
  const { month: latestMonth, year: latestYear } = latestMonthYear(expenseRecords);
  const derivedExpenseRecords = buildDerivedExpenseRecords({
    liabilities: liabilities || [],
    policies: insurances || [],
    month: latestMonth,
    year: latestYear,
  }).map((r) => record(r.id, r.fields));

  const holdingsByMonth = new Map();
  for (const h of holdings || []) {
    const date = h.snapshot_month || h.created_at;
    const key = String(date || '');
    const current = holdingsByMonth.get(key) || { id: key, date, marketValue: 0 };
    current.marketValue += Number(h.market_value || 0);
    holdingsByMonth.set(key, current);
  }
  const investmentRecords = Array.from(holdingsByMonth.values()).map((row) => {
    const date = row.date;
    return record(row.id, {
      'Category': 'Investment',
      'Description': 'Portfolio Holdings',
      'Amount': Number(row.marketValue || 0),
      'End Value': Number(row.marketValue || 0),
      'Cashflow': 0,
      'FD': 0,
      'Month': monthName(date) || '',
      'Year': yearString(date) || '',
      'Date': toMs(date)
    });
  });

  const investmentAssetRecords = (assets || [])
    .filter((a) => a?.metadata && typeof a.metadata === 'object' && a.metadata.is_investment)
    .map((a) => {
      const date = a.valuation_date || a.acquired_at || a.created_at;
      return record(a.id, {
        'Category': a.metadata.category_label || assetCategory(a.asset_type),
        'Description': a.name || '',
        'Amount': Number(a.current_value || 0),
        'End Value': Number(a.current_value || 0),
        'Cashflow': 0,
        'FD': 0,
        'Month': monthName(date) || '',
        'Year': yearString(date) || '',
        'Date': toMs(date)
      });
    });

  const insuranceRecords = (insurances || []).map((p) =>
    record(p.id, {
      'Insurer': p.provider || '',
      'Plan Name': p.policy_type || '',
      'Policy Number': p.policy_number || '',
      'Sum Assured': p.sum_assured != null ? Number(p.sum_assured) : 0,
      'Premium': p.premium != null ? Number(p.premium) : 0
    })
  );

  const snapshotRecords = (snapshots || []).map((s) => {
    const date = s.snapshot_date;
    return record(`${s.client_id}-${s.snapshot_date}`, {
      'Date': toMs(date),
      'Current Value': s.net_worth != null ? Number(s.net_worth) : 0,
      'Monthly Income': 0,
      'Monthly Expenses': 0,
      'Monthly Repayment': 0,
      'Month': monthName(date) || '',
      'Year': yearString(date) || ''
    });
  });

  return res.status(200).json({
    assets: assetRecords,
    liabilities: liabilityRecords,
    incomes: incomeRecords,
    expenses: [...expenseRecords, ...derivedExpenseRecords],
    investments: [...investmentRecords, ...investmentAssetRecords],
    insurances: insuranceRecords,
    snapshots: snapshotRecords
  });
}
