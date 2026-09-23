import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';
import {
  assetTypeMeta, classifyCashflowRow, levelUpAsset, levelUpLiabilityType, liquidityLevel,
} from './_lib/taxonomy.mjs';
import { isMissingTableError } from './_lib/degrade.js';
import { quarterlyPeriodEnd } from './_lib/reviewDates.js';

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
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
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

  const clientId = clientRow.id;

  // CFP P4 Task C — quarterly review mode: GET action:'prefill' / POST
  // action:'submit_review'. Kept in the same file as the monthly-actuals
  // path below (Vercel Hobby plan is at its function-count limit, so this
  // can't be a new api/*.js file — spec docs/superpowers/specs/
  // 2026-09-27-cfp-p4-review-monitoring-design.md 决策 1/section C).
  if (req.method === 'GET') {
    if (req.query?.mode === 'review' && req.query?.action === 'prefill') {
      return handleReviewPrefill(res, clientId);
    }
    return res.status(400).json({ error: 'Unsupported GET request' });
  }

  if (req.body?.mode === 'review') {
    if (req.body?.action === 'submit_review') {
      return handleSubmitReview(res, clientId, req.body);
    }
    return res.status(400).json({ error: 'Unsupported review action' });
  }

  return handleMonthlyActuals(res, clientId, req.body || {});
}

async function handleMonthlyActuals(res, clientId, body) {
  const {
    targetMonth,
    targetYear,
    incomes,
    expenses,
    assets,
    liabilities,
    investments
  } = body;

  if (targetMonth == null || targetYear == null) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const monthDate = periodMonth(targetMonth, targetYear);

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

// ---------------------------------------------------------------------------
// CFP P4 Task C — quarterly review (client-submitted).
// spec docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md
// 决策 1, 2, 5, 6, section C. D5: a submitted review changes nothing on its
// own — approving it (advisor side, components/advisor/review/approveReview.ts)
// is what writes asset_valuations/liability_balances/assets/liabilities/
// health_snapshots. This endpoint only ever inserts a `reviews` row.
// ---------------------------------------------------------------------------

/** GET ?mode=review&action=prefill — the client's current assets/liabilities
 *  (to prefill the "no change" step) plus the latest quarterly review, so
 *  LevelUp.tsx can show the 「已提交，等待顾问审核」 state instead of the form
 *  when one is already sitting there. */
async function handleReviewPrefill(res, clientId) {
  const [{ data: assets, error: assetsErr }, { data: liabilities, error: liabilitiesErr }] = await Promise.all([
    supabaseAdmin.from('assets').select('id, name, asset_type, current_value').eq('client_id', clientId),
    supabaseAdmin.from('liabilities')
      .select('id, name, liability_type, outstanding_balance, interest_rate, monthly_payment')
      .eq('client_id', clientId),
  ]);
  if (assetsErr) return res.status(500).json({ error: 'Failed to fetch assets', details: assetsErr.message });
  if (liabilitiesErr) return res.status(500).json({ error: 'Failed to fetch liabilities', details: liabilitiesErr.message });

  let latestReview = null;
  let reviewUnavailable = false;
  try {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('id, status, kind, period_end, submitted_at, approved_at, advisor_note')
      .eq('client_id', clientId)
      .eq('kind', 'quarterly')
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    latestReview = data || null;
  } catch (e) {
    reviewUnavailable = isMissingTableError(e);
    latestReview = null;
  }

  return res.status(200).json({
    assets: (assets || []).map((a) => ({
      id: a.id, name: a.name, type: a.asset_type, current_value: Number(a.current_value) || 0,
    })),
    liabilities: (liabilities || []).map((l) => ({
      id: l.id,
      name: l.name,
      type: l.liability_type,
      outstanding_balance: Number(l.outstanding_balance) || 0,
      interest_rate: l.interest_rate != null ? Number(l.interest_rate) : null,
      monthly_payment: l.monthly_payment != null ? Number(l.monthly_payment) : null,
    })),
    review: latestReview,
    review_unavailable: reviewUnavailable,
  });
}

/** POST { mode:'review', action:'submit_review', assets, liabilities, notes }
 *  — writes ONE `reviews` row (kind:'quarterly', status:'submitted',
 *  submitted_by:'client'). `prev_value`/`prev_balance`/`prev_rate` are always
 *  taken from the server's own current DB read, never trusted from the
 *  client, so the advisor's before/after comparison (ReviewTab.tsx) can't be
 *  spoofed by a stale or tampered request body. */
async function handleSubmitReview(res, clientId, body) {
  const submittedAssets = Array.isArray(body.assets) ? body.assets : [];
  const submittedLiabilities = Array.isArray(body.liabilities) ? body.liabilities : [];
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

  const [{ data: assets, error: assetsErr }, { data: liabilities, error: liabilitiesErr }] = await Promise.all([
    supabaseAdmin.from('assets').select('id, current_value').eq('client_id', clientId),
    supabaseAdmin.from('liabilities').select('id, outstanding_balance, interest_rate, monthly_payment').eq('client_id', clientId),
  ]);
  if (assetsErr) return res.status(500).json({ error: 'Failed to fetch assets', details: assetsErr.message });
  if (liabilitiesErr) return res.status(500).json({ error: 'Failed to fetch liabilities', details: liabilitiesErr.message });

  const assetById = new Map((assets || []).map((a) => [a.id, a]));
  const liabilityById = new Map((liabilities || []).map((l) => [l.id, l]));

  // Only entries for assets/liabilities that actually belong to this client
  // make it into the payload — an id that doesn't resolve is silently
  // dropped rather than trusted from the request body.
  const payloadAssets = submittedAssets
    .filter((a) => a && assetById.has(a.asset_id))
    .map((a) => {
      const current = assetById.get(a.asset_id);
      return {
        asset_id: a.asset_id,
        prev_value: current.current_value != null ? Number(current.current_value) : null,
        value: parseAmount(a.value),
      };
    });

  const payloadLiabilities = submittedLiabilities
    .filter((l) => l && liabilityById.has(l.liability_id))
    .map((l) => {
      const current = liabilityById.get(l.liability_id);
      const interestRate = l.interest_rate != null && l.interest_rate !== ''
        ? parseAmount(l.interest_rate)
        : (current.interest_rate != null ? Number(current.interest_rate) : null);
      const monthlyPayment = l.monthly_payment != null && l.monthly_payment !== ''
        ? parseAmount(l.monthly_payment)
        : (current.monthly_payment != null ? Number(current.monthly_payment) : null);
      return {
        liability_id: l.liability_id,
        prev_balance: current.outstanding_balance != null ? Number(current.outstanding_balance) : null,
        balance: parseAmount(l.balance),
        prev_rate: current.interest_rate != null ? Number(current.interest_rate) : null,
        interest_rate: interestRate,
        monthly_payment: monthlyPayment,
      };
    });

  // A client can't submit a second quarterly review while one is still
  // awaiting approval — mirrors the "if a submitted review exists show that
  // state instead of the form" rule in LevelUp.tsx, enforced here too since
  // the client is not the only thing that can call this endpoint.
  try {
    const { data: pending, error: pendingErr } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('client_id', clientId)
      .eq('kind', 'quarterly')
      .eq('status', 'submitted')
      .limit(1)
      .maybeSingle();
    if (pendingErr) throw pendingErr;
    if (pending) return res.status(409).json({ error: 'review_already_pending' });
  } catch (e) {
    if (!isMissingTableError(e)) {
      return res.status(500).json({ error: 'Failed to check pending reviews', details: e.message || String(e) });
    }
    // table missing → no pending review possible; fall through to the insert
    // below, which will itself surface review_unavailable.
  }

  const periodEnd = quarterlyPeriodEnd(new Date());
  const nowIso = new Date().toISOString();

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('reviews')
    .insert([{
      client_id: clientId,
      kind: 'quarterly',
      period_end: periodEnd,
      status: 'submitted',
      submitted_by: 'client',
      submitted_at: nowIso,
      payload: { assets: payloadAssets, liabilities: payloadLiabilities, notes },
    }])
    .select('id, status, period_end')
    .maybeSingle();

  if (insertErr) {
    if (isMissingTableError(insertErr)) {
      return res.status(503).json({ error: 'review_unavailable' });
    }
    return res.status(500).json({ error: 'Failed to submit review', details: insertErr.message });
  }

  return res.status(200).json({ success: true, review: inserted });
}

