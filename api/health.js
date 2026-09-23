import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';
import { assetCategory, cashflowLabel } from './_lib/portalLabels.js';
import {
  MODEL_PORTFOLIOS, allocationOf, assessAssets, buildCfpCnaInput, categoryLabel, computeCna, computeSnapshot,
  currentAllocationRows, driftAgainst, isLiquid, isTransferCategory, riskBandFromSuitability,
} from './_lib/taxonomy.mjs';
import {
  MONTH_NAMES, buildCurrentPlan, buildDerivedExpenseRecords, isSupersededOutflow, latestMonthYear,
  legacyHoldings,
} from './_lib/portalDerived.js';
import { computeReviewStatus } from './_lib/reviewDates.js';

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

/**
 * P3 决策 2: `asset_valuations` may not exist yet in every environment (the
 * migration ships separately from this code) — every read degrades to an
 * empty array instead of failing the whole /api/health response.
 */
async function fetchAssetValuationsGraceful(clientId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('asset_valuations')
      .select('asset_id, valuation_date, value, net_contribution')
      .eq('client_id', clientId);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

/**
 * P4 决策 (reviews table may not exist yet in every environment): the
 * client-home due/pending banner (决策 6) only needs kind/status/period_end/
 * approved_at/submitted_at — degrades to [] on any error (missing table or
 * otherwise) rather than failing the whole /api/health response.
 */
async function fetchReviewsGraceful(clientId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('kind, status, period_end, approved_at, submitted_at')
      .eq('client_id', clientId);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

/**
 * Latest Investor Suitability Assessment result for this client (决策 4:
 * suitability's risk band, mapped via riskBandFromSuitability, wins over
 * clients.risk_profile when present). Degrades to null on any error — the
 * caller falls back to clients.risk_profile, never a 500.
 */
async function fetchLatestSuitabilityGraceful(clientId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('suitability_results')
      .select('final_profile, created_at, suitability_assessments!inner(client_id)')
      .eq('suitability_assessments.client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

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
    .select('id, has_epf, date_of_birth, risk_profile, number_of_dependants, onboarded_at, created_at')
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
      insurance: [],
      insurances: [],
      snapshots: [],
      current: null,
      asset_quality: { assets: [], by_quadrant: {} },
      portfolio: null,
      snapshot: null,
      insurance_gap: null,
      review_status: { last_approved_at: null, pending: false, due: false }
    });
  }

  const clientId = clientRow.id;

  const [
    { data: assets, error: assetsErr },
    { data: liabilities, error: liabilitiesErr },
    { data: cashflows, error: cashflowErr },
    { data: insurances, error: insuranceErr },
    { data: snapshots, error: snapshotsErr },
    { data: holdings, error: holdingsErr },
    { data: items, error: itemsErr },
    { data: investmentAccounts, error: investmentAccountsErr },
    assetValuations,
    latestSuitability,
    reviews
  ] = await Promise.all([
    supabaseAdmin.from('assets').select('*').eq('client_id', clientId),
    supabaseAdmin.from('liabilities').select('*').eq('client_id', clientId),
    supabaseAdmin.from('cashflow_entries').select('*').eq('client_id', clientId),
    // P5 决策 1/2: riders feed the CI/medical/PA aggregation and status/
    // is_group_employer/covers_liability_id feed the in-force + MRTA/团保
    // logic buildCfpCnaInput needs — same join InsuranceGapPanel.tsx uses.
    supabaseAdmin.from('insurance_policies').select('*, policy_riders(category, sum_assured, room_board_daily, annual_limit, lifetime_limit)').eq('client_id', clientId),
    supabaseAdmin.from('health_snapshots').select('*').eq('client_id', clientId),
    supabaseAdmin.from('portfolio_holdings').select('*').eq('client_id', clientId),
    // Standing items (P2b 常设项目) — when present, they're what "current"
    // ratios/position are read from below, not the latest recorded month.
    supabaseAdmin.from('cashflow_items').select('*').eq('client_id', clientId),
    // P3 决策 1: id/asset_id feed legacyHoldings below — whether an account's
    // value already lives on an asset.
    supabaseAdmin.from('investment_accounts').select('id, asset_id').eq('client_id', clientId),
    // P3 决策 2: asset_valuations may not exist yet in every environment —
    // degrade to [] instead of a 500 (never blocks the rest of the response).
    fetchAssetValuationsGraceful(clientId),
    fetchLatestSuitabilityGraceful(clientId),
    fetchReviewsGraceful(clientId)
  ]);

  if (assetsErr) return res.status(500).json({ error: 'Failed to fetch assets', details: assetsErr.message });
  if (liabilitiesErr) return res.status(500).json({ error: 'Failed to fetch liabilities', details: liabilitiesErr.message });
  if (cashflowErr) return res.status(500).json({ error: 'Failed to fetch cashflow', details: cashflowErr.message });
  if (insuranceErr) return res.status(500).json({ error: 'Failed to fetch insurance', details: insuranceErr.message });
  if (snapshotsErr) return res.status(500).json({ error: 'Failed to fetch snapshots', details: snapshotsErr.message });
  if (holdingsErr) return res.status(500).json({ error: 'Failed to fetch holdings', details: holdingsErr.message });
  if (itemsErr) return res.status(500).json({ error: 'Failed to fetch cashflow items', details: itemsErr.message });
  if (investmentAccountsErr) return res.status(500).json({ error: 'Failed to fetch investment accounts', details: investmentAccountsErr.message });

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

  // P3 决策 1: `assets` is the single source of truth for net worth/investment
  // totals. An investment_accounts row with asset_id set has already been
  // folded into `assets` (its value now lives on that asset, created by the
  // investment-consolidation backfill with metadata.is_investment=true, which
  // investmentAssetRecords below already counts) — summing its
  // portfolio_holdings on top here would double-count it. A holding whose
  // account isn't migrated yet (no asset_id, or no matching account at all)
  // is "legacy" and still counts, exactly as before, so figures don't drop
  // before the migration runs and don't double-count once it has.
  const investmentHoldings = legacyHoldings(holdings, investmentAccounts);

  const holdingsByMonth = new Map();
  for (const h of investmentHoldings) {
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

  // P5 决策 2/4: status/is_group_employer/nomination_type ride along so the
  // client portal can render a status chip and a 「团保 · 离职即失效」 tag
  // per policy (Insurance.tsx) — additive fields, the four original ones stay
  // exactly as before for any existing reader.
  const insuranceRecords = (insurances || []).map((p) =>
    record(p.id, {
      'Insurer': p.provider || '',
      'Plan Name': p.policy_type || '',
      'Policy Number': p.policy_number || '',
      'Sum Assured': p.sum_assured != null ? Number(p.sum_assured) : 0,
      'Premium': p.premium != null ? Number(p.premium) : 0,
      'Status': p.status || 'in_force',
      'Is Group Employer': p.is_group_employer === true,
      'Nomination Type': p.nomination_type || null,
      'Cash Value': p.cash_value != null ? Number(p.cash_value) : null,
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

  // Current ratios/position read from the plan (决策 1: cashflow_items when
  // the client has any, otherwise the averaged actuals) — the month-by-month
  // history above (incomes/expenses) intentionally stays on cashflow_entries.
  const current = buildCurrentPlan({
    rows: cashflows || [],
    liabilities: liabilities || [],
    policies: insurances || [],
    items: items || [],
    client: { has_epf: clientRow.has_epf, date_of_birth: clientRow.date_of_birth },
  });

  // P3 决策 3: per-asset 2×2 — net monthly cash flow (linked standing items
  // minus linked liabilities' estimated installments) × annualised value
  // change (asset_valuations history, or a vehicle's default depreciation).
  const assetsForQuality = (assets || []).map((a) => ({
    id: a.id, asset_type: a.asset_type, current_value: a.current_value,
  }));
  const assetQuality = assessAssets(
    assetsForQuality,
    { items: items || [], liabilities: liabilities || [], valuations: assetValuations },
    new Date(),
  );

  // P3 决策 4: portfolio allocation vs the model portfolio for the client's
  // risk band — latest suitability result wins over clients.risk_profile
  // (决策 4), reported so the UI can show which one it is.
  const cash = (assets || [])
    .filter((a) => isLiquid(a.asset_type))
    .reduce((s, a) => s + (Number(a.current_value) || 0), 0);
  const allocationAmounts = allocationOf(assets || [], investmentHoldings, cash);
  const { investable_total: investableTotal, rows: currentAllocation } = currentAllocationRows(allocationAmounts);
  const suitabilityBand = riskBandFromSuitability(latestSuitability?.final_profile);
  const rawBand = suitabilityBand || clientRow.risk_profile || null;
  // Same fallback as cfp-brain's modules/investment/calc.ts: an unrecognized
  // or missing band still gets a target line to compare against, "balanced",
  // flagged via risk_band_defaulted rather than left with no target at all.
  const riskBandDefaulted = !rawBand || !MODEL_PORTFOLIOS[rawBand];
  const riskBand = !riskBandDefaulted ? rawBand : 'balanced';
  const riskBandSource = suitabilityBand ? 'suitability' : (clientRow.risk_profile ? 'profile' : null);
  const { target_allocation: targetAllocation, drift, rebalancing_actions: rebalancingActions } =
    driftAgainst(MODEL_PORTFOLIOS[riskBand], currentAllocation);
  const portfolio = {
    risk_band: riskBand,
    risk_band_defaulted: riskBandDefaulted,
    risk_band_source: riskBandSource,
    investable_total: investableTotal,
    current_allocation: currentAllocation,
    target_allocation: targetAllocation,
    drift,
    rebalancing_actions: rebalancingActions,
  };

  // P4 决策 3: the ONE health-snapshot formula — HealthScoreCard.tsx,
  // api/health.js and cfp-brain/baseline.ts all read computeSnapshot now,
  // replacing the ad-hoc ratio math services/apiService.ts used to do itself.
  // `raw_metrics` carries the same liquid/invest/EPF totals apiService.ts's
  // `raw` object used to sum by hand.
  const clientStatutoryInfo = { has_epf: clientRow.has_epf, date_of_birth: clientRow.date_of_birth };
  const snapshot = computeSnapshot({
    assets: assets || [],
    liabilities: liabilities || [],
    items: items || [],
    rows: cashflows || [],
    policies: insurances || [],
    client: clientStatutoryInfo,
    asOf: new Date(),
  });

  // P5 决策 1: the ONE coverage-gap formula — advisor panel, client portal and
  // both PDF exporters all read buildCfpCnaInput/computeCna's output now.
  // Shape mirrors components/advisor/components/InsuranceGapPanel.tsx's
  // toCfpFinancials so the two surfaces read the live rows identically.
  const cnaFinancials = {
    client: {
      id: clientId,
      date_of_birth: clientRow.date_of_birth ?? null,
      number_of_dependants: clientRow.number_of_dependants ?? 0,
      occupation: null,
      retirement_age: null,
      marital_status: null,
    },
    inflows: (cashflows || [])
      .filter((r) => r.direction === 'inflow')
      .map((r) => ({ amount: Number(r.amount) || 0, frequency: r.frequency, category: r.category || '' })),
    liabilities: (liabilities || []).map((l) => ({
      id: l.id ?? null,
      liability_type: l.liability_type,
      name: l.name ?? '',
      outstanding_balance: Number(l.outstanding_balance) || 0,
      monthly_payment: l.monthly_payment != null ? Number(l.monthly_payment) : null,
    })),
    assets: (assets || []).map((a) => ({
      asset_type: a.asset_type,
      current_value: Number(a.current_value) || 0,
    })),
    policies: (insurances || []).map((p) => ({
      policy_type: p.policy_type,
      provider: p.provider ?? null,
      sum_assured: p.sum_assured != null ? Number(p.sum_assured) : null,
      premium: p.premium != null ? Number(p.premium) : null,
      premium_frequency: p.premium_frequency ?? null,
      policy_number: p.policy_number ?? null,
      cash_value: p.cash_value != null ? Number(p.cash_value) : null,
      start_date: p.start_date ?? null,
      end_date: p.end_date ?? null,
      status: p.status ?? null,
      is_group_employer: p.is_group_employer ?? null,
      covers_liability_id: p.covers_liability_id ?? null,
      nomination_type: p.nomination_type ?? null,
      policy_riders: (p.policy_riders || []).map((r) => ({
        category: r.category,
        sum_assured: r.sum_assured != null ? Number(r.sum_assured) : null,
        room_board_daily: r.room_board_daily != null ? Number(r.room_board_daily) : null,
        annual_limit: r.annual_limit != null ? Number(r.annual_limit) : null,
        lifetime_limit: r.lifetime_limit != null ? Number(r.lifetime_limit) : null,
      })),
    })),
  };
  // The plan's income (决策 1 — items when present, else averaged actuals)
  // wins over mapping.ts's own row-by-row annualizeInflows fallback, which is
  // wrong for cashflow_entries actuals (see mapping.ts's annualizeInflows doc).
  const cnaInput = buildCfpCnaInput(cnaFinancials, { annual_income: current.annual_income });
  const insuranceGap = computeCna(cnaInput);

  // P4 决策 6: client-home due/pending banner — degrades to "no reviews" when
  // the `reviews` table isn't there yet (fetchReviewsGraceful → []), in which
  // case `due` falls back to the client's onboarding date.
  const reviewStatus = computeReviewStatus({
    reviews: reviews || [],
    onboardedAt: clientRow.onboarded_at || clientRow.created_at || null,
    asOf: new Date(),
  });

  return res.status(200).json({
    assets: assetRecords,
    liabilities: liabilityRecords,
    incomes: incomeRecords,
    expenses: [...expenseRecords, ...derivedExpenseRecords],
    investments: [...investmentRecords, ...investmentAssetRecords],
    // P5 决策 4: `insurance` is the correct key (the client portal used to
    // read `insurance` while this endpoint only ever sent `insurances`,
    // which meant the page always saw an empty list) — `insurances` stays as
    // an alias so no other reader breaks.
    insurance: insuranceRecords,
    insurances: insuranceRecords,
    snapshots: snapshotRecords,
    current,
    asset_quality: assetQuality,
    portfolio,
    snapshot,
    insurance_gap: insuranceGap,
    review_status: reviewStatus,
  });
}
