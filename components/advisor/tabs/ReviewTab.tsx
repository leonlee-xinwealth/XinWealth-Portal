import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

type Tab = 'activity' | 'profile' | 'review' | 'cashflow' | 'networth' | 'insurance' | 'portfolio' | 'formkit';

const maskSensitive = (value?: string | null, visiblePrefix = 10) => {
  if (!value) return '—';
  const raw = String(value);
  if (raw.length <= 4) return '****';
  return `${raw.slice(0, Math.min(visiblePrefix, raw.length - 4))}****`;
};

export default function ReviewTab({ client, clientId, onNavigateTab }: { client: any; clientId: string; onNavigateTab: (tab: Tab) => void }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [assets, setAssets] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<string | null>('profile');

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: l }, { data: e }, { data: c }] = await Promise.all([
        supabase.from('assets').select('*').eq('client_id', clientId).order('asset_type'),
        supabase.from('liabilities').select('*').eq('client_id', clientId).order('liability_type'),
        supabase.from('cashflow_entries').select('*').eq('client_id', clientId).order('direction').order('category'),
        supabase.from('cashflow_categories').select('*').order('sort_order'),
      ]);
      setAssets(a || []); setLiabilities(l || []); setCashflow(e || []); setCategories(c || []);
      setLoading(false);
    }
    load();
  }, [clientId]);

  const catLabel = (code: string) => { const c = categories.find(x => x.code === code); if (!c) return code; return language === 'zh' && c.label_zh ? c.label_zh : c.label; };
  const monthly = (e: any) => { const m: any = {monthly:1,quarterly:1/3,semi_annual:1/6,annual:1/12,one_off:0}; return e.amount * (m[e.frequency]??1); };
  const inflows = cashflow.filter(e => e.direction === 'inflow');
  const outflows = cashflow.filter(e => e.direction === 'outflow');
  const totalIn = inflows.reduce((s,e) => s+monthly(e), 0);
  const totalOut = outflows.reduce((s,e) => s+monthly(e), 0);
  const totalA = assets.reduce((s,a) => s+a.current_value, 0);
  const totalL = liabilities.reduce((s,l) => s+l.outstanding_balance, 0);

  const fullAddress = [client.correspondence_address, client.correspondence_city, client.correspondence_state, client.correspondence_postal_code].filter(Boolean).join(', ');

  if (loading) return <Loader />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400 mb-2">
        {t('Go through each section with the client and confirm everything is correct. Use the links to jump to a tab and fix anything wrong.', '请与客户逐项核对以下资料是否正确。如有错误，可点击链接跳转到对应页面修改。')}
      </p>

      <Section id="profile" open={openSection} setOpen={setOpenSection} icon="👤" title={t('Profile','个人资料')} onEdit={() => onNavigateTab('profile')} t={t}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title={t('Personal','个人资料')}>
            <Row label={t('Salutation','称谓')}>{client.salutation || '—'}</Row>
            <Row label={t('Full Name','全名')}>{client.full_name || '—'}</Row>
            <Row label="NRIC">{maskSensitive(client.nric)}</Row>
            <Row label={t('Date of Birth','出生日期')}>{client.date_of_birth || '—'}</Row>
            <Row label={t('Gender','性别')}>{client.gender || '—'}</Row>
            <Row label={t('Nationality','国籍')}>{client.nationality || '—'}</Row>
            <Row label={t('Marital Status','婚姻状况')}>{client.marital_status || '—'}</Row>
            <Row label={t('Dependants','受赡养人')}>{String(client.number_of_dependants ?? 0)}</Row>
          </Card>
          <Card title={t('Contact & Address','联系与地址')}>
            <Row label={t('Phone','电话')}>{client.phone || '—'}</Row>
            <Row label={t('Email','邮箱')}>{client.email || '—'}</Row>
            <Row label={t('Address','地址')}>{fullAddress || '—'}</Row>
          </Card>
          <Card title={t('Employment','就业')}>
            <Row label={t('Status','状态')}>{client.employment_status || '—'}</Row>
            <Row label={t('Occupation','职业')}>{client.occupation || '—'}</Row>
            <Row label={t('Employer','雇主')}>{client.employer_name || '—'}</Row>
          </Card>
          <Card title={t('Financial Profile','财务资料')}>
            <Row label={t('Risk Profile','风险评级')}>{client.risk_profile || '—'}</Row>
            <Row label={t('Retirement Age','退休年龄')}>{String(client.retirement_age ?? '—')}</Row>
            <Row label="EPF No.">{client.epf_account_number || '—'}</Row>
            <Row label={t('Bank Account No.','银行账号')}>{maskSensitive(client.bank_account_number)}</Row>
          </Card>
        </div>
      </Section>

      <Section id="income" open={openSection} setOpen={setOpenSection} icon="💰" title={t('Income','收入')} count={inflows.length} onEdit={() => onNavigateTab('cashflow')} t={t}>
        {inflows.length === 0 ? <Empty t={t} /> : (
          <>
            {inflows.map(e => (
              <ReviewRow key={e.id} title={catLabel(e.category)} sub={`RM ${fmt(e.amount)} · ${e.frequency}${e.source_note ? ` · ${e.source_note}` : ''}`} value={`${fmt(monthly(e))}/mo`} color="text-emerald-600" />
            ))}
            <Total label={t('Total / month','月合计')} value={fmt(totalIn)} color="text-emerald-600" />
          </>
        )}
      </Section>

      <Section id="expenses" open={openSection} setOpen={setOpenSection} icon="💸" title={t('Expenses','支出')} count={outflows.length} onEdit={() => onNavigateTab('cashflow')} t={t}>
        {outflows.length === 0 ? <Empty t={t} /> : (
          <>
            {outflows.map(e => (
              <ReviewRow key={e.id} title={catLabel(e.category)} sub={`RM ${fmt(e.amount)} · ${e.frequency}${e.source_note ? ` · ${e.source_note}` : ''}`} value={`${fmt(monthly(e))}/mo`} color="text-red-500" />
            ))}
            <Total label={t('Total / month','月合计')} value={fmt(totalOut)} color="text-red-500" />
          </>
        )}
      </Section>

      <Section id="assets" open={openSection} setOpen={setOpenSection} icon="📈" title={t('Assets','资产')} count={assets.length} onEdit={() => onNavigateTab('networth')} t={t}>
        {assets.length === 0 ? <Empty t={t} /> : (
          <>
            {assets.map(a => (
              <ReviewRow key={a.id} title={a.name} sub={a.asset_type + (a.institution ? ` · ${a.institution}` : '')} value={`RM ${fmt(a.current_value)}`} color="text-emerald-600" />
            ))}
            <Total label={t('Total','合计')} value={fmt(totalA)} color="text-emerald-600" />
          </>
        )}
      </Section>

      <Section id="liabilities" open={openSection} setOpen={setOpenSection} icon="📉" title={t('Liabilities','负债')} count={liabilities.length} onEdit={() => onNavigateTab('networth')} t={t}>
        {liabilities.length === 0 ? <Empty t={t} /> : (
          <>
            {liabilities.map(l => (
              <ReviewRow key={l.id} title={l.name} sub={l.liability_type + (l.lender ? ` · ${l.lender}` : '') + (l.monthly_payment ? ` · RM${fmt(l.monthly_payment)}/mo` : '')} value={`RM ${fmt(l.outstanding_balance)}`} color="text-red-500" />
            ))}
            <Total label={t('Total','合计')} value={fmt(totalL)} color="text-red-500" />
          </>
        )}
      </Section>
    </div>
  );
}

const Section = ({ id, open, setOpen, icon, title, count, onEdit, t, children }: any) => {
  const isOpen = open === id;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(isOpen ? null : id)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 font-semibold text-sm text-xin-blue">
          <span>{icon}</span>{title}
          {typeof count === 'number' && <span className="text-xs font-normal text-slate-400">({count})</span>}
        </span>
        {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {isOpen && (
        <div className="px-5 pb-5">
          <div className="flex justify-end mb-3">
            <button onClick={onEdit} className="text-xs font-semibold text-xin-blue hover:text-xin-gold">
              {t('Go to tab to edit →','前往页面编辑 →')}
            </button>
          </div>
          {children}
        </div>
      )}
    </div>
  );
};
const Card = ({ title, children }: any) => (
  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 border-b border-slate-200 pb-2">{title}</h4>
    {children}
  </div>
);
const Row = ({ label, children }: any) => (
  <div className="flex items-center py-1.5 border-b border-slate-100 last:border-0 gap-2">
    <span className="w-32 shrink-0 text-xs text-slate-400 font-medium">{label}</span>
    <span className="flex-1 text-sm text-xin-blue">{children}</span>
  </div>
);
const ReviewRow = ({ title, sub, value, color }: any) => (
  <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
    <div><div className="text-sm font-medium text-xin-blue">{title}</div><div className="text-xs text-slate-400">{sub}</div></div>
    <span className={`text-sm font-semibold ${color}`}>{value}</span>
  </div>
);
const Total = ({ label, value, color }: any) => (
  <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
    <span className="text-xs font-semibold text-slate-500">{label}</span>
    <span className={`text-sm font-bold ${color}`}>RM {value}</span>
  </div>
);
const Empty = ({ t }: any) => <div className="py-6 text-center text-slate-300 text-sm">{t('No data submitted','未提交资料')}</div>;
const Loader = () => <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" /></div>;
const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
