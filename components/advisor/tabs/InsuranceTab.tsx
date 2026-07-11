import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, X } from 'lucide-react';
import InsuranceGapPanel from '../components/InsuranceGapPanel';

const TYPES: [string,string][] = [['life','Life / 人寿'],['medical','Medical / 医疗'],['critical_illness','Critical Illness / 重疾'],['disability','Disability / 残障'],['investment_linked','Investment-Linked / 投资联结'],['accident','Accident / 意外'],['property','Property / 财产'],['other','Other / 其他']];
// Curated subset offered when picking a NEW base plan's type — every plan carries a base
// death/TPD life benefit, so the choice here is really "what kind of base plan is this".
const BASE_TYPES: [string,string][] = [['investment_linked','Investment-Linked (ILP) / 投资连结'],['life','Traditional / Term Life / 传统人寿'],['medical','Standalone Medical Card / 独立医疗卡'],['other','Other / 其他']];
const FREQ: [string,string][] = [['monthly','Monthly'],['quarterly','Quarterly'],['semi_annual','Semi-annual'],['annual','Annual'],['single_premium','Single Premium']];
// Malaysian policies separate the premium PAYMENT term (how long you pay) from the
// COVERAGE term (how long you're covered) — e.g. pay 20 years but covered to age 80.
const TERM_UNITS: [string,string][] = [['years','Years / 年'],['to_age','To Age / 到岁数']];
const EMPTY = { policy_type:'', provider:'', plan_name:'', plan_id:'', policy_holder:'', policy_number:'', sum_assured:'', cash_value:'', premium:'', premium_frequency:'annual', insured_person:'', start_date:'', end_date:'', premium_term_value:'', premium_term_unit:'', coverage_term_value:'', coverage_term_unit:'', riders: [] as RiderForm[] };

const TYPE_COLORS: Record<string,string> = { life:'bg-blue-50 text-blue-700', medical:'bg-teal-50 text-teal-700', critical_illness:'bg-red-50 text-red-700', disability:'bg-purple-50 text-purple-700', investment_linked:'bg-amber-50 text-amber-700', accident:'bg-orange-50 text-orange-700', property:'bg-green-50 text-green-700', other:'bg-slate-100 text-slate-600' };

// Rider categories a client-facing rider can be tagged with. 'life' covers additional
// death/TPD riders on top of the base plan; the rest mirror the insurance catalog's
// rider categories so per-client data lines up with it.
const RIDER_CATEGORIES: [string,string][] = [['life','Life / 人寿'],['medical','Medical / 医疗'],['critical_illness','Critical Illness / 重疾'],['cancer','Cancer / 癌症'],['accident','Accident / 意外'],['income','Income / 收入保障'],['disability','Disability / 残障'],['payor','Payor / 保费豁免'],['other','Other / 其他']];
const RIDER_CATEGORY_COLORS: Record<string,string> = { life:'bg-blue-50 text-blue-700', medical:'bg-teal-50 text-teal-700', critical_illness:'bg-red-50 text-red-700', cancer:'bg-pink-50 text-pink-700', accident:'bg-orange-50 text-orange-700', income:'bg-indigo-50 text-indigo-700', disability:'bg-purple-50 text-purple-700', payor:'bg-slate-100 text-slate-600', other:'bg-slate-100 text-slate-600' };
// Catalog rider category -> per-client rider category, so picking a catalog rider auto-tags it.
const CATEGORY_NORMALIZE: Record<string,string> = { medical_addon:'medical', ci:'critical_illness', cancer:'cancer', accident:'accident', income:'income', payor:'payor' };
const normalizeCategory = (cat: string) => CATEGORY_NORMALIZE[cat] || 'other';
const riderCategoryLabel = (c: string) => RIDER_CATEGORIES.find(([v]) => v===c)?.[1] || c;

type RiderForm = {
  key: string; rider_id: string; rider_name: string; category: string;
  sum_assured: string;
  premium_term_value: string; premium_term_unit: string; coverage_term_value: string; coverage_term_unit: string;
  tier_name: string; room_board_daily: string; annual_limit: string; lifetime_limit: string;
  pre_hosp_days: string; post_hosp_days: string; icu_days: string;
  copay_type: string; copay_amount: string; copay_basis: string; copay_cap: string;
};
const emptyRider = (): RiderForm => ({ key: Math.random().toString(36).slice(2), rider_id:'', rider_name:'', category:'', sum_assured:'', premium_term_value:'', premium_term_unit:'', coverage_term_value:'', coverage_term_unit:'', tier_name:'', room_board_daily:'', annual_limit:'', lifetime_limit:'', pre_hosp_days:'', post_hosp_days:'', icu_days:'', copay_type:'', copay_amount:'', copay_basis:'', copay_cap:'' });

const copayBasisShort = (b: string) => b === 'per_disability' ? 'disability' : b === 'per_year' ? 'year' : b;
function medicalSummary(r: any): string {
  const parts: string[] = [];
  if (r.room_board_daily) parts.push(`R&B RM${fmt(r.room_board_daily)}`);
  if (r.annual_limit) parts.push(`Annual RM${fmt(r.annual_limit)}`);
  else if (r.lifetime_limit) parts.push(`Lifetime RM${fmt(r.lifetime_limit)}`);
  if (r.copay_type === 'deductible' && r.copay_amount) parts.push(`Ded RM${fmt(r.copay_amount)}${r.copay_basis ? '/'+copayBasisShort(r.copay_basis) : ''}`);
  if (r.copay_type === 'co_insurance' && r.copay_amount) parts.push(`Co-ins ${r.copay_amount}%${r.copay_cap ? ` (cap RM${fmt(r.copay_cap)})` : ''}`);
  return parts.join(' · ');
}
const termPart = (value: any, unit: string) => !value ? '' : unit === 'to_age' ? `to age ${value}` : `${value} yrs`;
function termSummary(o: any): string {
  const pay = termPart(o.premium_term_value, o.premium_term_unit);
  const cov = termPart(o.coverage_term_value, o.coverage_term_unit);
  if (pay && cov) return `Pay ${pay} · Cover ${cov}`;
  if (pay) return `Pay ${pay}`;
  if (cov) return `Cover ${cov}`;
  return '';
}

export default function InsuranceTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [policies, setPolicies] = useState<any[]>([]);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [catalogRiders, setCatalogRiders] = useState<any[]>([]);
  const [planRiders, setPlanRiders] = useState<any[]>([]);
  const [riderTiersCache, setRiderTiersCache] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function load() {
    const { data } = await supabase.from('insurance_policies').select('*, policy_riders(*)').eq('client_id', clientId).order('policy_type').order('sort_order', { foreignTable: 'policy_riders' });
    setPolicies(data || []); setLoading(false);
  }
  useEffect(() => { load(); }, [clientId]);

  // Load the insurance catalog once (public-read) to power the company + plan + rider pickers.
  useEffect(() => {
    (async () => {
      const [ins, pl, rd, pr] = await Promise.all([
        supabase.from('insurers').select('id,name,short_name').order('name'),
        supabase.from('plans').select('id,name,insurer_id').order('name'),
        supabase.from('riders').select('id,insurer_id,name,category').order('name'),
        supabase.from('plan_riders').select('plan_id,rider_id'),
      ]);
      setInsurers(ins.data || []); setPlans(pl.data || []); setCatalogRiders(rd.data || []); setPlanRiders(pr.data || []);
    })();
  }, []);

  // If a new company is typed that isn't in the catalog yet, add it so future policies
  // (for this or other clients) can pick it from the dropdown.
  async function ensureInsurer(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = insurers.some(i => i.name.toLowerCase() === trimmed.toLowerCase() || (i.short_name || '').toLowerCase() === trimmed.toLowerCase());
    if (exists) return;
    const { data, error } = await supabase.from('insurers').insert({ name: trimmed, short_name: trimmed }).select('id,name,short_name').single();
    if (!error && data) setInsurers(prev => [...prev, data]);
  }

  // Provider free-text matched back to a catalog insurer (by full or short name).
  const matchedInsurer = insurers.find(i => i.name === form.provider || i.short_name === form.provider);
  const planOptions = matchedInsurer ? plans.filter(p => p.insurer_id === matchedInsurer.id) : plans;
  // Riders narrow to the selected plan's own riders when a catalog plan is picked (e.g. "180 CI
  // Care" only belongs to HLA CompleteCover); otherwise fall back to the company, then to all.
  const riderOptions = form.plan_id
    ? catalogRiders.filter(r => planRiders.some(pr => pr.plan_id === form.plan_id && pr.rider_id === r.id))
    : matchedInsurer
    ? catalogRiders.filter(r => r.insurer_id === matchedInsurer.id)
    : catalogRiders;
  const setPlan = (v: string) => {
    const hit = plans.find(p => p.name === v && (!matchedInsurer || p.insurer_id === matchedInsurer.id));
    setForm(p => ({ ...p, plan_name: v, plan_id: hit?.id || '' }));
  };
  // Clearing the provider or switching to one whose plans no longer include the
  // typed plan should drop a stale hard link but keep the free-text name.
  const setProvider = (v: string) => {
    setForm(p => {
      const mi = insurers.find(i => i.name === v || i.short_name === v);
      const hit = plans.find(pl => pl.name === p.plan_name && (!mi || pl.insurer_id === mi.id));
      return { ...p, provider: v, plan_id: hit?.id || '' };
    });
  };

  const setRider = (idx: number, patch: Partial<RiderForm>) => setForm(p => ({ ...p, riders: p.riders.map((r,i) => i===idx ? { ...r, ...patch } : r) }));
  const addRider = () => setForm(p => ({ ...p, riders: [...p.riders, emptyRider()] }));
  const removeRider = (idx: number) => setForm(p => ({ ...p, riders: p.riders.filter((_,i) => i!==idx) }));

  async function loadTiersFor(riderId: string) {
    if (riderTiersCache[riderId]) return riderTiersCache[riderId];
    const { data } = await supabase.from('rider_tiers').select('id,tier_name,room_board_daily,annual_limit,lifetime_limit,deductible_min,deductible_unit,co_insurance_pct,co_insurance_cap,sort_order').eq('rider_id', riderId).order('sort_order');
    const tiers = data || [];
    setRiderTiersCache(c => ({ ...c, [riderId]: tiers }));
    return tiers;
  }

  function applyTier(idx: number, tier: any) {
    const copay = tier.deductible_min != null
      ? { copay_type:'deductible', copay_amount:String(tier.deductible_min), copay_basis: tier.deductible_unit||'', copay_cap:'' }
      : tier.co_insurance_pct != null
      ? { copay_type:'co_insurance', copay_amount:String(tier.co_insurance_pct), copay_basis:'', copay_cap: tier.co_insurance_cap!=null?String(tier.co_insurance_cap):'' }
      : { copay_type:'', copay_amount:'', copay_basis:'', copay_cap:'' };
    setRider(idx, {
      tier_name: tier.tier_name || '',
      room_board_daily: tier.room_board_daily!=null ? String(tier.room_board_daily) : '',
      annual_limit: tier.annual_limit!=null ? String(tier.annual_limit) : '',
      lifetime_limit: tier.lifetime_limit!=null ? String(tier.lifetime_limit) : '',
      ...copay,
    });
  }

  async function setRiderName(idx: number, value: string) {
    const hit = riderOptions.find(r => r.name === value);
    if (!hit) { setRider(idx, { rider_name: value, rider_id: '' }); return; }
    const category = normalizeCategory(hit.category);
    setRider(idx, { rider_name: value, rider_id: hit.id, category });
    if (category === 'medical') {
      const tiers = await loadTiersFor(hit.id);
      if (tiers.length === 1) applyTier(idx, tiers[0]);
    }
  }

  async function handleAdd() {
    if (!form.provider) return;
    setSaving(true);
    await ensureInsurer(form.provider);
    const { data: inserted, error } = await supabase.from('insurance_policies').insert({ client_id: clientId, policy_type: form.policy_type||'other', provider: form.provider, plan_name: form.plan_name||null, plan_id: form.plan_id||null, policy_holder: form.policy_holder||null, policy_number: form.policy_number||null, sum_assured: form.sum_assured?parseFloat(form.sum_assured):null, cash_value: form.cash_value?parseFloat(form.cash_value):null, premium: form.premium?parseFloat(form.premium):null, premium_frequency: form.premium_frequency||null, insured_person: form.insured_person||null, start_date: form.start_date||null, end_date: form.end_date||null, premium_term_value: form.premium_term_value?parseFloat(form.premium_term_value):null, premium_term_unit: form.premium_term_unit||null, coverage_term_value: form.coverage_term_value?parseFloat(form.coverage_term_value):null, coverage_term_unit: form.coverage_term_unit||null }).select('id').single();
    if (!error && inserted) {
      const riderRows = form.riders.filter(r => r.rider_name).map((r, i) => ({
        policy_id: inserted.id,
        rider_id: r.rider_id || null,
        rider_name: r.rider_name,
        category: r.category || 'other',
        sum_assured: r.sum_assured ? parseFloat(r.sum_assured) : null,
        premium_term_value: r.premium_term_value ? parseFloat(r.premium_term_value) : null,
        premium_term_unit: r.premium_term_unit || null,
        coverage_term_value: r.coverage_term_value ? parseFloat(r.coverage_term_value) : null,
        coverage_term_unit: r.coverage_term_unit || null,
        tier_name: r.tier_name || null,
        room_board_daily: r.room_board_daily ? parseFloat(r.room_board_daily) : null,
        annual_limit: r.annual_limit ? parseFloat(r.annual_limit) : null,
        lifetime_limit: r.lifetime_limit ? parseFloat(r.lifetime_limit) : null,
        pre_hosp_days: r.pre_hosp_days ? parseInt(r.pre_hosp_days,10) : null,
        post_hosp_days: r.post_hosp_days ? parseInt(r.post_hosp_days,10) : null,
        icu_days: r.icu_days ? parseInt(r.icu_days,10) : null,
        copay_type: r.copay_type || null,
        copay_amount: r.copay_amount ? parseFloat(r.copay_amount) : null,
        copay_basis: r.copay_basis || null,
        copay_cap: r.copay_cap ? parseFloat(r.copay_cap) : null,
        sort_order: i,
      }));
      if (riderRows.length) await supabase.from('policy_riders').insert(riderRows);
    }
    setSaving(false); setShowForm(false); setForm(EMPTY); load();
  }
  async function handleDelete(id: string) {
    if (!confirm(t('Delete this policy?','确定删除？'))) return;
    await supabase.from('insurance_policies').delete().eq('id', id); load();
  }
  async function handleDeleteRider(id: string) {
    await supabase.from('policy_riders').delete().eq('id', id); load();
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

      <InsuranceGapPanel clientId={clientId} />

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
              {p.plan_name && <div className="text-sm text-slate-600 -mt-0.5 mb-1">{p.plan_name}</div>}
              {p.policy_number && <div className="text-xs text-slate-400 mb-3">#{p.policy_number}</div>}
              {p.policy_holder && <div className="text-xs text-slate-500">Policy Holder: {p.policy_holder}</div>}
              {p.insured_person && <div className="text-xs text-slate-500 mb-3">Life Assured: {p.insured_person}</div>}
              <div className="grid grid-cols-2 gap-y-2 gap-x-3 mt-2">
                {p.sum_assured && <Kv label="Death/TPD Sum Assured" val={`RM ${fmt(p.sum_assured)}`} />}
                {p.premium && <Kv label="Premium" val={`RM ${fmt(p.premium)} / ${freqLabel(p.premium_frequency||'annual')}`} />}
                {p.cash_value && <Kv label="Cash Value" val={`RM ${fmt(p.cash_value)}`} />}
                {p.start_date && <Kv label="Start" val={p.start_date} />}
                {p.end_date && <Kv label="Maturity" val={p.end_date} />}
              </div>
              {termSummary(p) && <div className="text-[11px] text-slate-400 mt-2">{termSummary(p)}</div>}
              {p.policy_riders && p.policy_riders.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                  {p.policy_riders.map((r: any) => (
                    <div key={r.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${RIDER_CATEGORY_COLORS[r.category]||RIDER_CATEGORY_COLORS.other}`}>{riderCategoryLabel(r.category)}</span>
                          <span className="text-xs font-semibold text-xin-blue truncate">{r.rider_name}</span>
                        </div>
                        {r.sum_assured && <div className="text-[11px] text-slate-500">RM {fmt(r.sum_assured)}</div>}
                        {r.category === 'medical' && medicalSummary(r) && <div className="text-[11px] text-slate-400">{medicalSummary(r)}</div>}
                        {termSummary(r) && <div className="text-[11px] text-slate-400">{termSummary(r)}</div>}
                      </div>
                      <button onClick={() => handleDeleteRider(r.id)} className="text-slate-200 hover:text-red-400 shrink-0 mt-0.5"><X size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
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
            <Fr label={t('Base Plan Type','基础计划类型')}><Sel value={form.policy_type} onChange={v => set('policy_type',v)} opts={[['','—'],...BASE_TYPES]} /></Fr>
            <Fr label={`${t('Insurance Company','保险公司')} *`}><Combo value={form.provider} onChange={setProvider} list="insurer-list" opts={insurers.map(i => i.name)} placeholder="e.g. AIA, Prudential" /></Fr>
            <Fr label={t('Plan Name','计划名称')}><Combo value={form.plan_name} onChange={setPlan} list="plan-list" opts={planOptions.map(p => p.name)} placeholder={t('Select or type plan','选择或输入计划')} /></Fr>
            <Fr label={t('Policy Number','保单号码')}><Inp value={form.policy_number} onChange={v => set('policy_number',v)} /></Fr>
            <Fr label={t('Policy Holder','保单持有人')}><Inp value={form.policy_holder} onChange={v => set('policy_holder',v)} /></Fr>
            <Fr label={t('Life Assured','受保人')}><Inp value={form.insured_person} onChange={v => set('insured_person',v)} /></Fr>
            <div className="grid grid-cols-2 gap-3">
              <Fr label={t('Death / TPD Sum Assured (RM)','身故·全残保额')}><Inp type="number" value={form.sum_assured} onChange={v => set('sum_assured',v)} placeholder="0" /></Fr>
              <Fr label={t('Cash Value (RM)','现金价值')}><Inp type="number" value={form.cash_value} onChange={v => set('cash_value',v)} placeholder="0" /></Fr>
              <Fr label={t('Premium (RM)','保费')}><Inp type="number" value={form.premium} onChange={v => set('premium',v)} placeholder="0" /></Fr>
              <Fr label={t('Frequency','频率')}><Sel value={form.premium_frequency} onChange={v => set('premium_frequency',v)} opts={FREQ} /></Fr>
              <TermField label={t('Premium Payment Term','缴费年限')} value={form.premium_term_value} unit={form.premium_term_unit} onValue={(v: string) => set('premium_term_value',v)} onUnit={(v: string) => set('premium_term_unit',v)} />
              <TermField label={t('Coverage Term','保障年限')} value={form.coverage_term_value} unit={form.coverage_term_unit} onValue={(v: string) => set('coverage_term_value',v)} onUnit={(v: string) => set('coverage_term_unit',v)} />
              <Fr label={t('Start Date','开始日期')}><Inp type="date" value={form.start_date} onChange={v => set('start_date',v)} /></Fr>
              <Fr label={t('End Date','到期')}><Inp type="date" value={form.end_date} onChange={v => set('end_date',v)} /></Fr>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500">{t('Riders','附加险')}</h4>
                <button type="button" onClick={addRider} className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"><Plus size={12} />{t('Add Rider','添加附加险')}</button>
              </div>
              {form.riders.length === 0 && <div className="text-xs text-slate-400 mb-2">{t('No riders added.','未添加附加险。')}</div>}
              {form.riders.map((r, idx) => {
                const tiers = r.rider_id ? (riderTiersCache[r.rider_id] || []) : [];
                return (
                  <div key={r.key} className="bg-slate-50 rounded-xl p-3 mb-2 relative">
                    <button type="button" onClick={() => removeRider(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-400"><X size={12} /></button>
                    <div className="grid grid-cols-2 gap-2 pr-5">
                      <Fr label={t('Rider Name','附加险名称')}><Combo value={r.rider_name} onChange={(v: string) => setRiderName(idx,v)} list={`rider-list-${idx}`} opts={riderOptions.map(x => x.name)} placeholder={t('Select or type','选择或输入')} /></Fr>
                      <Fr label={t('Category','分类')}><Sel value={r.category} onChange={(v: string) => setRider(idx,{category:v})} opts={[['','—'],...RIDER_CATEGORIES]} /></Fr>
                      <Fr label={t('Sum Assured / Benefit (RM)','保额/赔付')}><Inp type="number" value={r.sum_assured} onChange={(v: string) => setRider(idx,{sum_assured:v})} placeholder="0" /></Fr>
                      <TermField label={t('Premium Payment Term','缴费年限')} value={r.premium_term_value} unit={r.premium_term_unit} onValue={(v: string) => setRider(idx,{premium_term_value:v})} onUnit={(v: string) => setRider(idx,{premium_term_unit:v})} />
                      <TermField label={t('Coverage Term','保障年限')} value={r.coverage_term_value} unit={r.coverage_term_unit} onValue={(v: string) => setRider(idx,{coverage_term_value:v})} onUnit={(v: string) => setRider(idx,{coverage_term_unit:v})} />
                    </div>
                    {r.category === 'medical' && (
                      <div className="mt-1 pt-2 border-t border-slate-200">
                        {tiers.length > 0 && (
                          <Fr label={t('Tier','等级')}>
                            <Sel value={r.tier_name} onChange={(v: string) => { const tier = tiers.find((tt: any) => tt.tier_name===v); if (tier) applyTier(idx, tier); else setRider(idx,{tier_name:v}); }} opts={[['','—'],...tiers.map((tt: any) => [tt.tier_name, tt.tier_name])]} />
                          </Fr>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Fr label={t('R&B / day (RM)','病房津贴/天')}><Inp type="number" value={r.room_board_daily} onChange={(v: string) => setRider(idx,{room_board_daily:v})} placeholder="0" /></Fr>
                          <Fr label={t('Annual Limit (RM)','年度限额')}><Inp type="number" value={r.annual_limit} onChange={(v: string) => setRider(idx,{annual_limit:v})} placeholder="0" /></Fr>
                          <Fr label={t('Lifetime Limit (RM)','终身限额')}><Inp type="number" value={r.lifetime_limit} onChange={(v: string) => setRider(idx,{lifetime_limit:v})} placeholder={t('Unlimited','无限额')} /></Fr>
                          <Fr label={t('ICU Max Days','ICU 最多天数')}><Inp type="number" value={r.icu_days} onChange={(v: string) => setRider(idx,{icu_days:v})} placeholder="0" /></Fr>
                          <Fr label={t('Pre-hosp Days','住院前天数')}><Inp type="number" value={r.pre_hosp_days} onChange={(v: string) => setRider(idx,{pre_hosp_days:v})} placeholder="0" /></Fr>
                          <Fr label={t('Post-hosp Days','出院后天数')}><Inp type="number" value={r.post_hosp_days} onChange={(v: string) => setRider(idx,{post_hosp_days:v})} placeholder="0" /></Fr>
                          <Fr label={t('Co-payment Type','自付类型')}><Sel value={r.copay_type} onChange={(v: string) => setRider(idx,{copay_type:v})} opts={[['','—'],['deductible',t('Deductible','免赔额')],['co_insurance',t('Co-insurance','共同保险')],['none',t('None','无')]]} /></Fr>
                          <Fr label={t('Co-payment Basis','计算方式')}><Sel value={r.copay_basis} onChange={(v: string) => setRider(idx,{copay_basis:v})} opts={[['','—'],['per_year',t('Per Year','每年')],['per_disability',t('Per Disability','每次患病')]]} /></Fr>
                          <Fr label={t('Co-payment Amount','自付金额/比例')}><Inp type="number" value={r.copay_amount} onChange={(v: string) => setRider(idx,{copay_amount:v})} placeholder="0" /></Fr>
                          <Fr label={t('Co-payment Cap (RM)','自付上限')}><Inp type="number" value={r.copay_cap} onChange={(v: string) => setRider(idx,{copay_cap:v})} placeholder="0" /></Fr>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
const Combo = ({ value, onChange, list, opts, placeholder }: any) => <><input list={list} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold" /><datalist id={list}>{opts.map((o: string) => <option key={o} value={o} />)}</datalist></>;
const Sel = ({ value, onChange, opts }: any) => <select value={value} onChange={(e: any) => onChange(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white">{opts.map(([v,l]: any) => <option key={v} value={v}>{l}</option>)}</select>;
const TermField = ({ label, value, unit, onValue, onUnit }: any) => <Fr label={label}><div className="flex gap-2"><input type="number" value={value} onChange={(e: any) => onValue(e.target.value)} placeholder="0" className="w-2/3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold" /><select value={unit} onChange={(e: any) => onUnit(e.target.value)} className="w-1/3 px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white"><option value="">—</option>{TERM_UNITS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div></Fr>;
const Loader = () => <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" /></div>;
const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits:0, maximumFractionDigits:0 });
