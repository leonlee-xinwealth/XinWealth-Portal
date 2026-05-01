import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { fmtRM, safeNumber } from '../utils/finance';

const ACCOUNT_TYPES: [string, string][] = [
  ['unit_trust', 'Unit Trust'],
  ['private_mandate', 'Private Mandate'],
  ['prs', 'PRS'],
  ['wrap_account', 'Wrap Account'],
  ['other', 'Other'],
];

const EMPTY_ACCOUNT = {
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

export default function PortfolioTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [aForm, setAForm] = useState(EMPTY_ACCOUNT);
  const [savingAccount, setSavingAccount] = useState(false);

  const [showAddHolding, setShowAddHolding] = useState<null | string>(null);
  const [hForm, setHForm] = useState(EMPTY_HOLDING);
  const [savingHolding, setSavingHolding] = useState(false);

  const setA = (k: string, v: any) => setAForm(p => ({ ...p, [k]: v }));
  const setH = (k: string, v: any) => setHForm(p => ({ ...p, [k]: v }));

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const [{ data: acc, error: aErr }, { data: hol, error: hErr }] = await Promise.all([
        supabase.from('investment_accounts').select('*').eq('client_id', clientId).order('account_name'),
        supabase.from('portfolio_holdings').select('*').eq('client_id', clientId).order('snapshot_month', { ascending: false }),
      ]);
      if (aErr || hErr) throw (aErr || hErr);
      setAccounts(acc || []);
      setHoldings(hol || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
      setAccounts([]);
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [clientId]);

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

  const summary = useMemo(() => {
    let total = 0;
    let asOf: string | null = null;
    let active = 0;
    for (const a of accounts) {
      if (!a.status || String(a.status).toLowerCase() === 'active') active += 1;
      const info = latestSnapshotByAccount.get(a.id);
      if (info) {
        total += info.total;
        if (info.month && (!asOf || info.month > asOf)) asOf = info.month;
      }
    }
    return { total, active, asOf };
  }, [accounts, latestSnapshotByAccount]);

  async function addAccount() {
    if (!aForm.account_name.trim()) return;
    setSavingAccount(true);
    const payload: any = {
      client_id: clientId,
      account_type: aForm.account_type || 'other',
      account_name: aForm.account_name.trim(),
      platform: aForm.platform || null,
      account_number: aForm.account_number || null,
      opened_date: aForm.opened_date || null,
      currency: aForm.currency || 'MYR',
      notes: aForm.notes || null,
      status: 'active',
    };
    const { error } = await supabase.from('investment_accounts').insert(payload);
    setSavingAccount(false);
    if (error) return setErr(error.message);
    setShowAddAccount(false);
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

  const fmtMonth = (m: string | null) => {
    if (!m) return '—';
    const d = new Date(String(m));
    return d.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-MY', { year: 'numeric', month: 'short' });
  };

  if (loading) return <Loader />;

  return (
    <div>
      {err ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm mb-4">{err}</div>
      ) : null}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <SumCard label={t('Total Portfolio Value', '投资组合总值')} value={`RM ${fmtRM(summary.total)}`} color="text-xin-blue" bg="bg-blue-50" />
        <SumCard label={t('Active Accounts', '活跃账户')} value={String(summary.active)} color="text-emerald-600" bg="bg-emerald-50" />
        <SumCard label={t('As of', '截至')} value={summary.asOf ? fmtMonth(summary.asOf) : '—'} color="text-slate-600" bg="bg-slate-50" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-xin-blue">{t('Investment Accounts', '投资账户')}</h3>
        <button onClick={() => setShowAddAccount(true)} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-xin-blue text-white rounded-xl hover:bg-xin-blueLight transition-colors">
          <Plus size={14} />{t('Add Account', '添加账户')}
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm shadow-sm">
          {t('No investment accounts yet.', '还没有投资账户。')}
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(a => {
            const open = !!expanded[a.id];
            const info = latestSnapshotByAccount.get(a.id);
            const status = String(a.status || 'active').toLowerCase();
            const statusCls = status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600';
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(p => ({ ...p, [a.id]: !p[a.id] }))}
                  className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-xin-blue truncate">{a.account_name}</div>
                      <span className={`${statusCls} text-xs font-semibold px-2 py-0.5 rounded-full`}>{status === 'active' ? t('Active', '活跃') : t('Closed', '关闭')}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {a.platform ? a.platform : t('Platform not set', '未填写平台')}
                      {a.account_type ? ` · ${a.account_type}` : ''}
                      {a.account_number ? ` · #${a.account_number}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-xin-blue">RM {fmtRM(info?.total || 0)}</div>
                    <div className="text-[11px] text-slate-400">{t('Last updated', '更新时间')}: {fmtMonth(info?.month || null)}</div>
                  </div>
                  <div className="text-slate-300">
                    {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {open && (
                  <div className="px-5 pb-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t('Holdings', '持仓')}</div>
                      <button
                        onClick={() => {
                          setShowAddHolding(a.id);
                          setHForm(p => ({ ...p, snapshot_month: new Date().toISOString().slice(0, 7) }));
                        }}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600"
                      >
                        <Plus size={12} />{t('Add Snapshot', '新增月度快照')}
                      </button>
                    </div>

                    {info?.rows && info.rows.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-slate-100">
                        <div className="grid grid-cols-[1.6fr_0.9fr_0.9fr_1fr] bg-slate-50 text-[11px] font-semibold text-slate-500 px-4 py-2">
                          <div>{t('Fund / Instrument', '基金/标的')}</div>
                          <div>{t('Units', '份额')}</div>
                          <div>{t('NAV', '净值')}</div>
                          <div>{t('Value', '市值')}</div>
                        </div>
                        {info.rows.map((h: any, idx: number) => (
                          <div key={h.id || idx} className="grid grid-cols-[1.6fr_0.9fr_0.9fr_1fr] px-4 py-2.5 border-t border-slate-50 text-xs">
                            <div className="font-semibold text-xin-blue truncate">{h.instrument_name || h.instrument_code || '—'}</div>
                            <div className="text-slate-600">{safeNumber(h.units_held).toLocaleString('en-MY', { maximumFractionDigits: 2 })}</div>
                            <div className="text-slate-600">RM {safeNumber(h.nav_per_unit).toLocaleString('en-MY', { maximumFractionDigits: 4 })}</div>
                            <div className="font-bold text-xin-blue">RM {fmtRM(safeNumber(h.market_value))}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400 text-sm">
                        {t('No holdings snapshots yet.', '还没有持仓快照。')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddAccount && (
        <Modal title={t('Add Investment Account', '添加投资账户')} onClose={() => setShowAddAccount(false)}>
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
          <BtnRow onSave={addAccount} onCancel={() => setShowAddAccount(false)} saving={savingAccount} t={t} />
        </Modal>
      )}

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
    </div>
  );
}

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
const Inp = ({ value, onChange, type = 'text', placeholder }: any) => (
  <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold" />
);
const Sel = ({ value, onChange, opts }: any) => (
  <select value={value} onChange={(e: any) => onChange(e.target.value)}
    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white">
    {opts.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}
  </select>
);
const BtnRow = ({ onSave, onCancel, saving, t }: any) => (
  <div className="flex gap-2 mt-2">
    <button onClick={onSave} disabled={saving} className="px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm disabled:opacity-50">{saving ? '...' : t('Save', '保存')}</button>
    <button onClick={onCancel} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">{t('Cancel', '取消')}</button>
  </div>
);
const Loader = () => <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" /></div>;

