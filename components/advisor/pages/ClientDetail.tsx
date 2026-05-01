import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { ChevronLeft } from 'lucide-react';
import ProfileTab from '../tabs/ProfileTab';
import CashflowTab from '../tabs/CashflowTab';
import NetworthTab from '../tabs/NetworthTab';
import InsuranceTab from '../tabs/InsuranceTab';
import ActivityTab from '../tabs/ActivityTab';
import FormKitTab from '../tabs/FormKitTab';
import PortfolioTab from '../tabs/PortfolioTab';
import HealthScoreCard from '../components/HealthScoreCard';

type Tab = 'activity' | 'profile' | 'cashflow' | 'networth' | 'insurance' | 'portfolio' | 'formkit';

export default function ClientDetail() {
  const { id } = useParams();
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('activity');
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  async function loadClient() {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    setClient(data);
    setLoading(false);
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

  useEffect(() => {
    loadClient();
    loadPending();
  }, [id]);

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
            {client.nric && <span className="text-xs text-slate-400">{client.nric}</span>}
            {client.date_of_birth && (
              <>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">
                  🎂 {new Date(client.date_of_birth).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                </span>
              </>
            )}
            <span className={`${s.bg} ${s.text} text-xs font-semibold px-2 py-0.5 rounded-full`}>
              {language === 'zh' ? s.labelZh : s.label}
            </span>
          </div>
        </div>
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
    </div>
  );
}
