import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { ChevronLeft, Plus, X } from 'lucide-react';
import ProfileTab from '../tabs/ProfileTab';
import CashflowTab from '../tabs/CashflowTab';
import NetworthTab from '../tabs/NetworthTab';
import InsuranceTab from '../tabs/InsuranceTab';
import ActivityTab from '../tabs/ActivityTab';
import FormKitTab from '../tabs/FormKitTab';
import PortfolioTab from '../tabs/PortfolioTab';
import HealthScoreCard from '../components/HealthScoreCard';
import { getCaseTemplate, CASE_TYPE_LABELS } from '../cases/caseTemplates';

type Tab = 'activity' | 'profile' | 'cashflow' | 'networth' | 'insurance' | 'portfolio' | 'formkit';

interface Policy {
  id: string;
  provider: string;
  policy_number: string;
  policy_type: string;
}

const maskNric = (value?: string | null) => {
  if (!value) return '';
  const raw = String(value);
  if (raw.length <= 4) return '****';
  return `${raw.slice(0, Math.min(10, raw.length - 4))}****`;
};

export default function ClientDetail() {
  const { id } = useParams();
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('activity');
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [converting, setConverting] = useState(false);

  // New Case modal state
  const [showNewCase, setShowNewCase] = useState(false);
  const [caseType, setCaseType] = useState('car_insurance');
  const [caseDueDate, setCaseDueDate] = useState('');
  const [caseRenewedFromId, setCaseRenewedFromId] = useState('');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [creatingCase, setCreatingCase] = useState(false);
  const [caseError, setCaseError] = useState('');

  async function loadClient() {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    setClient(data);
    setLoading(false);
  }

  async function handleConvert() {
    if (!client || converting) return;
    setConverting(true);
    try {
      const { error } = await supabase.from('clients').update({ status: 'active' }).eq('id', client.id);
      if (error) throw error;
      await loadClient();
    } catch (e) {
      console.error('Convert failed:', e);
      alert('转换失败，请重试。');
    } finally {
      setConverting(false);
    }
  }

  async function loadPending() {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('client_notes')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', id as string)
      .eq('follow_up_done', false)
      .not('follow_up_date', 'is', null);
    setPendingCount(count || 0);
  }

  async function loadPolicies() {
    if (!id) return;
    const { data } = await supabase
      .from('insurance_policies')
      .select('id, provider, policy_number, policy_type')
      .eq('client_id', id);
    setPolicies((data as Policy[]) || []);
  }

  useEffect(() => {
    loadClient();
    loadPending();
    loadPolicies();
  }, [id]);

  async function openNewCaseModal() {
    setCaseType('car_insurance');
    setCaseDueDate('');
    setCaseRenewedFromId('');
    setCaseError('');
    setShowNewCase(true);
  }

  async function handleCreateCase() {
    if (!caseType) return;
    setCreatingCase(true);
    setCaseError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv) throw new Error('Advisor not found');

      const insertPayload: Record<string, any> = {
        client_id: client.id,
        advisor_id: adv.id,
        case_type: caseType,
        due_date: caseDueDate || null,
        renewed_from_policy_id: caseRenewedFromId || null,
      };

      const { data: newCase, error: caseErr } = await supabase
        .from('cases')
        .insert(insertPayload)
        .select()
        .single();

      if (caseErr) throw new Error(caseErr.message);

      const template = getCaseTemplate(caseType);
      if (template.length > 0) {
        await supabase.from('case_checklist_items').insert(
          template.map((item, idx) => ({
            case_id: newCase.id,
            item_key: item.key,
            label_en: item.en,
            label_zh: item.zh,
            sort_order: idx,
            completed_at: null,
          }))
        );
      }

      setShowNewCase(false);
      navigate(`/advisor/cases/${newCase.id}`);
    } catch (err: any) {
      setCaseError(err.message || 'Failed to create case');
    } finally {
      setCreatingCase(false);
    }
  }

  const tabs: { key: Tab; en: string; zh: string; icon: string; badge?: number }[] = [
    { key: 'activity', en: 'Activity', zh: '活动', icon: '📝', badge: pendingCount },
    { key: 'profile', en: 'Profile', zh: '资料', icon: '👤' },
    { key: 'cashflow', en: 'Cash Flow', zh: '收支', icon: '💰' },
    { key: 'networth', en: 'Net Worth', zh: '净资产', icon: '📈' },
    { key: 'insurance', en: 'Insurance', zh: '保险', icon: '🛡️' },
    { key: 'portfolio', en: 'Portfolio', zh: '投资组合', icon: '📊' },
    { key: 'formkit', en: 'Form Kit', zh: '表格资料', icon: '📋' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue" />
    </div>
  );

  if (!client) return <div className="text-red-500 text-sm">Client not found.</div>;

  const statusMap: any = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active', labelZh: '活跃' },
    prospect: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Prospect', labelZh: '潜在' },
    inactive: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Inactive', labelZh: '非活跃' },
  };
  const s = statusMap[client.status] || statusMap.inactive;

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/advisor/clients')} className="text-slate-400 hover:text-xin-blue transition-colors">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl font-bold text-xin-blue truncate">
            {client.salutation ? `${client.salutation} ` : ''}{client.full_name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {client.nric && <span className="text-xs text-slate-400">{maskNric(client.nric)}</span>}
            {client.date_of_birth && (
              <>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">
                  🎂 {new Date(client.date_of_birth).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                </span>
              </>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`${s.bg} ${s.text} text-xs font-semibold px-2 py-0.5 rounded-full`}>
                {language === 'zh' ? s.labelZh : s.label}
              </span>
              {client.status === 'prospect' && (
                <button
                  onClick={handleConvert}
                  disabled={converting}
                  className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {converting ? '...' : `✓ ${t('Convert to Active', '转为正式客户')}`}
                </button>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={openNewCaseModal}
          className="flex items-center gap-1.5 bg-xin-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blueLight transition-colors shrink-0"
        >
          <Plus size={15} />
          {t('New Case', '新建案件')}
        </button>
      </div>

      <HealthScoreCard clientId={client.id} />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6 flex-wrap">
        {tabs.map(tabItem => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === tabItem.key ? 'bg-white text-xin-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tabItem.icon}</span>
            <span>{t(tabItem.en, tabItem.zh)}</span>
            {tabItem.badge && tabItem.badge > 0 ? (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {tabItem.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'activity' && <ActivityTab clientId={client.id} />}
      {tab === 'profile' && <ProfileTab client={client} onSave={loadClient} />}
      {tab === 'cashflow' && <CashflowTab clientId={client.id} />}
      {tab === 'networth' && <NetworthTab clientId={client.id} />}
      {tab === 'insurance' && <InsuranceTab clientId={client.id} />}
      {tab === 'portfolio' && <PortfolioTab clientId={client.id} />}
      {tab === 'formkit' && <FormKitTab client={client} />}

      {/* New Case Modal */}
      {showNewCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-lg font-bold text-xin-blue">
                {t('New Case', '新建案件')}
              </h2>
              <button onClick={() => setShowNewCase(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Case Type */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t('Case Type', '案件类型')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={caseType}
                  onChange={e => setCaseType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
                >
                  {Object.entries(CASE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label.en} / {label.zh}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t('Due Date', '到期日')}
                </label>
                <input
                  type="date"
                  value={caseDueDate}
                  onChange={e => setCaseDueDate(e.target.value)}
                  placeholder="Policy expiry date (optional)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1">{t('Policy expiry date (optional)', '保单到期日（可选）')}</p>
              </div>

              {/* Renewed From Policy */}
              {policies.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    {t('Renewed From Policy', '续保自保单')}
                  </label>
                  <select
                    value={caseRenewedFromId}
                    onChange={e => setCaseRenewedFromId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
                  >
                    <option value="">{t('— None —', '— 无 —')}</option>
                    {policies.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.provider} — {p.policy_number} ({p.policy_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {caseError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{caseError}</div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateCase}
                disabled={!caseType || creatingCase}
                className="flex-1 px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-50 text-sm"
              >
                {creatingCase ? t('Creating...', '创建中...') : t('Create Case', '创建案件')}
              </button>
              <button
                onClick={() => setShowNewCase(false)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors text-sm"
              >
                {t('Cancel', '取消')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
