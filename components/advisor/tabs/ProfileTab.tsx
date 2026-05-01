import React, { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';

const MY_STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','WP Kuala Lumpur','WP Labuan','WP Putrajaya'];

export default function ProfileTab({ client, onSave }: { client: any; onSave: () => void }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...client });
  const [ok, setOk] = useState(false);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true);
    await supabase.from('clients').update({
      salutation: form.salutation, full_name: form.full_name, nric: form.nric,
      date_of_birth: form.date_of_birth || null, gender: form.gender || null,
      nationality: form.nationality, phone: form.phone, email: form.email,
      correspondence_address: form.correspondence_address, correspondence_city: form.correspondence_city,
      correspondence_state: form.correspondence_state, correspondence_postal_code: form.correspondence_postal_code,
      marital_status: form.marital_status || null, number_of_dependants: form.number_of_dependants,
      employment_status: form.employment_status || null, occupation: form.occupation, employer_name: form.employer_name,
      risk_profile: form.risk_profile || null, retirement_age: form.retirement_age,
      epf_account_number: form.epf_account_number, status: form.status,
    }).eq('id', client.id);
    setSaving(false); setEditing(false); setOk(true); onSave();
    setTimeout(() => setOk(false), 3000);
  }

  const v = editing ? form : client;

  return (
    <div>
      {ok && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm mb-4">✓ {t('Saved successfully.','保存成功。')}</div>}
      <div className="flex justify-end mb-4 gap-2">
        {editing ? (
          <>
            <Btn onClick={handleSave} primary disabled={saving}>{saving ? '...' : t('Save','保存')}</Btn>
            <Btn onClick={() => { setForm({ ...client }); setEditing(false); }}>{t('Cancel','取消')}</Btn>
          </>
        ) : (
          <Btn onClick={() => setEditing(true)} primary>✏️ {t('Edit','编辑')}</Btn>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={t('Personal','个人资料')}>
          <Row label={t('Salutation','称谓')}>{editing ? <Sel value={form.salutation||''} onChange={v2 => set('salutation',v2)} opts={[['','—'],['Mr.','Mr.'],['Mrs.','Mrs.'],['Ms.','Ms.'],['Dr.','Dr.']]} /> : v.salutation||'—'}</Row>
          <Row label={t('Full Name','全名')}>{editing ? <Inp value={form.full_name} onChange={v2 => set('full_name',v2)} /> : v.full_name}</Row>
          <Row label="NRIC">{editing ? <Inp value={form.nric||''} onChange={v2 => set('nric',v2)} /> : v.nric||'—'}</Row>
          <Row label={t('Date of Birth','出生日期')}>{editing ? <Inp type="date" value={form.date_of_birth||''} onChange={v2 => set('date_of_birth',v2)} /> : v.date_of_birth||'—'}</Row>
          <Row label={t('Gender','性别')}>{editing ? <Sel value={form.gender||''} onChange={v2 => set('gender',v2)} opts={[['','—'],['male',t('Male','男')],['female',t('Female','女')]]} /> : v.gender||'—'}</Row>
          <Row label={t('Nationality','国籍')}>{editing ? <Inp value={form.nationality||''} onChange={v2 => set('nationality',v2)} /> : v.nationality||'—'}</Row>
          <Row label={t('Marital Status','婚姻状况')}>{editing ? <Sel value={form.marital_status||''} onChange={v2 => set('marital_status',v2)} opts={[['','—'],['single',t('Single','单身')],['married',t('Married','已婚')],['divorced',t('Divorced','离婚')],['widowed',t('Widowed','丧偶')]]} /> : v.marital_status||'—'}</Row>
          <Row label={t('Dependants','受赡养人')}>{editing ? <Inp type="number" value={String(form.number_of_dependants||0)} onChange={v2 => set('number_of_dependants',parseInt(v2))} /> : String(v.number_of_dependants??0)}</Row>
        </Card>

        <Card title={t('Contact & Address','联系与地址')}>
          <Row label={t('Phone','电话')}>{editing ? <Inp value={form.phone||''} onChange={v2 => set('phone',v2)} /> : v.phone||'—'}</Row>
          <Row label={t('Email','邮箱')}>{editing ? <Inp type="email" value={form.email||''} onChange={v2 => set('email',v2)} /> : v.email||'—'}</Row>
          <Row label={t('Address','地址')}>{editing ? <Inp value={form.correspondence_address||''} onChange={v2 => set('correspondence_address',v2)} /> : v.correspondence_address||'—'}</Row>
          <Row label={t('City','城市')}>{editing ? <Inp value={form.correspondence_city||''} onChange={v2 => set('correspondence_city',v2)} /> : v.correspondence_city||'—'}</Row>
          <Row label={t('State','州属')}>{editing ? <Sel value={form.correspondence_state||''} onChange={v2 => set('correspondence_state',v2)} opts={[['','—'],...MY_STATES.map(s => [s,s] as [string,string])]} /> : v.correspondence_state||'—'}</Row>
          <Row label={t('Postcode','邮编')}>{editing ? <Inp value={form.correspondence_postal_code||''} onChange={v2 => set('correspondence_postal_code',v2)} /> : v.correspondence_postal_code||'—'}</Row>
        </Card>

        <Card title={t('Employment','就业')}>
          <Row label={t('Status','状态')}>{editing ? <Sel value={form.employment_status||''} onChange={v2 => set('employment_status',v2)} opts={[['','—'],['employed',t('Employed','受雇')],['self_employed',t('Self-Employed','自雇')],['unemployed',t('Unemployed','待业')],['retired',t('Retired','退休')],['student',t('Student','学生')]]} /> : v.employment_status||'—'}</Row>
          <Row label={t('Occupation','职业')}>{editing ? <Inp value={form.occupation||''} onChange={v2 => set('occupation',v2)} /> : v.occupation||'—'}</Row>
          <Row label={t('Employer','雇主')}>{editing ? <Inp value={form.employer_name||''} onChange={v2 => set('employer_name',v2)} /> : v.employer_name||'—'}</Row>
        </Card>

        <Card title={t('Financial Profile','财务资料')}>
          <Row label={t('Risk Profile','风险评级')}>{editing ? <Sel value={form.risk_profile||''} onChange={v2 => set('risk_profile',v2)} opts={[['','—'],['conservative',t('Conservative','保守')],['moderate',t('Moderate','稳健')],['balanced',t('Balanced','平衡')],['growth',t('Growth','成长')],['aggressive',t('Aggressive','进取')]]} /> : v.risk_profile||'—'}</Row>
          <Row label={t('Retirement Age','退休年龄')}>{editing ? <Inp type="number" value={String(form.retirement_age||60)} onChange={v2 => set('retirement_age',parseInt(v2))} /> : String(v.retirement_age||'—')}</Row>
          <Row label="EPF No.">{editing ? <Inp value={form.epf_account_number||''} onChange={v2 => set('epf_account_number',v2)} /> : v.epf_account_number||'—'}</Row>
          <Row label={t('Client Status','客户状态')}>{editing ? <Sel value={form.status} onChange={v2 => set('status',v2)} opts={[['prospect',t('Prospect','潜在')],['active',t('Active','活跃')],['inactive',t('Inactive','非活跃')]]} /> : v.status}</Row>
        </Card>
      </div>
    </div>
  );
}

const Card = ({ title, children }: any) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 border-b border-slate-50 pb-2">{title}</h3>
    {children}
  </div>
);
const Row = ({ label, children }: any) => (
  <div className="flex items-center py-2 border-b border-slate-50 last:border-0 gap-2">
    <span className="w-32 shrink-0 text-xs text-slate-400 font-medium">{label}</span>
    <span className="flex-1 text-sm text-xin-blue">{children}</span>
  </div>
);
const Btn = ({ onClick, primary, children, disabled }: any) => (
  <button onClick={onClick} disabled={disabled}
    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${primary ? 'bg-xin-blue text-white hover:bg-xin-blueLight' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}
  >{children}</button>
);
const Inp = ({ value, onChange, type = 'text' }: any) => (
  <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)}
    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold" />
);
const Sel = ({ value, onChange, opts }: any) => (
  <select value={value} onChange={(e: any) => onChange(e.target.value)}
    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white">
    {opts.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}
  </select>
);
