import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { ChevronLeft } from 'lucide-react';

const MY_STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','WP Kuala Lumpur','WP Labuan','WP Putrajaya'];

const INIT = { salutation:'', full_name:'', nric:'', date_of_birth:'', gender:'', nationality:'Malaysian', phone:'', email:'', correspondence_address:'', correspondence_city:'', correspondence_state:'', correspondence_postal_code:'', marital_status:'', number_of_dependants:'0', employment_status:'', occupation:'', employer_name:'', risk_profile:'', retirement_age:'60', epf_account_number:'', status:'prospect' };

export default function NewClient() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();
  const [form, setForm] = useState(INIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) { setError('Full name is required.'); return; }
    setSaving(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
    if (!adv) return;
    const payload: any = { advisor_id: adv.id, full_name: form.full_name.trim(), status: form.status };
    const optional = ['salutation','nric','date_of_birth','gender','nationality','phone','email','correspondence_address','correspondence_city','correspondence_state','correspondence_postal_code','marital_status','occupation','employer_name','risk_profile','epf_account_number'];
    optional.forEach(k => { if ((form as any)[k]) payload[k] = (form as any)[k]; });
    if (form.number_of_dependants) payload.number_of_dependants = parseInt(form.number_of_dependants);
    if (form.retirement_age) payload.retirement_age = parseInt(form.retirement_age);
    if (form.employment_status) payload.employment_status = form.employment_status;
    const { data, error: err } = await supabase.from('clients').insert(payload).select().single();
    if (err) { setError(err.message); setSaving(false); }
    else navigate(`/advisor/clients/${data.id}`);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-xin-blue transition-colors"><ChevronLeft size={22} /></button>
        <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('New Client', '新客户')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card title={t('Personal Information', '个人资料')}>
          <Grid>
            <Field label={t('Salutation', '称谓')}><Sel value={form.salutation} onChange={v => set('salutation', v)} opts={[['','—'],['Mr.','Mr.'],['Mrs.','Mrs.'],['Ms.','Ms.'],['Dr.','Dr.']]} /></Field>
            <Field label={t('Full Name', '全名')} required><Inp value={form.full_name} onChange={v => set('full_name', v)} placeholder="As per NRIC" /></Field>
            <Field label={t('NRIC / Passport', '身份证')}><Inp value={form.nric} onChange={v => set('nric', v)} placeholder="900101-14-1234" /></Field>
            <Field label={t('Date of Birth', '出生日期')}><Inp type="date" value={form.date_of_birth} onChange={v => set('date_of_birth', v)} /></Field>
            <Field label={t('Gender', '性别')}><Sel value={form.gender} onChange={v => set('gender', v)} opts={[['','—'],['male',t('Male','男')],['female',t('Female','女')]]} /></Field>
            <Field label={t('Nationality', '国籍')}><Inp value={form.nationality} onChange={v => set('nationality', v)} /></Field>
            <Field label={t('Phone', '电话')}><Inp value={form.phone} onChange={v => set('phone', v)} placeholder="+60 12-xxx xxxx" /></Field>
            <Field label={t('Email', '邮箱')}><Inp type="email" value={form.email} onChange={v => set('email', v)} /></Field>
            <Field label={t('Marital Status', '婚姻状况')}><Sel value={form.marital_status} onChange={v => set('marital_status', v)} opts={[['','—'],['single',t('Single','单身')],['married',t('Married','已婚')],['divorced',t('Divorced','离婚')],['widowed',t('Widowed','丧偶')]]} /></Field>
            <Field label={t('Dependants', '受赡养人数')}><Inp type="number" value={form.number_of_dependants} onChange={v => set('number_of_dependants', v)} min="0" /></Field>
          </Grid>
        </Card>

        <Card title={t('Address', '地址')}>
          <div className="mb-3"><Field label={t('Street Address', '街道地址')}><Inp value={form.correspondence_address} onChange={v => set('correspondence_address', v)} /></Field></div>
          <Grid>
            <Field label={t('City', '城市')}><Inp value={form.correspondence_city} onChange={v => set('correspondence_city', v)} /></Field>
            <Field label={t('Postcode', '邮政编码')}><Inp value={form.correspondence_postal_code} onChange={v => set('correspondence_postal_code', v)} /></Field>
            <Field label={t('State', '州属')}><Sel value={form.correspondence_state} onChange={v => set('correspondence_state', v)} opts={[['','—'],...MY_STATES.map(s => [s,s] as [string,string])]} /></Field>
          </Grid>
        </Card>

        <Card title={t('Employment', '就业')}>
          <Grid>
            <Field label={t('Status', '状态')}><Sel value={form.employment_status} onChange={v => set('employment_status', v)} opts={[['','—'],['employed',t('Employed','受雇')],['self_employed',t('Self-Employed','自雇')],['unemployed',t('Unemployed','待业')],['retired',t('Retired','退休')],['student',t('Student','学生')]]} /></Field>
            <Field label={t('Occupation', '职业')}><Inp value={form.occupation} onChange={v => set('occupation', v)} /></Field>
            <Field label={t('Employer', '雇主')}><Inp value={form.employer_name} onChange={v => set('employer_name', v)} /></Field>
          </Grid>
        </Card>

        <Card title={t('Financial Profile', '财务资料')}>
          <Grid>
            <Field label={t('Risk Profile', '风险评级')}><Sel value={form.risk_profile} onChange={v => set('risk_profile', v)} opts={[['','—'],['conservative',t('Conservative','保守')],['moderate',t('Moderate','稳健')],['balanced',t('Balanced','平衡')],['growth',t('Growth','成长')],['aggressive',t('Aggressive','进取')]]} /></Field>
            <Field label={t('Retirement Age', '退休年龄')}><Inp type="number" value={form.retirement_age} onChange={v => set('retirement_age', v)} min="40" max="100" /></Field>
            <Field label="EPF Account No."><Inp value={form.epf_account_number} onChange={v => set('epf_account_number', v)} /></Field>
            <Field label={t('Client Status', '客户状态')}><Sel value={form.status} onChange={v => set('status', v)} opts={[['prospect',t('Prospect','潜在')],['active',t('Active','活跃')],['inactive',t('Inactive','非活跃')]]} /></Field>
          </Grid>
        </Card>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-6 py-3 bg-xin-blue text-white font-semibold rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : t('Save', '保存')}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-5 py-3 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors">
            {t('Cancel', '取消')}
          </button>
        </div>
      </form>
    </div>
  );
}

const Card = ({ title, children }: any) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4 border-b border-slate-50 pb-3">{title}</h3>
    {children}
  </div>
);
const Grid = ({ children }: any) => <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>;
const Field = ({ label, children, required }: any) => (
  <div>
    <label className="block text-xs font-medium text-slate-500 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
);
const Inp = ({ value, onChange, type = 'text', placeholder, min, max }: any) => (
  <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} min={min} max={max}
    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors" />
);
const Sel = ({ value, onChange, opts }: any) => (
  <select value={value} onChange={(e: any) => onChange(e.target.value)}
    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors">
    {opts.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}
  </select>
);
