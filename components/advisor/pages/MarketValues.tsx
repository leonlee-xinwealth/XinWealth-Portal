import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { assetClassOf, assetTypeLabel } from '../../../supabase/functions/_shared/taxonomy/balance';

// P3 决策 2/3: monthly market values are now recorded per investment ASSET
// (writing asset_valuations, which also keeps assets.current_value in sync)
// rather than per legacy `portfolios` row. The old portfolios/portfolio_history
// UI stays visible below, read-only, until the data migration
// (20260926000003_investment_consolidation_backfill.sql) has run in this
// environment and nothing still points at it.
// Spec: docs/superpowers/specs/2026-09-26-cfp-p3-assets-portfolio-design.md

// ── Types ──────────────────────────────────────────────────────────────────
interface Client { id: string; full_name: string; }

interface AssetRow {
  id: string;
  name: string;
  asset_type: string;
  current_value: number | null;
  valuation_date: string | null;
}

interface AssetValuationRow {
  id: string;
  valuation_date: string;  // "YYYY-MM-DD"
  value: number;
  net_contribution: number;
  source: string;
}

interface PortfolioRow {
  id: string;
  name: string;
  currency: string;
  capital_injection: number;
  injection_date: string;    // "YYYY-MM-DD"
  last_date: string | null;
  last_value: number | null;
}

interface HistoryRow {
  id: string;
  snapshot_date: string;     // "YYYY-MM-DD"
  end_value: number;
  cashflow: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
/** Returns "YYYY-MM-DD" for the last day of the given "YYYY-MM" month string */
function lastDayOf(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).toISOString().split('T')[0];
}
/** "2026-05-31" → "2026-05" */
function toYearMonth(dateStr: string): string { return dateStr.slice(0, 7); }
/** "2026-05-31" → "May 2026" */
function fmtMonth(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-MY', { month: 'short', year: 'numeric' });
}
/** 16435.08 → "16,435.08" */
function fmtNumber(n: number): string {
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** Green if last_date >= start of previous calendar month */
function isGreenStatus(lastDate: string | null): boolean {
  if (!lastDate) return false;
  const today = new Date();
  const threshold = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return new Date(lastDate) >= threshold;
}
/** Returns the next "YYYY-MM" month after lastDate, or current month if no lastDate */
function nextMonthAfter(lastDate: string | null): string {
  if (!lastDate) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const d = new Date(lastDate + 'T00:00:00');
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function MarketValues() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const lang: 'zh' | 'en' = language === 'zh' ? 'zh' : 'en';

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);

  // ── Asset valuations (P3 — the live entry point) ──
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [assetValuations, setAssetValuations] = useState<Record<string, AssetValuationRow[]>>({});
  const [loadingValuationIds, setLoadingValuationIds] = useState<Set<string>>(new Set());
  const [deletingValuationId, setDeletingValuationId] = useState<string | null>(null);
  const [valuationModal, setValuationModal] = useState<{ asset: AssetRow; editRow?: AssetValuationRow } | null>(null);

  // ── Legacy portfolios (read-only) ──
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);
  const [expandedPortId, setExpandedPortId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryRow[]>>({});
  const [loadingHistoryIds, setLoadingHistoryIds] = useState<Set<string>>(new Set());
  const [showLegacy, setShowLegacy] = useState(false);

  const selectedClientIdRef = React.useRef<string | null>(null);

  // ── Load advisor + clients on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv) { setLoadingClients(false); return; }
      const { data: cls } = await supabase
        .from('clients').select('id, full_name').eq('advisor_id', adv.id).order('full_name');
      setClients(cls || []);
      setLoadingClients(false);
    }
    load();
  }, []);

  // ── Keep ref in sync with selectedClientId
  useEffect(() => {
    selectedClientIdRef.current = selectedClientId;
  }, [selectedClientId]);

  // ── Load assets + legacy portfolios when client changes
  useEffect(() => {
    if (!selectedClientId) { setAssets([]); setPortfolios([]); return; }
    loadAssetsForClient(selectedClientId);
    loadPortfoliosForClient(selectedClientId);
  }, [selectedClientId]);

  async function loadAssetsForClient(clientId: string) {
    setLoadingAssets(true);
    setExpandedAssetId(null);
    const { data } = await supabase
      .from('assets')
      .select('id, name, asset_type, current_value, valuation_date')
      .eq('client_id', clientId)
      .order('name');
    const investmentAssets = (data || []).filter((a: any) => assetClassOf(a.asset_type) === 'C');
    setAssets(investmentAssets);
    setLoadingAssets(false);
  }

  async function reloadAssets() {
    const cid = selectedClientIdRef.current;
    if (cid) await loadAssetsForClient(cid);
  }

  async function reloadValuations(assetId: string) {
    // asset_valuations may not exist yet in every environment (P3 migration) —
    // degrade to "no history" rather than failing the whole page.
    try {
      const { data, error } = await supabase
        .from('asset_valuations')
        .select('id, valuation_date, value, net_contribution, source')
        .eq('asset_id', assetId)
        .order('valuation_date', { ascending: false });
      if (error) throw error;
      setAssetValuations(prev => ({ ...prev, [assetId]: (data || []) as AssetValuationRow[] }));
    } catch {
      setAssetValuations(prev => ({ ...prev, [assetId]: [] }));
    }
  }

  async function handleToggleExpandAsset(assetId: string) {
    if (expandedAssetId === assetId) { setExpandedAssetId(null); return; }
    setExpandedAssetId(assetId);
    setDeletingValuationId(null);
    if (!assetValuations[assetId]) {
      setLoadingValuationIds(prev => new Set(prev).add(assetId));
      await reloadValuations(assetId);
      setLoadingValuationIds(prev => { const s = new Set(prev); s.delete(assetId); return s; });
    }
  }

  /** Keeps assets.current_value/valuation_date pointed at whatever the latest
   *  remaining valuation is — called after every save or delete so the figure
   *  NetworthTab/PortfolioTab read never drifts from this page's history. */
  async function syncAssetToLatestValuation(assetId: string) {
    const { data: latest } = await supabase
      .from('asset_valuations')
      .select('valuation_date, value')
      .eq('asset_id', assetId)
      .order('valuation_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      await supabase.from('assets').update({ current_value: latest.value, valuation_date: latest.valuation_date }).eq('id', assetId);
    }
  }

  async function handleDeleteValuation(assetId: string, rowId: string) {
    const { error } = await supabase.from('asset_valuations').delete().eq('id', rowId);
    if (error) { alert(`Delete failed: ${error.message}`); return; }
    setDeletingValuationId(null);
    await syncAssetToLatestValuation(assetId);
    await Promise.all([reloadValuations(assetId), reloadAssets()]);
  }

  // ── Legacy portfolios (read-only) ──
  async function loadPortfoliosForClient(clientId: string) {
    setLoadingPortfolios(true);
    setExpandedPortId(null);

    const { data: portData } = await supabase
      .from('portfolios')
      .select('id, name, currency, capital_injection, injection_date')
      .eq('client_id', clientId)
      .order('injection_date');

    const portIds = (portData || []).map((p: any) => p.id);
    const latestMap: Record<string, { snapshot_date: string; end_value: number }> = {};

    if (portIds.length > 0) {
      const { data: histData } = await supabase
        .from('portfolio_history')
        .select('portfolio_id, snapshot_date, end_value')
        .in('portfolio_id', portIds)
        .order('snapshot_date', { ascending: false });
      // First occurrence per portfolio_id = latest record
      for (const h of histData || []) {
        if (!latestMap[h.portfolio_id]) latestMap[h.portfolio_id] = h;
      }
    }

    setPortfolios((portData || []).map((p: any) => ({
      ...p,
      last_date: latestMap[p.id]?.snapshot_date ?? null,
      last_value: latestMap[p.id]?.end_value ?? null,
    })));
    setLoadingPortfolios(false);
  }

  async function reloadHistory(portId: string) {
    const { data } = await supabase
      .from('portfolio_history')
      .select('id, snapshot_date, end_value, cashflow')
      .eq('portfolio_id', portId)
      .order('snapshot_date', { ascending: false });
    setHistory(prev => ({ ...prev, [portId]: data || [] }));
  }

  async function handleToggleExpandPort(portId: string) {
    if (expandedPortId === portId) { setExpandedPortId(null); return; }
    setExpandedPortId(portId);
    if (!history[portId]) {
      setLoadingHistoryIds(prev => new Set(prev).add(portId));
      await reloadHistory(portId);
      setLoadingHistoryIds(prev => { const s = new Set(prev); s.delete(portId); return s; });
    }
  }

  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('Market Values', '市值管理')}</h1>
        <p className="text-sm text-slate-400 mt-1">
          {t('Record monthly valuations for each investment asset', '按资产录入月度估值')}
        </p>
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 13rem)', minHeight: '400px' }}>

        {/* ── Column: Client List ── */}
        <div className="w-60 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-y-auto flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('Clients', '客户')}</p>
          </div>
          {loadingClients ? (
            <div className="flex-1 flex items-center justify-center"><Spinner /></div>
          ) : clients.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">{t('No clients found.', '没有客户。')}</div>
          ) : (
            clients.map(c => (
              <button key={c.id} onClick={() => setSelectedClientId(c.id)}
                className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors border-b border-slate-50 last:border-0 ${
                  selectedClientId === c.id
                    ? 'bg-xin-gold/10 text-xin-blue border-l-2 border-l-xin-gold font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.full_name}
              </button>
            ))
          )}
        </div>

        {/* ── Column: Asset Valuations + legacy Portfolios ── */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-y-auto flex flex-col min-w-0">
          {!selectedClientId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              {t('← Select a client to record valuations', '← 选择客户录入估值')}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-xin-blue text-sm">
                  {selectedClient?.full_name} — {t('Investment Assets', '投资资产')}
                </h2>
              </div>

              {loadingAssets ? (
                <div className="py-12 flex items-center justify-center"><Spinner /></div>
              ) : assets.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm px-6">
                  {t('This client has no investment assets yet. Add one from the Net Worth tab.', '该客户还没有投资资产，请先在净资产页添加。')}
                </div>
              ) : (
                assets.map(a => {
                  const green = isGreenStatus(a.valuation_date);
                  const hasDate = !!a.valuation_date;
                  const isExpanded = expandedAssetId === a.id;
                  const rows = assetValuations[a.id] ?? [];

                  return (
                    <div key={a.id} className="border-b border-slate-100 last:border-0">
                      {/* Asset row */}
                      <div
                        className="flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                        onClick={() => handleToggleExpandAsset(a.id)}
                      >
                        {isExpanded
                          ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
                          : <ChevronRight size={16} className="text-slate-400 shrink-0" />
                        }
                        {/* Status dot */}
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          !hasDate ? 'bg-slate-300' : green ? 'bg-emerald-500' : 'bg-amber-400'
                        }`} />
                        {/* Name + type */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-xin-blue truncate">{a.name}</div>
                          <div className="text-xs text-slate-400">{assetTypeLabel(a.asset_type, lang)}</div>
                        </div>
                        {/* Last value + month */}
                        {hasDate && (
                          <div className="text-right shrink-0 mr-3">
                            <div className="text-sm font-bold text-xin-blue">RM {fmtNumber(a.current_value ?? 0)}</div>
                            <div className={`text-xs font-medium ${green ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {fmtMonth(a.valuation_date!)} {green ? '✓' : '⚠'}
                            </div>
                          </div>
                        )}
                        {!hasDate && (
                          <div className="text-xs text-slate-400 mr-3 shrink-0">{t('No records', '暂无记录')}</div>
                        )}
                        {/* Action buttons — only visible when expanded */}
                        {isExpanded && (
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setValuationModal({ asset: a })}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-xin-blue text-white hover:bg-xin-blueLight transition-colors whitespace-nowrap"
                            >
                              <Plus size={12} /> {t('Record', '录入')}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Expanded: valuation history sub-table */}
                      {isExpanded && (
                        <div className="px-6 pb-5 bg-slate-50/60">
                          {loadingValuationIds.has(a.id) && rows.length === 0 ? (
                            <div className="py-6 flex justify-center"><Spinner /></div>
                          ) : rows.length === 0 ? (
                            <p className="py-4 text-center text-slate-400 text-xs">
                              {t('No records yet. Click "+ Record" above to add the first one.', '暂无记录，点击上方「录入」添加第一条。')}
                            </p>
                          ) : (
                            <table className="w-full text-xs mt-1">
                              <thead>
                                <tr className="text-slate-400 font-bold uppercase tracking-wider">
                                  <th className="py-2 text-left">{t('Month', '月份')}</th>
                                  <th className="py-2 text-right">{t('Value', '市值')} (RM)</th>
                                  <th className="py-2 text-right">{t('Net Contribution', '期内追加')}</th>
                                  <th className="py-2 w-16"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map(row => (
                                  <React.Fragment key={row.id}>
                                    <tr className="border-t border-slate-200/60">
                                      <td className="py-2.5 font-semibold text-xin-blue">{fmtMonth(row.valuation_date)}</td>
                                      <td className="py-2.5 text-right font-bold text-xin-blue">{fmtNumber(row.value)}</td>
                                      <td className="py-2.5 text-right text-slate-400">
                                        {row.net_contribution ? (row.net_contribution > 0 ? `+${fmtNumber(row.net_contribution)}` : fmtNumber(row.net_contribution)) : '—'}
                                      </td>
                                      <td className="py-2.5">
                                        <div className="flex gap-1 justify-end items-center">
                                          {row.source !== 'manual' && (
                                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 uppercase">{row.source}</span>
                                          )}
                                          <button
                                            onClick={() => {
                                              setDeletingValuationId(null);
                                              setValuationModal({ asset: a, editRow: row });
                                            }}
                                            className="p-1 rounded text-slate-300 hover:text-xin-gold hover:bg-xin-gold/10 transition-colors"
                                            title={t('Edit this month', '修改此条记录')}
                                          >
                                            <Pencil size={13} />
                                          </button>
                                          <button
                                            onClick={() => setDeletingValuationId(
                                              deletingValuationId === row.id ? null : row.id
                                            )}
                                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title={t('Delete this month', '删除此条记录')}
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                    {/* Inline delete confirmation */}
                                    {deletingValuationId === row.id && (
                                      <tr>
                                        <td colSpan={4}>
                                          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 my-1 flex items-center justify-between gap-3">
                                            <span className="text-red-700 font-medium text-xs">
                                              {t(
                                                `Delete ${fmtMonth(row.valuation_date)} record? Cannot be undone.`,
                                                `删除 ${fmtMonth(row.valuation_date)} 的记录？此操作无法撤销。`
                                              )}
                                            </span>
                                            <div className="flex gap-2 shrink-0">
                                              <button
                                                onClick={() => setDeletingValuationId(null)}
                                                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                              >
                                                {t('Cancel', '取消')}
                                              </button>
                                              <button
                                                onClick={() => handleDeleteValuation(a.id, row.id)}
                                                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                                              >
                                                {t('Delete', '删除')}
                                              </button>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* ── Legacy portfolios (read-only) ── */}
              <div className="mt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowLegacy(p => !p)}
                  className="w-full flex items-center gap-2 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  {showLegacy ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t('Legacy Portfolios (read-only, migrated to assets)', '旧版投资组合（只读，已迁移到资产）')}
                  </span>
                </button>
                {showLegacy && (
                  loadingPortfolios ? (
                    <div className="py-8 flex justify-center"><Spinner /></div>
                  ) : portfolios.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">{t('No legacy portfolios for this client.', '该客户没有旧版投资组合。')}</div>
                  ) : (
                    portfolios.map(p => {
                      const green = isGreenStatus(p.last_date);
                      const hasDate = !!p.last_date;
                      const isExpanded = expandedPortId === p.id;
                      const portHistory = history[p.id] ?? [];

                      return (
                        <div key={p.id} className="border-t border-slate-100">
                          <div
                            className="flex items-center gap-3 px-6 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors select-none opacity-80"
                            onClick={() => handleToggleExpandPort(p.id)}
                          >
                            {isExpanded
                              ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
                              : <ChevronRight size={16} className="text-slate-400 shrink-0" />
                            }
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              !hasDate ? 'bg-slate-300' : green ? 'bg-emerald-500' : 'bg-amber-400'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-500 truncate">{p.name}</div>
                              <div className="text-xs text-slate-400">{p.currency}</div>
                            </div>
                            {hasDate ? (
                              <div className="text-right shrink-0 mr-3">
                                <div className="text-sm font-bold text-slate-500">{fmtNumber(p.last_value ?? 0)}</div>
                                <div className="text-xs text-slate-400">{fmtMonth(p.last_date!)}</div>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400 mr-3 shrink-0">{t('No records', '暂无记录')}</div>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="px-6 pb-5 bg-slate-50/60">
                              {loadingHistoryIds.has(p.id) && portHistory.length === 0 ? (
                                <div className="py-6 flex justify-center"><Spinner /></div>
                              ) : portHistory.length === 0 ? (
                                <p className="py-4 text-center text-slate-400 text-xs">{t('No records.', '暂无记录。')}</p>
                              ) : (
                                <table className="w-full text-xs mt-1">
                                  <thead>
                                    <tr className="text-slate-400 font-bold uppercase tracking-wider">
                                      <th className="py-2 text-left">{t('Month', '月份')}</th>
                                      <th className="py-2 text-right">{t('Market Value', '市值')} ({p.currency})</th>
                                      <th className="py-2 text-right">{t('Top-up', '追加')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {portHistory.map(row => (
                                      <tr key={row.id} className="border-t border-slate-200/60">
                                        <td className="py-2.5 font-semibold text-slate-500">{fmtMonth(row.snapshot_date)}</td>
                                        <td className="py-2.5 text-right font-bold text-slate-500">{fmtNumber(row.end_value)}</td>
                                        <td className="py-2.5 text-right text-slate-400">
                                          {row.cashflow > 0 ? `+${fmtNumber(row.cashflow)}` : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Record Monthly Valuation ── */}
      {valuationModal && selectedClientId && (
        <RecordValuationModal
          clientId={selectedClientId}
          asset={valuationModal.asset}
          editRow={valuationModal.editRow}
          onClose={() => setValuationModal(null)}
          onSaved={async () => {
            const assetId = valuationModal.asset.id;
            setValuationModal(null);
            await Promise.all([reloadValuations(assetId), reloadAssets()]);
          }}
          t={t}
        />
      )}
    </div>
  );
}

// ── Shared: Modal Overlay ──────────────────────────────────────────────────
function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ── Shared: Spinner ────────────────────────────────────────────────────────
function Spinner() {
  return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-xin-blue" />;
}

// ── Modal: Record Monthly Valuation (writes asset_valuations) ──────────────
function RecordValuationModal({
  clientId, asset, editRow, onClose, onSaved, t,
}: {
  clientId: string;
  asset: AssetRow;
  editRow?: AssetValuationRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
  t: (en: string, zh: string) => string;
}) {
  const isEdit = !!editRow;
  const [month, setMonth] = useState(
    isEdit ? toYearMonth(editRow!.valuation_date) : nextMonthAfter(asset.valuation_date)
  );
  const [value, setValue] = useState(isEdit ? String(editRow!.value) : '');
  const [netContribution, setNetContribution] = useState(isEdit ? String(editRow!.net_contribution || '') : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!month || !value) {
      setError(t('Month and Value are required.', '请填写月份和市值。'));
      return;
    }
    setSaving(true);
    setError('');
    const valuationDate = lastDayOf(month);
    const { error: upErr } = await supabase.from('asset_valuations').upsert(
      {
        asset_id: asset.id,
        client_id: clientId,
        valuation_date: valuationDate,
        value: parseFloat(value),
        net_contribution: parseFloat(netContribution || '0'),
        source: 'manual',
      },
      { onConflict: 'asset_id,valuation_date' }
    );
    if (upErr) { setError(upErr.message); setSaving(false); return; }

    // Only the LATEST valuation for this asset should drive assets.current_value
    // — re-check against the DB rather than assuming this save is the latest
    // (an advisor may be backfilling an older month).
    const { data: latest } = await supabase
      .from('asset_valuations')
      .select('valuation_date, value')
      .eq('asset_id', asset.id)
      .order('valuation_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest && latest.valuation_date === valuationDate) {
      await supabase.from('assets').update({ current_value: latest.value, valuation_date: latest.valuation_date }).eq('id', asset.id);
    }
    setSaving(false);
    await onSaved();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-xin-blue px-6 py-4 flex items-center justify-between">
          <h3 className="text-xin-gold font-bold text-base">
            {isEdit
              ? `${t('Edit', '修改市值')} — ${fmtMonth(editRow!.valuation_date)}`
              : t('Record Monthly Value', '录入市值')}
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Asset', '资产')}
            </label>
            <div className="bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-semibold text-xin-blue">
              {asset.name}
            </div>
          </div>
          {asset.valuation_date && (
            <div className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-2.5">
              {t('Last recorded:', '上次录入：')}{' '}
              <span className="font-semibold text-slate-600">{fmtMonth(asset.valuation_date)}</span>
              {' — '}RM {fmtNumber(asset.current_value ?? 0)}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Month', '月份')} <span className="text-red-400">*</span>
            </label>
            <input
              type="month" value={month} onChange={e => setMonth(e.target.value)}
              disabled={isEdit}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Value', '市值')} (RM) <span className="text-red-400">*</span>
            </label>
            <input
              type="number" min="0" step="0.01" value={value}
              onChange={e => setValue(e.target.value)} placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Net Contribution (optional)', '期内净追加（可选）')}
            </label>
            <input
              type="number" step="0.01" value={netContribution}
              onChange={e => setNetContribution(e.target.value)}
              placeholder={t('Deposits minus withdrawals this period', '本期存入减取出')}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
            {t('Cancel', '取消')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-xin-blue text-white hover:bg-xin-blueLight transition-colors disabled:opacity-50">
            {saving ? t('Saving…', '保存中…') : t('Save', '保存')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
