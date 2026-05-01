import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, X } from 'lucide-react';

const TYPES: [string,string][] = [['life','Life / 人寿'],['medical','Medical / 医疗'],['critical_illness','Critical Illness / 重疾'],['disability','Disability / 残障'],['investment_linked','Investment-Linked / 投资联结'],['accident','Accident / 意外'],['property','Property / 财产'],['other','Other / 其他']];
const FREQ: [string,string][] = [['monthly','Monthly'],['quarterly','Quarterly'],['semi_annual','Semi-annual'],['annual','Annual'],['single_premium','Single Premium']];
const EMPTY = { policy_type:'', provider:'', policy_number:'', sum_assured:'', cash_value:'', premium:'', premium_frequency:'annual', insured_person:'', start_date:'', end_date:'' };

const TYPE_COLORS: Record<string,string> = { life:'bg-blue-50 text-blue-700', medical:'bg-teal-50 text-teal-700', critical_illness:'bg-red-50 text-red-700', disability:'bg-purple-50 text-purple-700', investment_linked:'bg-amber-50 text-amber-700', accident:'bg-orange-50 text-orange-700', property:'bg-green-50 text-green-700', other:'bg-slate-100 text-slate-600' };

export default function InsuranceTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function load() {
    const { data } = await supabase.from('insurance_policies').select('*').eq('client_id', clientId).order('policy_type');
    setPolicies(data || []); setLoading(false);
  }
  useEffect(() => { load(); }, [clientId]);

  async function handleAdd() {
    if (!form.provider) return;
    setSaving(true);
    await supabase.from('insurance_policies').insert({ client_id: clientId, policy_type: form.policy_type||'other', provider: form.provider, policy_number: form.policy_number||null, sum_assured: form.sum_assured?parseFloat(form.sum_assured):null, cash_value: form.cash_value?parseFloat(form.cash_value):null, premium: form.premium?parseFloat(form.premium):null, premium_frequency: form.premium_frequency||null, insured_person: form.insured_person||null, start_date: form.start_date||null, end_date: form.end_date||null });
    setSaving(false); setShowForm(false); setForm(EMPTY); load();
  }
  async function handleDelete(id: string) {
    if (!confirm(t('Delete this policy?','确定删除？'))) return;
    await supabase.from('insurance_policies').delete().eq('id', id); load();
  }

  const totalSA = policies.reduce((s,p) => s+(p.sum_assured||0), 0);
  const totalAP = policies.reduce((s,p) => { if (!p.premium) return s; const m: any={monthly:12,quarterly:4,semi_annual:2,annual:1,single_premium:0}; return s+p.premium*(m[p.premium_frequency||'annual']??1); }, 0);
  const typeLabel = (type: string) => TYPES.find(([v]) => v===type)?.[1]||type;
  const freqLabel = (f: string) => FREQ.find(([v]) => v===f)?.[1]||f;

  if (loading) return <Loader />;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SumCard label={t('Policies','保单数量')} value={String(policies.length)} color="text-purple-600" bg="bg-purple-50" />
        <SumCard label={t('Total Sum Assured','总保额')} value={`RM ${fmt(totalSA)}`} color="text-xin-blue" bg="bg-blue-50" />
        <SumCard label={t('Annual Premium','年保费')} value={`RM ${fmt(totalAP)}`} color="text-amber-600" bg="bg-amber-50" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-xin-blue">{t('Insurance Policies','保险保单')}</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors">
          <Plus size={14} />{t('Add Policy','添加保单')}
        </button>
      </div>

      {policies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm shadow-sm">
          {t('No insurance policies added yet.','还没有保单记录。')}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm relative">
              <button onClick={() => handleDelete(p.id)} className="absolute top-4 right-4 text-slate-200 hover:text-red-400 transition-colors"><X size={14} /></button>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_COLORS[p.policy_type]||TYPE_COLORS.other}`}>{typeLabel(p.policy_type)}</span>
              <div className="mt-3 mb-1 font-bold text-xin-blue text-base">{p.provider}</div>
              {p.policy_number && <div className="text-xs text-slate-400 mb-3">#{p.policy_number}</div>}
              {p.insured_person && <div className="text-xs text-slate-500 mb-3">Insured: {p.insured_person}</div>}
              <div className="grid grid-cols-2 gap-y-2 gap-x-3 mt-2">
                {p.sum_assured && <Kv label="Sum Assured" val={`RM ${fmt(p.sum_assured)}`} />}
                {p.premium && <Kv label="Premium" val={`RM ${fmt(p.premium)} / ${freqLabel(p.premium_frequency||'annual')}`} />}
                {p.cash_value && <Kv label="Cash Value" val={`RM ${fmt(p.cash_value)}`} />}
                {p.start_date && <Kv label="Start" val={p.start_date} />}
                {p.end_date && <Kv label="Maturity" val={p.end_date} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-xin-blue">{t('Add Policy','添加保单')}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-300 hover:text-slate-500"><X size={18} /></button>
            </div>
            <Fr label={t('Policy Type','保险类型')}><Sel value={form.policy_type} onChange={v => set('policy_type',v)} opts={[['','—'],...TYPES]} /></Fr>
            <Fr label={`${t('Provider','保险公司')} *`}><Inp value={form.provider} onChange={v => set('provider',v)} placeholder="e.g. AIA, Prudential" /></Fr>
            <Fr label={t('Policy Number','保单号码')}><Inp value={form.policy_number} onChange={v => set('policy_number',v)} /></Fr>
            <Fr label={t('Insured Person','被保人')}><Inp value={form.insured_person} onChange={v => set('insured_person',v)} /></Fr>
            <div className="grid grid-cols-2 gap-3">
              <Fr label={t('Sum Assured (RM)','保额')}><Inp type="number" value={form.sum_assured} onChange={v => set('sum_assured',v)} placeholder="0" /></Fr>
              <Fr label={t('Cash Value (RM)','现金价值')}><Inp type="number" value={form.cash_value} onChange={v => set('cash_value',v)} placeholder="0" /></Fr>
              <Fr label={t('Premium (RM)','保费')}><Inp type="number" value={form.premium} onChange={v => set('premium',v)} placeholder="0" /></Fr>
              <Fr label={t('Frequency','频率')}><Sel value={form.premium_frequency} onChange={v => set('premium_frequency',v)} opts={FREQ} /></Fr>
              <Fr label={t('Start Date','开始日期')}><Inp type="date" value={form.start_date} onChange={v => set('start_date',v)} /></Fr>
              <Fr label={t('End Date','到期')}><Inp type="date" value={form.end_date} onChange={v => set('end_date',v)} /></Fr>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={handleAdd} disabled={saving} className="px-5 py-2.5 bg-purple-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50">{saving?'...':t('Save','保存')}</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">{t('Cancel','取消')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SumCard = ({ label, value, color, bg }: any) => <div className={`${bg} rounded-2xl p-4`}><div className="text-xs text-slate-500 font-medium mb-1">{label}</div><div className={`text-xl font-bold ${color}`}>{value}</div></div>;
const Kv = ({ label, val }: any) => <div><div className="text-[10px] text-slate-400 font-medium">{label}</div><div className="text-xs font-semibold text-xin-blue">{val}</div></div>;
const Fr = ({ label, children }: any) => <div className="mb-3"><label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>{children}</div>;
const Inp = ({ value, onChange, type='text', placeholder }: any) => <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold" />;
const Sel = ({ value, onChange, opts }: any) => <select value={value} onChange={(e: any) => onChange(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white">{opts.map(([v,l]: any) => <option key={v} value={v}>{l}</option>)}</select>;
const Loader = () => <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" /></div>;
const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits:0, maximumFractionDigits:0 });
