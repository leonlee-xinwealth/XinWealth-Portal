import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface Client { id: string; full_name: string; }

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
/** Returns "YYYY-MM-01" */
function firstDayOf(yearMonth: string): string { return `${yearMonth}-01`; }
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

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);

  // Expand/collapse + history
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryRow[]>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);

  // Modals
  const [recordModal, setRecordModal] = useState<{ portfolio: PortfolioRow; editRow?: HistoryRow } | null>(null);
  const [newPortModal, setNewPortModal] = useState(false);
  const [editPortModal, setEditPortModal] = useState<PortfolioRow | null>(null);
  const [deletePortDialog, setDeletePortDialog] = useState<PortfolioRow | null>(null);

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

  // ── Load portfolios when client changes
  useEffect(() => {
    if (!selectedClientId) { setPortfolios([]); return; }
    loadPortfoliosForClient(selectedClientId);
  }, [selectedClientId]);

  async function loadPortfoliosForClient(clientId: string) {
    setLoadingPortfolios(true);
    setExpandedId(null);
    setDeletingHistoryId(null);

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

  async function reloadPortfolios() {
    if (selectedClientId) await loadPortfoliosForClient(selectedClientId);
  }

  async function reloadHistory(portId: string) {
    const { data } = await supabase
      .from('portfolio_history')
      .select('id, snapshot_date, end_value, cashflow')
      .eq('portfolio_id', portId)
      .order('snapshot_date', { ascending: false });
    setHistory(prev => ({ ...prev, [portId]: data || [] }));
  }

  async function handleToggleExpand(portId: string) {
    if (expandedId === portId) { setExpandedId(null); return; }
    setExpandedId(portId);
    setDeletingHistoryId(null);
    if (!history[portId]) {
      setLoadingHistory(true);
      await reloadHistory(portId);
      setLoadingHistory(false);
    }
  }

  async function handleDeleteHistory(portId: string, rowId: string) {
    await supabase.from('portfolio_history').delete().eq('id', rowId);
    setDeletingHistoryId(null);
    await Promise.all([reloadHistory(portId), reloadPortfolios()]);
  }

  async function handleDeletePortfolio(portId: string) {
    await supabase.from('portfolios').delete().eq('id', portId);
    setDeletePortDialog(null);
    setExpandedId(null);
    setHistory(prev => { const n = { ...prev }; delete n[portId]; return n; });
    await reloadPortfolios();
  }

  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('Market Values', '市值管理')}</h1>
        <p className="text-sm text-slate-400 mt-1">
          {t('Record and manage client portfolio market values', '录入并管理客户投资组合市值')}
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

        {/* ── Column: Portfolio Panel ── */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-y-auto flex flex-col min-w-0">
          {!selectedClientId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              {t('← Select a client to view portfolios', '← 选择客户查看投资组合')}
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <h2 className="font-semibold text-xin-blue text-sm">
                  {selectedClient?.full_name} — {t('Portfolios', '投资组合')}
                </h2>
                <button onClick={() => setNewPortModal(true)}
                  className="flex items-center gap-1.5 bg-xin-blue text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-xin-blueLight transition-colors"
                >
                  <Plus size={14} />
                  {t('New Portfolio', '新建组合')}
                </button>
              </div>

              {loadingPortfolios ? (
                <div className="flex-1 flex items-center justify-center"><Spinner /></div>
              ) : portfolios.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                  {t('No portfolios yet. Click "+ New Portfolio" to create one.', '还没有投资组合，点击「新建组合」创建。')}
                </div>
              ) : (
                portfolios.map(p => {
                  const green = isGreenStatus(p.last_date);
                  const hasDate = !!p.last_date;
                  const isExpanded = expandedId === p.id;
                  const portHistory = history[p.id] ?? [];

                  return (
                    <div key={p.id} className="border-b border-slate-100 last:border-0">
                      {/* Portfolio row */}
                      <div
                        className="flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                        onClick={() => handleToggleExpand(p.id)}
                      >
                        {isExpanded
                          ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
                          : <ChevronRight size={16} className="text-slate-400 shrink-0" />
                        }
                        {/* Status dot */}
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          !hasDate ? 'bg-slate-300' : green ? 'bg-emerald-500' : 'bg-amber-400'
                        }`} />
                        {/* Name + currency */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-xin-blue truncate">{p.name}</div>
                          <div className="text-xs text-slate-400">{p.currency}</div>
                        </div>
                        {/* Last value + month */}
                        {hasDate && (
                          <div className="text-right shrink-0 mr-3">
                            <div className="text-sm font-bold text-xin-blue">{fmtNumber(p.last_value ?? 0)}</div>
                            <div className={`text-xs font-medium ${green ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {fmtMonth(p.last_date!)} {green ? '✓' : '⚠'}
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
                              onClick={() => setRecordModal({ portfolio: p })}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-xin-blue text-white hover:bg-xin-blueLight transition-colors whitespace-nowrap"
                            >
                              <Plus size={12} /> {t('Record', '录入')}
                            </button>
                            <button
                              onClick={() => setEditPortModal(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-xin-blue hover:bg-slate-100 transition-colors"
                              title={t('Edit portfolio metadata', '编辑投资组合')}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeletePortDialog(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title={t('Delete portfolio', '删除投资组合')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Expanded: history sub-table */}
                      {isExpanded && (
                        <div className="px-6 pb-5 bg-slate-50/60">
                          {loadingHistory && portHistory.length === 0 ? (
                            <div className="py-6 flex justify-center"><Spinner /></div>
                          ) : portHistory.length === 0 ? (
                            <p className="py-4 text-center text-slate-400 text-xs">
                              {t('No records yet. Click "+ Record" above to add the first one.', '暂无记录，点击上方「录入」添加第一条。')}
                            </p>
                          ) : (
                            <table className="w-full text-xs mt-1">
                              <thead>
                                <tr className="text-slate-400 font-bold uppercase tracking-wider">
                                  <th className="py-2 text-left">{t('Month', '月份')}</th>
                                  <th className="py-2 text-right">{t('Market Value', '市值')} ({p.currency})</th>
                                  <th className="py-2 text-right">{t('Top-up', '追加')}</th>
                                  <th className="py-2 w-16"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {portHistory.map(row => (
                                  <React.Fragment key={row.id}>
                                    <tr className="border-t border-slate-200/60">
                                      <td className="py-2.5 font-semibold text-xin-blue">{fmtMonth(row.snapshot_date)}</td>
                                      <td className="py-2.5 text-right font-bold text-xin-blue">{fmtNumber(row.end_value)}</td>
                                      <td className="py-2.5 text-right text-slate-400">
                                        {row.cashflow > 0 ? `+${fmtNumber(row.cashflow)}` : '—'}
                                      </td>
                                      <td className="py-2.5">
                                        <div className="flex gap-1 justify-end">
                                          <button
                                            onClick={() => {
                                              setDeletingHistoryId(null);
                                              setRecordModal({ portfolio: p, editRow: row });
                                            }}
                                            className="p-1 rounded text-slate-300 hover:text-xin-gold hover:bg-xin-gold/10 transition-colors"
                                            title={t('Edit this month', '修改此条记录')}
                                          >
                                            <Pencil size={13} />
                                          </button>
                                          <button
                                            onClick={() => setDeletingHistoryId(
                                              deletingHistoryId === row.id ? null : row.id
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
                                    {deletingHistoryId === row.id && (
                                      <tr>
                                        <td colSpan={4}>
                                          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 my-1 flex items-center justify-between gap-3">
                                            <span className="text-red-700 font-medium text-xs">
                                              {t(
                                                `Delete ${fmtMonth(row.snapshot_date)} record? Cannot be undone.`,
                                                `删除 ${fmtMonth(row.snapshot_date)} 的记录？此操作无法撤销。`
                                              )}
                                            </span>
                                            <div className="flex gap-2 shrink-0">
                                              <button
                                                onClick={() => setDeletingHistoryId(null)}
                                                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                              >
                                                {t('Cancel', '取消')}
                                              </button>
                                              <button
                                                onClick={() => handleDeleteHistory(p.id, row.id)}
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
            </>
          )}
        </div>
      </div>

      {/* ── Modal 1: Record Monthly Value ── */}
      {recordModal && (
        <RecordModal
          portfolio={recordModal.portfolio}
          editRow={recordModal.editRow}
          onClose={() => setRecordModal(null)}
          onSaved={async () => {
            const portId = recordModal.portfolio.id;
            const wasExpanded = expandedId === portId;
            setRecordModal(null);
            await reloadPortfolios();
            if (wasExpanded) await reloadHistory(portId);
          }}
          t={t}
        />
      )}

      {/* ── Modal 2: New Portfolio ── */}
      {newPortModal && selectedClient && (
        <NewPortfolioModal
          client={selectedClient}
          onClose={() => setNewPortModal(false)}
          onSaved={async () => { setNewPortModal(false); await reloadPortfolios(); }}
          t={t}
        />
      )}

      {/* ── Modal 3: Edit Portfolio ── */}
      {editPortModal && (
        <EditPortfolioModal
          portfolio={editPortModal}
          onClose={() => setEditPortModal(null)}
          onSaved={async () => { setEditPortModal(null); await reloadPortfolios(); }}
          t={t}
        />
      )}

      {/* ── Delete Portfolio Dialog ── */}
      {deletePortDialog && (
        <DeletePortfolioDialog
          portfolio={deletePortDialog}
          onClose={() => setDeletePortDialog(null)}
          onDeleted={() => handleDeletePortfolio(deletePortDialog.id)}
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

// ── Modal 1: Record Monthly Value ──────────────────────────────────────────
function RecordModal({
  portfolio, editRow, onClose, onSaved, t,
}: {
  portfolio: PortfolioRow;
  editRow?: HistoryRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
  t: (en: string, zh: string) => string;
}) {
  const isEdit = !!editRow;
  const [month, setMonth] = useState(
    isEdit ? toYearMonth(editRow!.snapshot_date) : nextMonthAfter(portfolio.last_date)
  );
  const [endValue, setEndValue] = useState(isEdit ? String(editRow!.end_value) : '');
  const [cashflow, setCashflow] = useState(isEdit ? String(editRow!.cashflow || '') : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!month || !endValue) {
      setError(t('Month and Market Value are required.', '请填写月份和市值。'));
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('portfolio_history').upsert(
      {
        portfolio_id: portfolio.id,
        snapshot_date: lastDayOf(month),
        end_value: parseFloat(endValue),
        cashflow: parseFloat(cashflow || '0'),
      },
      { onConflict: 'portfolio_id,snapshot_date' }
    );
    if (err) { setError(err.message); setSaving(false); return; }
    await onSaved();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-xin-blue px-6 py-4 flex items-center justify-between">
          <h3 className="text-xin-gold font-bold text-base">
            {isEdit
              ? `${t('Edit', '修改市值')} — ${fmtMonth(editRow!.snapshot_date)}`
              : t('Record Monthly Value', '录入市值')}
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Portfolio', '投资组合')}
            </label>
            <div className="bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-semibold text-xin-blue">
              {portfolio.name} · {portfolio.currency}
            </div>
          </div>
          {portfolio.last_date && (
            <div className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-2.5">
              {t('Last recorded:', '上次录入：')}{' '}
              <span className="font-semibold text-slate-600">{fmtMonth(portfolio.last_date)}</span>
              {' — '}{portfolio.currency} {fmtNumber(portfolio.last_value ?? 0)}
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
              {t('Market Value', '市值')} ({portfolio.currency}) <span className="text-red-400">*</span>
            </label>
            <input
              type="number" min="0" step="0.01" value={endValue}
              onChange={e => setEndValue(e.target.value)} placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Top-up (optional)', '追加注资（可选）')}
            </label>
            <input
              type="number" min="0" step="0.01" value={cashflow}
              onChange={e => setCashflow(e.target.value)}
              placeholder={t('Leave blank if no additional injection', '如无追加可留空')}
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

// ── Modal 2: New Portfolio ─────────────────────────────────────────────────
function NewPortfolioModal({
  client, onClose, onSaved, t,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => Promise<void>;
  t: (en: string, zh: string) => string;
}) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('SGD');
  const [capital, setCapital] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim() || !capital || !startMonth) {
      setError(t('Please fill in all required fields.', '请填写所有必填字段。'));
      return;
    }
    setSaving(true);
    setError('');
    const { data: port, error: portErr } = await supabase.from('portfolios').insert({
      client_id: client.id,
      name: name.trim(),
      currency,
      capital_injection: parseFloat(capital),
      injection_date: firstDayOf(startMonth),
    }).select().single();
    if (portErr || !port) {
      setError(portErr?.message ?? 'Failed to create portfolio');
      setSaving(false);
      return;
    }
    const { error: histErr } = await supabase.from('portfolio_history').insert({
      portfolio_id: port.id,
      snapshot_date: lastDayOf(startMonth),
      end_value: parseFloat(capital),
      cashflow: parseFloat(capital),
    });
    if (histErr) { setError(histErr.message); setSaving(false); return; }
    await onSaved();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-xin-blue px-6 py-4 flex items-center justify-between">
          <h3 className="text-xin-gold font-bold text-base">{t('New Portfolio', '新建投资组合')}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{t('Client', '客户')}</label>
            <div className="bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-semibold text-xin-blue">{client.full_name}</div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Portfolio Name', '组合名称')} <span className="text-red-400">*</span>
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder={t('e.g. PGWA Quant Global', '例：PGWA 量化全球')}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Currency', '货币')} <span className="text-red-400">*</span>
            </label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold bg-white"
            >
              {['SGD', 'MYR', 'USD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Initial Capital', '起始注资')} <span className="text-red-400">*</span>
            </label>
            <input type="number" min="0" step="0.01" value={capital} onChange={e => setCapital(e.target.value)}
              placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Start Month', '注资月份')} <span className="text-red-400">*</span>
            </label>
            <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)}
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
            {saving ? t('Creating…', '创建中…') : t('Create Portfolio', '创建组合')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Modal 3: Edit Portfolio ────────────────────────────────────────────────
function EditPortfolioModal({
  portfolio, onClose, onSaved, t,
}: {
  portfolio: PortfolioRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
  t: (en: string, zh: string) => string;
}) {
  const [name, setName] = useState(portfolio.name);
  const [currency, setCurrency] = useState(portfolio.currency);
  const [capital, setCapital] = useState(String(portfolio.capital_injection));
  const [startMonth, setStartMonth] = useState(toYearMonth(portfolio.injection_date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim() || !capital || !startMonth) {
      setError(t('Please fill in all required fields.', '请填写所有必填字段。'));
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('portfolios').update({
      name: name.trim(),
      currency,
      capital_injection: parseFloat(capital),
      injection_date: firstDayOf(startMonth),
    }).eq('id', portfolio.id);
    if (err) { setError(err.message); setSaving(false); return; }
    await onSaved();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-xin-blue px-6 py-4 flex items-center justify-between">
          <h3 className="text-xin-gold font-bold text-base">{t('Edit Portfolio', '编辑投资组合')}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 font-medium leading-relaxed">
            ⚠️ {t(
              'Changing the capital amount or start date will affect CAGR and FD comparison calculations visible to the client.',
              '修改起始注资或注资日期将影响客户端显示的 CAGR 和定存对比计算结果。'
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Portfolio Name', '组合名称')} <span className="text-red-400">*</span>
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Currency', '货币')} <span className="text-red-400">*</span>
            </label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold bg-white"
            >
              {['SGD', 'MYR', 'USD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Initial Capital', '起始注资')} <span className="text-red-400">*</span>
            </label>
            <input type="number" min="0" step="0.01" value={capital} onChange={e => setCapital(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Start Month', '注资月份')} <span className="text-red-400">*</span>
            </label>
            <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)}
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
            {saving ? t('Saving…', '保存中…') : t('Save Changes', '保存修改')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Delete Portfolio Dialog ────────────────────────────────────────────────
function DeletePortfolioDialog({
  portfolio, onClose, onDeleted, t,
}: {
  portfolio: PortfolioRow;
  onClose: () => void;
  onDeleted: () => void;
  t: (en: string, zh: string) => string;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase
      .from('portfolio_history')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', portfolio.id)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [portfolio.id]);

  function handleDelete() {
    setDeleting(true);
    onDeleted();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Trash2 size={22} className="text-red-500" />
          </div>
          <h3 className="font-bold text-xin-blue text-base mb-3">
            {t(`Delete "${portfolio.name}"?`, `删除「${portfolio.name}」？`)}
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            {t(
              `This will permanently delete the portfolio and all ${count !== null ? count : '…'} recorded month(s) of history. This action cannot be undone and will immediately remove this portfolio from the client's Investment tab.`,
              `这将永久删除该组合及其所有 ${count !== null ? count : '…'} 条历史记录，且将立即从客户的投资页面移除。此操作无法撤销。`
            )}
          </p>
        </div>
        <div className="px-6 pb-6 pt-4 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
            {t('Cancel', '取消')}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
            {deleting ? t('Deleting…', '删除中…') : t('Delete Portfolio', '删除组合')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
