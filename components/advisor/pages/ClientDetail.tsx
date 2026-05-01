import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { ChevronLeft } from 'lucide-react';
import ProfileTab from '../tabs/ProfileTab';
import CashflowTab from '../tabs/CashflowTab';
import NetworthTab from '../tabs/NetworthTab';
import InsuranceTab from '../tabs/InsuranceTab';

type Tab = 'profile' | 'cashflow' | 'networth' | 'insurance';

export default function ClientDetail() {
  const { id } = useParams();
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);

  async function loadClient() {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    setClient(data);
    setLoading(false);
  }

  useEffect(() => { loadClient(); }, [id]);

  const tabs: { key: Tab; en: string; zh: string; icon: string }[] = [
    { key: 'profile', en: 'Profile', zh: '基本资料', icon: '👤' },
    { key: 'cashflow', en: 'Cash Flow', zh: '收支', icon: '💰' },
    { key: 'networth', en: 'Net Worth', zh: '净资产', icon: '📈' },
    { key: 'insurance', en: 'Insurance', zh: '保险', icon: '🛡️' },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue" /></div>;
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
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/advisor/clients')} className="text-slate-400 hover:text-xin-blue transition-colors"><ChevronLeft size={22} /></button>
        <div>
          <h1 className="font-serif text-xl font-bold text-xin-blue">
            {client.salutation ? `${client.salutation} ` : ''}{client.full_name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            {client.nric && <span className="text-xs text-slate-400">{client.nric}</span>}
            <span className={`${s.bg} ${s.text} text-xs font-semibold px-2 py-0.5 rounded-full`}>{language === 'zh' ? s.labelZh : s.label}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6">
        {tabs.map(tab_ => (
          <button key={tab_.key} onClick={() => setTab(tab_.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === tab_.key ? 'bg-white text-xin-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab_.icon}</span>
            <span>{t(tab_.en, tab_.zh)}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'profile' && <ProfileTab client={client} onSave={loadClient} />}
      {tab === 'cashflow' && <CashflowTab clientId={client.id} />}
      {tab === 'networth' && <NetworthTab clientId={client.id} />}
      {tab === 'insurance' && <InsuranceTab clientId={client.id} />}
    </div>
  );
}
