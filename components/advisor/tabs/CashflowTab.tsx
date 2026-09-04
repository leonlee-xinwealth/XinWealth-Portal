import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, X, Pencil, AlertTriangle } from 'lucide-react';
import {
  monthlyBreakdown, recordedYears, yearToDateTotals,
  type PeriodRow,
} from '../../../supabase/functions/_shared/cashflow/periods';

// A cashflow entry records ONE MONTH'S actual figure for one category, so this
// screen is organised by month. The totals shown here are ACTUALS — what the
// client earned and spent — not the annualised run-rate the CFP report is built
// on. The two are different numbers on purpose and are never mixed: see
// _shared/cashflow/periods.ts, and the basis picker on the CFP tab.

const FREQ: [string,string][] = [['monthly','Monthly'],['annual','Annual'],['quarterly','Quarterly'],['semi_annual','Semi-annual'],['one_off','One-off']];

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const MONTH_LABELS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** YYYY-MM-01 for a year/month pair — the shape period_month expects. */
const toPeriodMonth = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}-01`;

const monthOfRow = (e: { period_month?: string | null }) =>
  Number(String(e.period_month ?? '').slice(5, 7)) || 0;

export default function CashflowTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [entries, setEntries] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'inflow'|'outflow'|null>(null);
  const [form, setForm] = useState({
    category: '', amount: '', frequency: 'monthly', is_recurring: true, source_note: '',
    // Which month this figure belongs to. Used to be hardcoded to the current
    // month with no way to change it, which is how five June expenses and one
    // July expense ended up looking like one client's whole position.
    month: new Date().getMonth() + 1,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number | 'all'>('all');

  const [editingId, setEditingId] = useState<string|null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [ok, setOk] = useState(false);
  const setEdit = (k: string, v: any) => setEditForm((p: any) => ({ ...p, [k]: v }));

  async function load() {
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from('cashflow_entries').select('*').eq('client_id', clientId).order('direction').order('category'),
      supabase.from('cashflow_categories').select('*').order('sort_order'),
    ]);
    setEntries(e || []); setCategories(c || []); setLoading(false);
  }
  useEffect(() => { load(); }, [clientId]);

  async function handleAdd() {
    if (!form.category || !form.amount) return;
    setSaving(true);
    await supabase.from('cashflow_entries').insert({
      client_id: clientId, direction: modal, category: form.category,
      amount: parseFloat(form.amount), frequency: form.frequency,
      is_recurring: form.is_recurring, source_note: form.source_note || null,
      period_month: toPeriodMonth(year, form.month),
    });
    setSaving(false); setModal(null);
    setForm({ category:'', amount:'', frequency:'monthly', is_recurring:true, source_note:'', month: new Date().getMonth()+1 });
    load();
  }
  async function handleDelete(id: string) {
    if (!confirm(t('Delete this entry?','确定删除？'))) return;
    await supabase.from('cashflow_entries').delete().eq('id', id); load();
  }

  function startEdit(entry: any) {
    setEditingId(entry.id);
    setEditForm({
      category: entry.category,
      amount: String(entry.amount),
      frequency: entry.frequency,
      is_recurring: entry.is_recurring,
      source_note: entry.source_note || '',
      month: monthOfRow(entry) || new Date().getMonth() + 1,
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }
  async function saveEdit(entry: any) {
    if (!editForm.category || !editForm.amount) return;
    setSavingEdit(true);
    await supabase.from('cashflow_entries').update({
      category: editForm.category,
      amount: parseFloat(editForm.amount),
      frequency: editForm.frequency,
      is_recurring: editForm.is_recurring,
      source_note: editForm.source_note || null,
      // Re-filing an entry under the right month is the fix for data that was
      // captured in one batch but belongs to another period.
      period_month: toPeriodMonth(
        Number(String(entry.period_month ?? '').slice(0, 4)) || year,
        editForm.month,
      ),
    }).eq('id', entry.id);
    setSavingEdit(false);
    setEditingId(null);
    setOk(true);
    setTimeout(() => setOk(false), 3000);
    load();
  }

  const years = useMemo(() => {
    const found = recordedYears(entries as PeriodRow[]);
    // Always offer the current year so a client with no history can be started.
    return found.includes(now.getFullYear()) ? found : [now.getFullYear(), ...found];
  }, [entries]);

  // Keep the selected year on something that exists once the rows arrive.
  useEffect(() => {
    if (years.length && !years.includes(year)) setYear(years[0]);
  }, [years]);

  const breakdown = useMemo(
    () => monthlyBreakdown(entries as PeriodRow[], year),
    [entries, year],
  );
  const ytd = useMemo(
    () => yearToDateTotals(entries as PeriodRow[], year),
    [entries, year],
  );

  const visible = entries.filter(e => {
    if (Number(String(e.period_month ?? '').slice(0, 4)) !== year) return false;
    return viewMonth === 'all' || monthOfRow(e) === viewMonth;
  });
  const inflows = visible.filter(e => e.direction === 'inflow');
  const outflows = visible.filter(e => e.direction === 'outflow');

  // Actuals for the selected range. A month view shows that month; the year
  // view shows the year's running total. Neither is an annualised run-rate —
  // that lives on the CFP tab, where the advisor picks which months to build on.
  const totalIn = viewMonth === 'all'
    ? ytd.income
    : (breakdown.find(m => m.month === viewMonth)?.income ?? 0);
  const totalOut = viewMonth === 'all'
    ? ytd.expenses
    : (breakdown.find(m => m.month === viewMonth)?.expenses ?? 0);
  const net = totalIn - totalOut;

  const monthName = (m: number) =>
    (language === 'zh' ? MONTH_LABELS : MONTH_LABELS_EN)[m - 1] ?? String(m);
  const rangeLabel = viewMonth === 'all'
    ? t(`${year} total`, `${year} 年累计`)
    : `${year} · ${monthName(viewMonth)}`;

  // A month holding far fewer rows than its neighbours is usually half-entered
  // rather than genuinely lean, and no arithmetic can tell the difference. The
  // report's basis is built from these months, so the gap has to be visible
  // here — this is the exact shape that turned RM 1,548 of spending into RM 128.
  const thinMonths = breakdown.length > 1
    ? breakdown.filter(m => m.entries === 1 && breakdown.some(o => o.entries >= 3))
    : [];
  const catLabel = (code: string) => { const c = categories.find(x => x.code === code); if (!c) return code; return language === 'zh' && c.label_zh ? c.label_zh : c.label; };
  const inflowCats = categories.filter(c => c.direction === 'inflow' || c.direction === 'both');
  const outflowCats = categories.filter(c => c.direction === 'outflow' || c.direction === 'both');

  if (loading) return <Loader />;

  return (
    <div>
      {ok && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm mb-4">✓ {t('Saved successfully.','保存成功。')}</div>}
      {/* Period selector — a row belongs to a month, so the screen is read a
          month (or a year) at a time. */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <select
          value={year}
          onChange={e => { setYear(Number(e.target.value)); setViewMonth('all'); }}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-xin-blue focus:outline-none focus:border-xin-gold"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setViewMonth('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMonth === 'all' ? 'bg-xin-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('Full year', '全年')}
          </button>
          {MONTH_LABELS.map((_, i) => {
            const m = i + 1;
            const has = breakdown.find(b => b.month === m);
            return (
              <button
                key={m}
                onClick={() => setViewMonth(m)}
                title={has ? t(`${has.entries} entries`, `${has.entries} 笔记录`) : t('no data', '无记录')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMonth === m
                    ? 'bg-xin-blue text-white'
                    : has
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-white text-slate-300 border border-slate-100'
                }`}
              >
                {monthName(m)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {[
          { label: t('Income', '收入'), val: totalIn, c: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('Expenses', '支出'), val: totalOut, c: 'text-red-500', bg: 'bg-red-50' },
          { label: t('Net', '净现金流'), val: net, c: net >= 0 ? 'text-xin-blue' : 'text-red-500', bg: net >= 0 ? 'bg-blue-50' : 'bg-red-50' },
        ].map(card => (
          <div key={card.label} className={`${card.bg} rounded-2xl p-4`}>
            <div className="text-xs text-slate-500 font-medium mb-1">{card.label} · {rangeLabel}</div>
            <div className={`text-2xl font-bold ${card.c}`}>RM {fmt(card.val)}</div>
          </div>
        ))}
      </div>

      {/* Per-month record, always visible in the year view. The CFP report is
          annualised from these months, so how much each one holds is not a
          detail — it is the thing the advisor has to judge. */}
      {viewMonth === 'all' && breakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 overflow-hidden">
          <div className="px-5 py-2.5 border-b border-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {t(`Month by month · ${year}`, `${year} 年分月记录`)}
            </span>
            <span className="text-[11px] text-slate-400">
              {t(`${breakdown.length} of 12 months recorded`, `12 个月中已记录 ${breakdown.length} 个`)}
            </span>
          </div>
          {breakdown.map(m => (
            <button
              key={m.month}
              onClick={() => setViewMonth(m.month)}
              className="w-full flex items-center gap-3 px-5 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors text-left"
            >
              <span className="w-12 text-xs font-semibold text-xin-blue">{monthName(m.month)}</span>
              <span className="text-xs text-emerald-600 w-28">+RM {fmt(m.income)}</span>
              <span className="text-xs text-red-500 w-28">−RM {fmt(m.expenses)}</span>
              <span className="text-xs text-slate-400 ml-auto">
                {t(`${m.entries} entries`, `${m.entries} 笔`)}
              </span>
            </button>
          ))}
        </div>
      )}

      {thinMonths.length > 0 && viewMonth === 'all' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            {t(
              `${thinMonths.map(m => monthName(m.month)).join(', ')} holds a single entry while other months hold several. If that month is only half entered, any plan averaged across it will understate this client.`,
              `${thinMonths.map(m => monthName(m.month)).join('、')}只有一笔记录，其他月份有好几笔。如果这个月只录了一半，任何把它平均进去的规划都会低估这位客户。`,
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <EntryTable title={t('Income','收入')} color="text-emerald-600" borderColor="border-emerald-200" entries={inflows} cats={inflowCats} catLabel={catLabel} monthName={monthName} showMonth={viewMonth === 'all'} onAdd={() => setModal('inflow')} onDelete={handleDelete} addLabel={t('Add Income','添加收入')}
          editingId={editingId} editForm={editForm} setEdit={setEdit} onEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} savingEdit={savingEdit} t={t} language={language} />
        <EntryTable title={t('Expenses','支出')} color="text-red-500" borderColor="border-red-200" entries={outflows} cats={outflowCats} catLabel={catLabel} monthName={monthName} showMonth={viewMonth === 'all'} onAdd={() => setModal('outflow')} onDelete={handleDelete} addLabel={t('Add Expense','添加支出')}
          editingId={editingId} editForm={editForm} setEdit={setEdit} onEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} savingEdit={savingEdit} t={t} language={language} />
      </div>
      {modal && (
        <Modal title={modal==='inflow'?t('Add Income','添加收入'):t('Add Expense','添加支出')} onClose={() => setModal(null)}>
          <Fr label={t('Category','类别')}>
            <select value={form.category} onChange={e => set('category', e.target.value)} className={inp}>
              <option value="">—</option>
              {(modal==='inflow'?inflowCats:outflowCats).map((c: any) => <option key={c.code} value={c.code}>{language==='zh'&&c.label_zh?c.label_zh:c.label}</option>)}
            </select>
          </Fr>
          <Fr label={t('Amount (MYR)','金额 (MYR)')}><input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className={inp} placeholder="0.00" /></Fr>
          <Fr label={t('Frequency','频率')}>
            <select value={form.frequency} onChange={e => set('frequency', e.target.value)} className={inp}>
              {FREQ.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Fr>
          <Fr label={t('Belongs to month','归属月份')}>
            <select value={form.month} onChange={e => set('month', Number(e.target.value))} className={inp}>
              {MONTH_LABELS.map((_, i) => (
                <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
              ))}
            </select>
          </Fr>
          <Fr label={t('Note','备注')}><input value={form.source_note} onChange={e => set('source_note', e.target.value)} className={inp} /></Fr>
          <div className="flex items-center gap-2 mb-4"><input type="checkbox" checked={form.is_recurring} onChange={e => set('is_recurring', e.target.checked)} /><label className="text-sm text-slate-600">{t('Recurring','定期')}</label></div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm disabled:opacity-50">{saving?'...':t('Save','保存')}</button>
            <button onClick={() => setModal(null)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">{t('Cancel','取消')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EntryTable({ title, color, borderColor, entries, cats, catLabel, monthName, showMonth, onAdd, onDelete, addLabel, editingId, editForm, setEdit, onEdit, onCancelEdit, onSaveEdit, savingEdit, t, language }: any) {
  // Each row already IS one month's figure, so the total is a plain sum. The
  // old `monthly(e)` converted every row to a monthly rate and summed those,
  // which is what made June's and July's figures look like one position.
  const total = entries.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  return (
    <div className={`bg-white rounded-2xl border ${borderColor} overflow-hidden shadow-sm`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
        <span className={`font-semibold text-sm ${color}`}>{title}</span>
        <button onClick={onAdd} className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors ${color}`}><Plus size={12} />{addLabel}</button>
      </div>
      {entries.length === 0 ? <div className="p-8 text-center text-slate-300 text-sm">—</div> : (
        <>
          {entries.map((e: any) => (
            editingId === e.id ? (
              <div key={e.id} className="px-5 py-3 border-b border-slate-50 last:border-0 bg-slate-50/60">
                <Fr label={t('Category','类别')}>
                  <select value={editForm.category} onChange={ev => setEdit('category', ev.target.value)} className={inp}>
                    {cats.map((c: any) => <option key={c.code} value={c.code}>{language==='zh'&&c.label_zh?c.label_zh:c.label}</option>)}
                  </select>
                </Fr>
                <Fr label={t('Amount (MYR)','金额 (MYR)')}><input type="number" value={editForm.amount} onChange={ev => setEdit('amount', ev.target.value)} className={inp} placeholder="0.00" /></Fr>
                <Fr label={t('Frequency','频率')}>
                  <select value={editForm.frequency} onChange={ev => setEdit('frequency', ev.target.value)} className={inp}>
                    {FREQ.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Fr>
                <Fr label={t('Belongs to month','归属月份')}>
                  <select value={editForm.month} onChange={ev => setEdit('month', Number(ev.target.value))} className={inp}>
                    {MONTH_LABELS.map((_, i) => (
                      <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
                    ))}
                  </select>
                </Fr>
                <Fr label={t('Note','备注')}><input value={editForm.source_note} onChange={ev => setEdit('source_note', ev.target.value)} className={inp} /></Fr>
                <div className="flex items-center gap-2 mb-3"><input type="checkbox" checked={editForm.is_recurring} onChange={ev => setEdit('is_recurring', ev.target.checked)} /><label className="text-sm text-slate-600">{t('Recurring','定期')}</label></div>
                <div className="flex gap-2">
                  <button onClick={() => onSaveEdit(e)} disabled={savingEdit} className="px-4 py-2 bg-xin-blue text-white font-semibold rounded-lg text-sm disabled:opacity-50">{savingEdit?'...':t('Save','保存')}</button>
                  <button onClick={onCancelEdit} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm">{t('Cancel','取消')}</button>
                </div>
              </div>
            ) : (
              <div key={e.id} className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0">
                <div>
                  <div className="text-sm font-medium text-xin-blue">{catLabel(e.category)}</div>
                  <div className="text-xs text-slate-400">
                    {showMonth ? `${monthName(Number(String(e.period_month ?? '').slice(5,7)))} · ` : ''}
                    {e.frequency !== 'monthly' ? `${e.frequency} · ` : ''}
                    {e.source_note || t('no note','无备注')}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${color}`}>RM {fmt(Number(e.amount ?? 0))}</span>
                  <button onClick={() => onEdit(e)} className="text-slate-300 hover:text-xin-blue transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => onDelete(e.id)} className="text-slate-300 hover:text-red-400 transition-colors"><X size={14} /></button>
                </div>
              </div>
            )
          ))}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500">{t('Total','合计')}</span>
            <span className={`text-sm font-bold ${color}`}>RM {fmt(total)}</span>
          </div>
        </>
      )}
    </div>
  );
}

const Modal = ({ title, onClose, children }: any) => (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-xl">
      <div className="flex items-center justify-between mb-5"><h3 className="font-semibold text-xin-blue">{title}</h3><button onClick={onClose} className="text-slate-300 hover:text-slate-500"><X size={18} /></button></div>
      {children}
    </div>
  </div>
);
const Fr = ({ label, children }: any) => <div className="mb-3"><label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>{children}</div>;
const inp = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold';
const Loader = () => <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" /></div>;
const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
