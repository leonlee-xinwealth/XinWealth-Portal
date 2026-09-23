// api/portfolios.js
//
// P3 决策 1/2/4 (spec docs/superpowers/specs/2026-09-26-cfp-p3-assets-portfolio-design.md):
// `assets` is now the single source of truth for a client's investments —
// each investment asset (class C, plus PRS which is class B) carries its own
// `asset_valuations` history, shaped below EXACTLY like the legacy
// `portfolios`/`portfolio_history` rows (`{snapshot_date, end_value,
// cashflow}`) so services/apiService.ts's TWR/CAGR/XIRR helpers
// (computePortfolioMetrics) work unchanged on either source.
//
// An investment asset with no valuation rows yet (asset_valuations may not
// exist in every environment, or the row predates the migration) falls back
// to its own legacy `portfolios`/`portfolio_history` row when one exists, so
// nothing goes blank between "code deployed" and "migration run" (决策 1's
// backfill note). Once an asset has history, its legacy counterpart (if any,
// found via metadata.migrated_from_portfolio) is dropped so the same
// investment never appears twice.
import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';
import { assetClassOf } from './_lib/taxonomy.mjs';

async function fetchAssetValuationsGraceful(assetIds) {
  if (!assetIds.length) return [];
  try {
    const { data, error } = await supabaseAdmin
      .from('asset_valuations')
      .select('asset_id, valuation_date, value, net_contribution')
      .in('asset_id', assetIds);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

const isInvestmentAsset = (a) => assetClassOf(a.asset_type) === 'C' || a.asset_type === 'prs';

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
  if (!clientRow?.id) return res.status(200).json({ portfolios: [] });

  const [{ data: assets, error: assetsErr }, { data: legacyPortfolios, error: portErr }] = await Promise.all([
    supabaseAdmin.from('assets').select('*').eq('client_id', clientRow.id),
    supabaseAdmin
      .from('portfolios')
      .select(`
        id,
        name,
        currency,
        capital_injection,
        injection_date,
        portfolio_history (
          snapshot_date,
          end_value,
          cashflow
        )
      `)
      .eq('client_id', clientRow.id)
      .order('injection_date', { ascending: true })
      .order('snapshot_date', { referencedTable: 'portfolio_history', ascending: true }),
  ]);

  if (assetsErr) return res.status(500).json({ error: 'Failed to fetch assets', details: assetsErr.message });
  if (portErr) return res.status(500).json({ error: 'Failed to fetch portfolios', details: portErr.message });

  const investmentAssets = (assets || []).filter(isInvestmentAsset);
  const assetValuations = await fetchAssetValuationsGraceful(investmentAssets.map((a) => a.id));

  const valuationsByAsset = new Map();
  for (const v of assetValuations) {
    const list = valuationsByAsset.get(v.asset_id) || [];
    list.push(v);
    valuationsByAsset.set(v.asset_id, list);
  }

  const fromAssets = investmentAssets
    .map((a) => {
      const history = (valuationsByAsset.get(a.id) || [])
        .slice()
        .sort((x, y) => new Date(x.valuation_date).getTime() - new Date(y.valuation_date).getTime())
        .map((v) => ({
          snapshot_date: v.valuation_date,
          end_value: Number(v.value) || 0,
          cashflow: Number(v.net_contribution) || 0,
        }));
      return {
        id: a.id,
        name: a.name || '',
        asset_type: a.asset_type,
        currency: a.currency || 'MYR',
        capital_injection: a.cost_value != null ? Number(a.cost_value) : 0,
        injection_date: a.acquired_at || a.created_at,
        portfolio_history: history,
        source: 'asset',
      };
    })
    // No valuation history yet (asset_valuations missing/empty in this
    // environment, or the auto-valuation trigger hasn't fired) — fall back to
    // this asset's legacy portfolio row below instead of showing an empty chart.
    .filter((p) => p.portfolio_history.length > 0);

  const assetsWithHistory = new Set(fromAssets.map((p) => p.id));
  const migratedFromPortfolioId = new Map(
    investmentAssets
      .filter((a) => a?.metadata && typeof a.metadata === 'object' && a.metadata.migrated_from_portfolio)
      .map((a) => [a.metadata.migrated_from_portfolio, a.id]),
  );

  const fromLegacy = (legacyPortfolios || [])
    // Skip a legacy row once its migrated asset has its own valuation history
    // above — otherwise the same investment would appear twice.
    .filter((p) => {
      const migratedAssetId = migratedFromPortfolioId.get(p.id);
      return !migratedAssetId || !assetsWithHistory.has(migratedAssetId);
    })
    .map((p) => ({
      ...p,
      portfolio_history: (p.portfolio_history || []).sort(
        (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
      ),
      source: 'legacy',
    }));

  return res.status(200).json({ portfolios: [...fromAssets, ...fromLegacy] });
}
