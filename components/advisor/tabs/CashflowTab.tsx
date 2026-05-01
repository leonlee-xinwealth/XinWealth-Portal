import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, X } from 'lucide-react';

const FREQ: [string,string][] = [['monthly','Monthly'],['annual','Annual'],['quarterly','Quarterly'],['semi_annual','Semi-annual'],['one_off','One-off']];

export default function CashflowTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [entries, setEntries] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'inflow'|'outflow'|null>(null);
  const [form, setForm] = useState({ category:'', amount:'', frequency:'monthly', is_recurring:true, source_note:'' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

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
    await supabase.from('cashflow_entries').insert({ client_id: clientId, direction: modal, category: form.category, amount: parseFloat(form.amount), frequency: form.frequency, is_recurring: form.is_recurring, source_note: form.source_note || null, period_month: new Date().toISOString().slice(0,7)+'-01' });
    setSaving(false); setModal(null); setForm({ category:'', amount:'', frequency:'monthly', is_recurring:true, source_note:'' }); load();
  }
  async function handleDelete(id: string) {
    if (!confirm(t('Delete this entry?','确定删除？'))) return;
    await supabase.from('cashflow_entries').delete().eq('id', id); load();
  }

  const inflows = entries.filter(e => e.direction === 'inflow');
  const outflows = entries.filter(e => e.direction === 'outflow');
  const monthly = (e: any) => { const m: any = {monthly:1,quarterly:1/3,semi_annual:1/6,annual:1/12,one_off:0}; return e.amount * (m[e.frequency]??1); };
  const totalIn = inflows.reduce((s,e) => s+monthly(e), 0);
  const totalOut = outflows.reduce((s,e) => s+monthly(e), 0);
  const net = totalIn - totalOut;
  const catLabel = (code: string) => { const c = categories.find(x => x.code === code); if (!c) return code; return language === 'zh' && c.label_zh ? c.label_zh : c.label; };
  const inflowCats = categories.filter(c => c.direction === 'inflow' || c.direction === 'both');
  const outflowCats = categories.filter(c => c.direction === 'outflow' || c.direction === 'both');

  if (loading) return <Loader />;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[{label:t('Monthly Income','月收入'),val:totalIn,c:'text-emerald-600',bg:'bg-emerald-50'},{label:t('Monthly Expenses','月支出'),val:totalOut,c:'text-red-500',bg:'bg-red-50'},{label:t('Net Cash Flow','净现金流'),val:net,c:net>=0?'text-xin-blue':'text-red-500',bg:net>=0?'bg-blue-50':'bg-red-50'}].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
            <div className="text-xs text-slate-500 font-medium mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.c}`}>RM {fmt(s.val)}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <EntryTable title={t('Income','收入')} color="text-emerald-600" borderColor="border-emerald-200" entries={inflows} catLabel={catLabel} monthly={monthly} onAdd={() => setModal('inflow')} onDelete={handleDelete} addLabel={t('Add Income','添加收入')} />
        <EntryTable title={t('Expenses','支出')} color="text-red-500" borderColor="border-red-200" entries={outflows} catLabel={catLabel} monthly={monthly} onAdd={() => setModal('outflow')} onDelete={handleDelete} addLabel={t('Add Expense','添加支出')} />
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

function EntryTable({ title, color, borderColor, entries, catLabel, monthly, onAdd, onDelete, addLabel }: any) {
  const total = entries.reduce((s: number, e: any) => s + monthly(e), 0);
  return (
    <div className={`bg-white rounded-2xl border ${borderColor} overflow-hidden shadow-sm`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
        <span className={`font-semibold text-sm ${color}`}>{title}</span>
        <button onClick={onAdd} className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors ${color}`}><Plus size={12} />{addLabel}</button>
      </div>
      {entries.length === 0 ? <div className="p-8 text-center text-slate-300 text-sm">—</div> : (
        <>
          {entries.map((e: any) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0">
              <div>
                <div className="text-sm font-medium text-xin-blue">{catLabel(e.category)}</div>
                <div className="text-xs text-slate-400">RM {fmt(e.amount)} · {e.frequency}{e.source_note?` · ${e.source_note}`:''}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${color}`}>{fmt(monthly(e))}/mo</span>
                <button onClick={() => onDelete(e.id)} className="text-slate-300 hover:text-red-400 transition-colors"><X size={14} /></button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500">Total / month</span>
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
