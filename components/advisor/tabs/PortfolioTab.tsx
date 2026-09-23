import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { fmtRM, safeNumber } from '../utils/finance';
import {
  ASSET_TYPES, assetClassOf, assetTypeLabel, assetTypeMeta, liquidityLevel,
} from '../../../supabase/functions/_shared/taxonomy/balance';
import {
  MODEL_PORTFOLIOS, ALLOCATION_BUCKETS, riskBandFromSuitability,
  currentAllocationRows, driftAgainst, type AllocationBucket,
} from '../../../supabase/functions/_shared/finance/allocation';
import { twr, type Valuation } from '../../../supabase/functions/_shared/finance/valuation';
import {
  buildDonutSlices, buildInvestableAmounts, buildLiquiditySlices, donutBucketColor, donutBucketLabel,
  groupValuationsByAsset, liquidityColor, liquidityLabel, type DonutBucket,
} from '../assets/allocation';
import { isMissingColumnError } from '../assets/degrade';

// P3 决策 1: investment_accounts/portfolio_holdings are now a breakdown that
// hangs off an investment (class C) asset — the asset's current_value is the
// figure that counts toward net worth and the allocation donut, never the
// sum of its holdings snapshots. Spec:
// docs/superpowers/specs/2026-09-26-cfp-p3-assets-portfolio-design.md

const ACCOUNT_TYPES: [string, string][] = [
  ['unit_trust', 'Unit Trust'],
  ['private_mandate', 'Private Mandate'],
  ['prs', 'PRS'],
  ['wrap_account', 'Wrap Account'],
  ['other', 'Other'],
];

const NEW_ASSET_VALUE = '__new__';

const EMPTY_ACCOUNT = {
  asset_id: '',
  new_asset_type: 'unit_trust',
  new_asset_name: '',
  new_asset_value: '',
  account_type: 'unit_trust',
  account_name: '',
  platform: '',
  account_number: '',
  opened_date: '',
  currency: 'MYR',
  notes: '',
};

const EMPTY_HOLDING = {
  snapshot_month: '',
  instrument_code: '',
  instrument_name: '',
  units_held: '',
  nav_per_unit: '',
  market_value: '',
  cost_basis: '',
};

const INVESTMENT_ASSET_TYPES = ASSET_TYPES.filter(a => a.class === 'C' && a.offered);

const DONUT_ORDER: DonutBucket[] = ['equity', 'bond', 'cash', 'alternatives', 'retirement'];
const LIQUIDITY_ORDER: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

const pct1 = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function PortfolioTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const lang: 'zh' | 'en' = language === 'zh' ? 'zh' : 'en';

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [assets, setAssets] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [valuations, setValuations] = useState<any[]>([]);
  const [riskBand, setRiskBand] = useState<{ band: string | null; source: 'suitability' | 'profile' | null }>({ band: null, source: null });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [showAddAccount, setShowAddAccount] = useState<null | { presetAssetId?: string }>(null);
  const [aForm, setAForm] = useState(EMPTY_ACCOUNT);
  const [savingAccount, setSavingAccount] = useState(false);

  const [showAddHolding, setShowAddHolding] = useState<null | string>(null);
  const [hForm, setHForm] = useState(EMPTY_HOLDING);
  const [savingHolding, setSavingHolding] = useState(false);

  const [showNewAsset, setShowNewAsset] = useState(false);
  const [naForm, setNaForm] = useState({ asset_type: 'unit_trust', name: '', current_value: '' });
  const [savingNewAsset, setSavingNewAsset] = useState(false);

  const [reassigning, setReassigning] = useState<Record<string, string>>({});

  const setA = (k: string, v: any) => setAForm(p => ({ ...p, [k]: v }));
  const setH = (k: string, v: any) => setHForm(p => ({ ...p, [k]: v }));

  async function loadRiskBand(): Promise<{ band: string | null; source: 'suitability' | 'profile' | null }> {
    try {
      const { data: sa, error } = await supabase
        .from('suitability_assessments')
        .select('submitted_at, suitability_results(final_profile)')
        .eq('client_id', clientId)
        .in('status', ['submitted', 'reviewed'])
        .order('submitted_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = ((sa as any[]) || [])[0];
      const sr = row ? (Array.isArray(row.suitability_results) ? row.suitability_results[0] : row.suitability_results) : null;
      const band = sr?.final_profile ? riskBandFromSuitability(sr.final_profile) : null;
      if (band) return { band, source: 'suitability' };
    } catch {
      // suitability tables/columns may not be reachable — fall through to clients.risk_profile
    }
    try {
      const { data: cl, error } = await supabase.from('clients').select('risk_profile').eq('id', clientId).maybeSingle();
      if (error) throw error;
      if (cl?.risk_profile) return { band: String(cl.risk_profile), source: 'profile' };
    } catch {
      // ignore — no band available
    }
    return { band: null, source: null };
  }

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const [{ data: as, error: asErr }, { data: acc, error: aErr }, { data: hol, error: hErr }] = await Promise.all([
        supabase.from('assets').select('*').eq('client_id', clientId).order('asset_type'),
        supabase.from('investment_accounts').select('*').eq('client_id', clientId).order('account_name'),
        supabase.from('portfolio_holdings').select('*').eq('client_id', clientId).order('snapshot_month', { ascending: false }),
      ]);
      if (asErr || aErr || hErr) throw (asErr || aErr || hErr);
      setAssets(as || []);
      setAccounts(acc || []);
      setHoldings(hol || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
      setAssets([]);
      setAccounts([]);
      setHoldings([]);
    }
    // asset_valuations may not exist yet in every environment (P3 migration) —
    // degrade to "no history" rather than failing the whole tab.
    try {
      const { data: v, error } = await supabase.from('asset_valuations').select('*').eq('client_id', clientId);
      if (error) throw error;
      setValuations(v || []);
    } catch {
      setValuations([]);
    }
    const rb = await loadRiskBand();
    setRiskBand(rb);
    setLoading(false);
  }

  useEffect(() => { load(); }, [clientId]);

  const investmentAssets = useMemo(
    () => assets.filter(a => assetClassOf(a.asset_type) === 'C'),
    [assets],
  );
  const investmentAssetIds = useMemo(() => new Set(investmentAssets.map(a => a.id)), [investmentAssets]);

  const holdingsByAccount = useMemo(() => {
    const byAcc = new Map<string, any[]>();
    for (const h of holdings) {
      const id = h.account_id || h.investment_account_id;
      if (!id) continue;
      const list = byAcc.get(id) || [];
      list.push(h);
      byAcc.set(id, list);
    }
    return byAcc;
  }, [holdings]);

  const latestSnapshotByAccount = useMemo(() => {
    const res = new Map<string, { month: string | null; rows: any[]; total: number }>();
    for (const a of accounts) {
      const accId = a.id;
      const list = (holdingsByAccount.get(accId) || []).slice();
      list.sort((x: any, y: any) => String(y.snapshot_month || '').localeCompare(String(x.snapshot_month || '')));
      const month = list.length > 0 ? String(list[0].snapshot_month) : null;
      const rows = month ? list.filter((r: any) => String(r.snapshot_month) === month) : [];
      const total = rows.reduce((s: number, r: any) => s + safeNumber(r.market_value), 0);
      res.set(accId, { month, rows, total });
    }
    return res;
  }, [accounts, holdingsByAccount]);

  const accountsByAsset = useMemo(() => {
    const byAsset = new Map<string, any[]>();
    const unassigned: any[] = [];
    for (const a of accounts) {
      if (a.asset_id && investmentAssetIds.has(a.asset_id)) {
        const list = byAsset.get(a.asset_id) || [];
        list.push(a);
        byAsset.set(a.asset_id, list);
      } else {
        unassigned.push(a);
      }
    }
    return { byAsset, unassigned };
  }, [accounts, investmentAssetIds]);

  const valuationsByAsset = useMemo(() => groupValuationsByAsset(valuations), [valuations]);

  const donutSlices = useMemo(() => buildDonutSlices(assets, holdings), [assets, holdings]);
  const donutTotal = donutSlices.reduce((s, d) => s + d.amount, 0);
  const liquiditySlices = useMemo(() => buildLiquiditySlices(assets), [assets]);
  const liquidityTotal = liquiditySlices.reduce((s, d) => s + d.amount, 0);

  const investableAmounts = useMemo(() => buildInvestableAmounts(assets, holdings), [assets, holdings]);
  const allocation = useMemo(() => currentAllocationRows(investableAmounts), [investableAmounts]);
  const model = riskBand.band ? MODEL_PORTFOLIOS[riskBand.band] : null;
  const drift = model ? driftAgainst(model, allocation.rows) : null;

  const totalInvestmentValue = investmentAssets.reduce((s, a) => s + (safeNumber(a.current_value)), 0);

  async function addAccount() {
    if (!aForm.account_name.trim()) { setErr(t('Account name is required.', '请填写账户名称。')); return; }
    if (!aForm.asset_id) { setErr(t('Please choose which asset this account belongs to.', '请选择该账户所属的资产。')); return; }
    setSavingAccount(true);
    setErr('');

    let assetId = aForm.asset_id;
    if (assetId === NEW_ASSET_VALUE) {
      if (!aForm.new_asset_name.trim()) {
        setSavingAccount(false);
        setErr(t('Please name the new asset.', '请填写新资产的名称。'));
        return;
      }
      const { data: newAsset, error: assetErr } = await supabase.from('assets').insert({
        client_id: clientId,
        asset_type: aForm.new_asset_type || 'unit_trust',
        name: aForm.new_asset_name.trim(),
        current_value: aForm.new_asset_value ? safeNumber(aForm.new_asset_value) : 0,
        liquidity: liquidityLevel(aForm.new_asset_type || 'unit_trust'),
        purpose: assetTypeMeta(aForm.new_asset_type)?.default_purpose || 'investment',
      }).select('id').single();
      if (assetErr || !newAsset) {
        setSavingAccount(false);
        setErr(assetErr?.message || 'Failed to create asset');
        return;
      }
      assetId = newAsset.id;
    }

    const payload: any = {
      client_id: clientId,
      asset_id: assetId,
      account_type: aForm.account_type || 'other',
      account_name: aForm.account_name.trim(),
      platform: aForm.platform || null,
      account_number: aForm.account_number || null,
      opened_date: aForm.opened_date || null,
      currency: aForm.currency || 'MYR',
      notes: aForm.notes || null,
      status: 'active',
    };
    let { error } = await supabase.from('investment_accounts').insert(payload);
    if (error && isMissingColumnError(error)) {
      // investment_accounts.asset_id hasn't been migrated in this environment
      // yet — save the account anyway rather than blocking the advisor.
      const { asset_id, ...withoutAssetId } = payload;
      ({ error } = await supabase.from('investment_accounts').insert(withoutAssetId));
    }
    setSavingAccount(false);
    if (error) return setErr(error.message);
    setShowAddAccount(null);
    setAForm(EMPTY_ACCOUNT);
    load();
  }

  async function addHolding(accountId: string) {
    if (!hForm.snapshot_month || !hForm.instrument_name.trim() || !hForm.units_held || !hForm.nav_per_unit) return;
    setSavingHolding(true);
    const units = safeNumber(hForm.units_held);
    const nav = safeNumber(hForm.nav_per_unit);
    const mvAuto = units * nav;
    const payload: any = {
      client_id: clientId,
      account_id: accountId,
      snapshot_month: `${hForm.snapshot_month}-01`,
      instrument_code: hForm.instrument_code || null,
      instrument_name: hForm.instrument_name.trim(),
      units_held: units,
      nav_per_unit: nav,
      market_value: hForm.market_value ? safeNumber(hForm.market_value) : mvAuto,
      cost_basis: hForm.cost_basis ? safeNumber(hForm.cost_basis) : null,
    };
    const { error } = await supabase.from('portfolio_holdings').insert(payload);
    setSavingHolding(false);
    if (error) return setErr(error.message);
    setShowAddHolding(null);
    setHForm(EMPTY_HOLDING);
    load();
  }

  async function addNewAsset() {
    if (!naForm.name.trim()) return;
    setSavingNewAsset(true);
    const { error } = await supabase.from('assets').insert({
      client_id: clientId,
      asset_type: naForm.asset_type || 'unit_trust',
      name: naForm.name.trim(),
      current_value: naForm.current_value ? safeNumber(naForm.current_value) : 0,
      liquidity: liquidityLevel(naForm.asset_type || 'unit_trust'),
      purpose: assetTypeMeta(naForm.asset_type)?.default_purpose || 'investment',
    });
    setSavingNewAsset(false);
    if (error) return setErr(error.message);
    setShowNewAsset(false);
    setNaForm({ asset_type: 'unit_trust', name: '', current_value: '' });
    load();
  }

  async function reassignAccount(accountId: string) {
    const assetId = reassigning[accountId];
    if (!assetId) return;
    const { error } = await supabase.from('investment_accounts').update({ asset_id: assetId }).eq('id', accountId);
    if (error) { setErr(error.message); return; }
    setReassigning(p => { const n = { ...p }; delete n[accountId]; return n; });
    load();
  }

  const fmtMonth = (m: string | null) => {
    if (!m) return '—';
    const d = new Date(String(m));
    return d.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-MY', { year: 'numeric', month: 'short' });
  };

  if (loading) return <Loader />;

  return (
    <div>
      {err ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm mb-4 flex items-center justify-between gap-3">
          <span>{err}</span>
          <button onClick={() => setErr('')} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <SumCard label={t('Total Investment Value', '投资资产总值')} value={`RM ${fmtRM(totalInvestmentValue)}`} color="text-xin-blue" bg="bg-blue-50" />
        <SumCard label={t('Active Accounts', '活跃账户')} value={String(accounts.filter(a => !a.status || String(a.status).toLowerCase() === 'active').length)} color="text-emerald-600" bg="bg-emerald-50" />
        <SumCard
          label={t('Risk Band Source', '风险等级来源')}
          value={riskBand.band ? riskBand.band : t('Not set', '未设置')}
          color="text-slate-600"
          bg="bg-slate-50"
        />
      </div>

      {/* ── 配置 (allocation donut) ── */}
      <Section title={t('Allocation', '资产配置')}>
        {donutTotal <= 0 ? (
          <EmptyHint text={t('No investment, retirement or cash assets yet.', '还没有投资、退休或现金资产。')} />
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-full md:w-56 h-56 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutSlices.filter(d => d.amount > 0)} dataKey="amount" nameKey="bucket" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {donutSlices.filter(d => d.amount > 0).map(d => (
                      <Cell key={d.bucket} fill={donutBucketColor(d.bucket)} />
                    ))}
                  </Pie>
                  <RTooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: 14, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, name: string) => [`RM ${fmtRM(value)}`, donutBucketLabel(name as DonutBucket, lang)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full space-y-2">
              {DONUT_ORDER.map(bucket => {
                const slice = donutSlices.find(d => d.bucket === bucket);
                const amount = slice?.amount || 0;
                const share = donutTotal > 0 ? amount / donutTotal : 0;
                return (
                  <div key={bucket} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: donutBucketColor(bucket) }} />
                    <span className="text-xs text-slate-500 w-20 shrink-0">{donutBucketLabel(bucket, lang)}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: donutBucketColor(bucket) }} />
                    </div>
                    <span className="text-xs font-semibold text-xin-blue w-28 text-right shrink-0">RM {fmtRM(amount)} · {pct1(share)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* ── 流动性分布 (liquidity bar) ── */}
      <Section title={t('Liquidity', '流动性分布')}>
        {liquidityTotal <= 0 ? (
          <EmptyHint text={t('No investment, retirement or cash assets yet.', '还没有投资、退休或现金资产。')} />
        ) : (
          <div className="space-y-2.5">
            {LIQUIDITY_ORDER.map(level => {
              const slice = liquiditySlices.find(l => l.level === level);
              const amount = slice?.amount || 0;
              const share = liquidityTotal > 0 ? amount / liquidityTotal : 0;
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-28 shrink-0">{liquidityLabel(level, lang)}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: liquidityColor(level) }} />
                  </div>
                  <span className="text-xs font-semibold text-xin-blue w-28 text-right shrink-0">RM {fmtRM(amount)} · {pct1(share)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── 目标配置 vs 实际 (drift) ── */}
      <Section
        title={t('Target vs Actual Allocation', '目标配置 vs 实际配置')}
        badge={riskBand.band ? (
          <span className="text-[11px] font-medium text-slate-400">
            {riskBand.source === 'suitability' ? t('Source: suitability assessment', '来源：风险评估问卷') : t("Source: client's risk profile", '来源：客户资料风险等级')}
          </span>
        ) : null}
      >
        {!drift ? (
          <EmptyHint text={t('No risk band set for this client yet — complete a suitability assessment or set their risk profile.', '还未设置该客户的风险等级 — 请完成风险评估问卷或在客户资料中设置风险等级。')} />
        ) : (
          <div className="space-y-3">
            {drift.drift.map(d => {
              const cur = d.current_pct ?? 0;
              const over = (d.drift_pp ?? 0) > 0;
              return (
                <div key={d.bucket}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">{donutBucketLabel(d.bucket as DonutBucket, lang)}</span>
                    <span className="font-semibold text-xin-blue">
                      {d.current_pct != null ? `${d.current_pct}%` : '—'} / {t('target', '目标')} {d.target_pct}%
                      {d.drift_pp != null && Math.abs(d.drift_pp) > 5 && (
                        <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${over ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                          {over ? t('Over', '超配') : t('Under', '低配')} {Math.abs(d.drift_pp).toFixed(1)}pp
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-xin-blue/70" style={{ width: `${Math.min(cur, 100)}%` }} />
                    <div className="absolute top-0 h-full w-0.5 bg-xin-gold" style={{ left: `${Math.min(d.target_pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── 每项投资资产 ── */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <h3 className="font-semibold text-xin-blue">{t('Investment Assets', '投资资产')}</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewAsset(true)} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
            <Plus size={14} />{t('New Asset', '新建资产')}
          </button>
          <button onClick={() => { setAForm(EMPTY_ACCOUNT); setShowAddAccount({}); }} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-xin-blue text-white rounded-xl hover:bg-xin-blueLight transition-colors">
            <Plus size={14} />{t('Add Account', '添加账户')}
          </button>
        </div>
      </div>

      {investmentAssets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm shadow-sm">
          {t('No investment assets yet. Click "+ New Asset" to create one.', '还没有投资资产，点击「新建资产」创建。')}
        </div>
      ) : (
        <div className="space-y-3">
          {investmentAssets.map(asset => {
            const assetValuations = valuationsByAsset.get(asset.id) || [];
            const twrResult = twr(assetValuations);
            const chartData = assetValuations.map(v => ({ date: v.valuation_date, value: v.value }));
            const assetAccounts = accountsByAsset.byAsset.get(asset.id) || [];
            const open = !!expanded[asset.id];

            return (
              <div key={asset.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(p => ({ ...p, [asset.id]: !p[asset.id] }))}
                  className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xin-blue truncate">{asset.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {assetTypeLabel(asset.asset_type, lang)}
                      {twrResult && (
                        <span className={`ml-2 font-semibold ${(twrResult.annualised ?? twrResult.twr) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {t('TWR', 'TWR')} {pct1(twrResult.annualised ?? twrResult.twr)}{twrResult.annualised != null ? t(' p.a.', '/年') : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-xin-blue">RM {fmtRM(safeNumber(asset.current_value))}</div>
                    <div className="text-[11px] text-slate-400">{assetAccounts.length} {t('account(s)', '个账户')}</div>
                  </div>
                  <div className="text-slate-300">{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
                </button>

                {open && (
                  <div className="px-5 pb-5">
                    {chartData.length >= 2 && (
                      <div className="h-40 mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={fmtMonth} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} width={60} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                            <RTooltip
                              contentStyle={{ backgroundColor: '#fff', borderRadius: 14, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                              formatter={(value: number) => [`RM ${fmtRM(value)}`, t('Value', '市值')]}
                              labelFormatter={fmtMonth}
                            />
                            <Line type="monotone" dataKey="value" stroke="#d8c195" strokeWidth={2.5} dot={{ fill: '#d8c195', r: 3 }} activeDot={{ r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {chartData.length < 2 && (
                      <div className="bg-slate-50 rounded-xl p-4 mb-4 text-center text-slate-400 text-xs">
                        {t('Not enough valuation history to chart yet.', '估值历史不足，暂无法绘制曲线。')}
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t('Accounts', '账户')}</div>
                      <button
                        onClick={() => { setAForm({ ...EMPTY_ACCOUNT, asset_id: asset.id }); setShowAddAccount({ presetAssetId: asset.id }); }}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600"
                      >
                        <Plus size={12} />{t('Add Account', '添加账户')}
                      </button>
                    </div>

                    {assetAccounts.length === 0 ? (
                      <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-400 text-xs">
                        {t('No accounts linked to this asset yet.', '还没有账户关联到此资产。')}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {assetAccounts.map(a => {
                          const info = latestSnapshotByAccount.get(a.id);
                          const status = String(a.status || 'active').toLowerCase();
                          return (
                            <div key={a.id} className="border border-slate-100 rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/60">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-xin-blue truncate">{a.account_name}</span>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                      {status === 'active' ? t('Active', '活跃') : t('Closed', '关闭')}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400">{a.platform || t('Platform not set', '未填写平台')}{a.account_type ? ` · ${a.account_type}` : ''}</div>
                                </div>
                                <button
                                  onClick={() => { setShowAddHolding(a.id); setHForm(p => ({ ...p, snapshot_month: new Date().toISOString().slice(0, 7) })); }}
                                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 shrink-0"
                                >
                                  <Plus size={11} />{t('Add Snapshot', '新增快照')}
                                </button>
                              </div>
                              {info?.rows && info.rows.length > 0 ? (
                                <div className="text-xs">
                                  <div className="grid grid-cols-[1.6fr_0.9fr_0.9fr_1fr] bg-white text-[10px] font-semibold text-slate-400 px-4 py-1.5 border-b border-slate-50">
                                    <div>{t('Fund / Instrument', '基金/标的')}</div>
                                    <div>{t('Units', '份额')}</div>
                                    <div>{t('NAV', '净值')}</div>
                                    <div>{t('Value', '市值')}</div>
                                  </div>
                                  {info.rows.map((h: any, idx: number) => (
                                    <div key={h.id || idx} className="grid grid-cols-[1.6fr_0.9fr_0.9fr_1fr] px-4 py-2 border-b border-slate-50 last:border-0">
                                      <div className="font-medium text-xin-blue truncate">{h.instrument_name || h.instrument_code || '—'}</div>
                                      <div className="text-slate-500">{safeNumber(h.units_held).toLocaleString('en-MY', { maximumFractionDigits: 2 })}</div>
                                      <div className="text-slate-500">RM {safeNumber(h.nav_per_unit).toLocaleString('en-MY', { maximumFractionDigits: 4 })}</div>
                                      <div className="font-semibold text-xin-blue">RM {fmtRM(safeNumber(h.market_value))}</div>
                                    </div>
                                  ))}
                                  <div className="px-4 py-1.5 text-[10px] text-slate-300 italic">{t('Breakdown only — not added to totals.', '仅为明细，不计入合计。')}</div>
                                </div>
                              ) : (
                                <div className="px-4 py-3 text-center text-slate-300 text-[11px]">{t('No holdings snapshots yet.', '还没有持仓快照。')}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 未关联资产的账户 ── */}
      {accountsByAsset.unassigned.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-amber-600 text-sm mb-3">{t('Accounts not linked to an asset', '未关联资产的账户')}</h3>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl divide-y divide-amber-100">
            {accountsByAsset.unassigned.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <div className="text-sm font-semibold text-xin-blue">{a.account_name}</div>
                  <div className="text-[11px] text-slate-400">{a.platform || '—'}</div>
                </div>
                <select
                  value={reassigning[a.id] || ''}
                  onChange={e => setReassigning(p => ({ ...p, [a.id]: e.target.value }))}
                  className="px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs"
                >
                  <option value="">{t('Choose asset…', '选择资产…')}</option>
                  {investmentAssets.map(ia => <option key={ia.id} value={ia.id}>{ia.name}</option>)}
                </select>
                <button
                  onClick={() => reassignAccount(a.id)}
                  disabled={!reassigning[a.id]}
                  className="text-xs font-semibold px-3 py-2 rounded-lg bg-xin-blue text-white disabled:opacity-40"
                >
                  {t('Link', '关联')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: Add Account ── */}
      {showAddAccount && (
        <Modal title={t('Add Investment Account', '添加投资账户')} onClose={() => setShowAddAccount(null)}>
          <Fr label={`${t('Asset', '资产')} *`}>
            <select
              value={aForm.asset_id}
              onChange={e => setA('asset_id', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white"
            >
              <option value="">{t('Select an asset…', '选择资产…')}</option>
              {investmentAssets.map(ia => <option key={ia.id} value={ia.id}>{ia.name}</option>)}
              <option value={NEW_ASSET_VALUE}>+ {t('New asset…', '新建资产…')}</option>
            </select>
          </Fr>
          {aForm.asset_id === NEW_ASSET_VALUE && (
            <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-3">
              <Fr label={t('Asset Type', '资产类型')}>
                <select value={aForm.new_asset_type} onChange={e => setA('new_asset_type', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold">
                  {INVESTMENT_ASSET_TYPES.map(a => <option key={a.code} value={a.code}>{lang === 'zh' ? a.label_zh : a.label_en}</option>)}
                </select>
              </Fr>
              <Fr label={`${t('Asset Name', '资产名称')} *`}>
                <Inp value={aForm.new_asset_name} onChange={v => setA('new_asset_name', v)} placeholder="e.g. iFAST Unit Trust" />
              </Fr>
              <Fr label={t('Current Value (RM)', '当前价值 (RM)')}>
                <Inp type="number" value={aForm.new_asset_value} onChange={v => setA('new_asset_value', v)} placeholder="0.00" />
              </Fr>
            </div>
          )}
          <Fr label={t('Account Type', '账户类型')}>
            <Sel value={aForm.account_type} onChange={v => setA('account_type', v)} opts={ACCOUNT_TYPES} />
          </Fr>
          <Fr label={`${t('Account Name', '账户名称')} *`}>
            <Inp value={aForm.account_name} onChange={v => setA('account_name', v)} placeholder="e.g. iFAST Unit Trust" />
          </Fr>
          <Fr label={t('Platform', '平台')}>
            <Inp value={aForm.platform} onChange={v => setA('platform', v)} placeholder="e.g. iFAST" />
          </Fr>
          <Fr label={t('Account Number', '账号')}>
            <Inp value={aForm.account_number} onChange={v => setA('account_number', v)} />
          </Fr>
          <div className="grid grid-cols-2 gap-3">
            <Fr label={t('Opened Date', '开户日期')}>
              <Inp type="date" value={aForm.opened_date} onChange={v => setA('opened_date', v)} />
            </Fr>
            <Fr label={t('Currency', '币种')}>
              <Inp value={aForm.currency} onChange={v => setA('currency', v)} />
            </Fr>
          </div>
          <Fr label={t('Notes', '备注')}>
            <Inp value={aForm.notes} onChange={v => setA('notes', v)} />
          </Fr>
          <BtnRow onSave={addAccount} onCancel={() => setShowAddAccount(null)} saving={savingAccount} t={t} />
        </Modal>
      )}

      {/* ── Modal: Add Holdings Snapshot ── */}
      {showAddHolding && (
        <Modal title={t('Add Holdings Snapshot', '新增持仓快照')} onClose={() => setShowAddHolding(null)}>
          <Fr label={`${t('Snapshot Month', '月份')} *`}>
            <Inp type="month" value={hForm.snapshot_month} onChange={v => setH('snapshot_month', v)} />
          </Fr>
          <div className="grid grid-cols-2 gap-3">
            <Fr label={t('Instrument Code', '代码')}>
              <Inp value={hForm.instrument_code} onChange={v => setH('instrument_code', v)} />
            </Fr>
            <Fr label={`${t('Instrument Name', '名称')} *`}>
              <Inp value={hForm.instrument_name} onChange={v => setH('instrument_name', v)} />
            </Fr>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fr label={`${t('Units Held', '持有份额')} *`}>
              <Inp type="number" value={hForm.units_held} onChange={v => setH('units_held', v)} placeholder="0" />
            </Fr>
            <Fr label={`${t('NAV per Unit', '每单位净值')} *`}>
              <Inp type="number" value={hForm.nav_per_unit} onChange={v => setH('nav_per_unit', v)} placeholder="0" />
            </Fr>
            <Fr label={t('Market Value (RM)', '市值 (RM)')}>
              <Inp type="number" value={hForm.market_value} onChange={v => setH('market_value', v)} placeholder={t('Auto', '自动')} />
            </Fr>
            <Fr label={t('Cost Basis (RM)', '成本 (RM)')}>
              <Inp type="number" value={hForm.cost_basis} onChange={v => setH('cost_basis', v)} />
            </Fr>
          </div>
          <BtnRow onSave={() => addHolding(showAddHolding)} onCancel={() => setShowAddHolding(null)} saving={savingHolding} t={t} />
        </Modal>
      )}

      {/* ── Modal: New investment asset (standalone) ── */}
      {showNewAsset && (
        <Modal title={t('New Investment Asset', '新建投资资产')} onClose={() => setShowNewAsset(false)}>
          <Fr label={t('Asset Type', '资产类型')}>
            <select value={naForm.asset_type} onChange={e => setNaForm(p => ({ ...p, asset_type: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white">
              {INVESTMENT_ASSET_TYPES.map(a => <option key={a.code} value={a.code}>{lang === 'zh' ? a.label_zh : a.label_en}</option>)}
            </select>
          </Fr>
          <Fr label={`${t('Name', '名称')} *`}>
            <Inp value={naForm.name} onChange={v => setNaForm(p => ({ ...p, name: v }))} placeholder="e.g. Public Mutual Growth Fund" />
          </Fr>
          <Fr label={t('Current Value (RM)', '当前价值 (RM)')}>
            <Inp type="number" value={naForm.current_value} onChange={v => setNaForm(p => ({ ...p, current_value: v }))} placeholder="0.00" />
          </Fr>
          <BtnRow onSave={addNewAsset} onCancel={() => setShowNewAsset(false)} saving={savingNewAsset} t={t} />
        </Modal>
      )}
    </div>
  );
}

const Section = ({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-xin-blue text-sm">{title}</h3>
      {badge}
    </div>
    {children}
  </div>
);
const EmptyHint = ({ text }: { text: string }) => <div className="text-center text-slate-400 text-xs py-6">{text}</div>;
const SumCard = ({ label, value, color, bg }: any) => <div className={`${bg} rounded-2xl p-4`}><div className="text-xs text-slate-500 font-medium mb-1">{label}</div><div className={`text-xl font-bold ${color}`}>{value}</div></div>;
const Modal = ({ title, onClose, children }: any) => (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-xin-blue">{title}</h3>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-500"><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
);
const Fr = ({ label, children }: any) => <div className="mb-3"><label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>{children}</div>;
const Inp = ({ value, onChange, type = 'text', placeholder }: {
  value: string; onChange: (value: string) => void; type?: string; placeholder?: string;
}) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold" />
);
const Sel = ({ value, onChange, opts }: {
  value: string; onChange: (value: string) => void; opts: Array<[string, string]>;
}) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white">
    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>
);
const BtnRow = ({ onSave, onCancel, saving, t }: any) => (
  <div className="flex gap-2 mt-2">
    <button onClick={onSave} disabled={saving} className="px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm disabled:opacity-50">{saving ? '...' : t('Save', '保存')}</button>
    <button onClick={onCancel} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">{t('Cancel', '取消')}</button>
  </div>
);
const Loader = () => <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" /></div>;
