import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Users, UserCheck, Target, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [advisor, setAdvisor] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: adv } = await supabase.from('advisors').select('*').eq('user_id', user.id).single();
      setAdvisor(adv);
      if (adv) {
        const { data } = await supabase.from('clients').select('*').eq('advisor_id', adv.id).order('created_at', { ascending: false });
        setClients(data || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const active = clients.filter(c => c.status === 'active').length;
  const prospects = clients.filter(c => c.status === 'prospect').length;

  const stats = [
    { label: t('Total Clients', '总客户'), value: clients.length, icon: <Users size={22} />, color: 'text-xin-blue', bg: 'bg-blue-50' },
    { label: t('Active', '活跃'), value: active, icon: <UserCheck size={22} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: t('Prospects', '潜在客户'), value: prospects, icon: <Target size={22} />, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  if (loading) return <Loader />;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('Dashboard', '主页')}</h1>
        {advisor && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-slate-500 text-sm">{advisor.display_name}</span>
            <span className="bg-xin-gold/20 text-xin-goldDark text-xs font-bold px-2 py-0.5 rounded-full">{advisor.rank}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 font-medium">{s.label}</span>
              <div className={`${s.bg} ${s.color} p-2 rounded-xl`}>{s.icon}</div>
            </div>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Recent clients */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-xin-blue text-sm">{t('Recent Clients', '最近客户')}</h2>
          <Link to="/advisor/clients" className="text-xin-gold text-xs font-semibold hover:text-xin-goldDark">{t('View all →', '查看全部 →')}</Link>
        </div>
        {clients.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t('No clients yet. Add your first client.', '还没有客户。')}</div>
        ) : (
          clients.slice(0, 6).map((c, i) => (
            <Link key={c.id} to={`/advisor/clients/${c.id}`}
              className="flex items-center justify-between px-6 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-xin-blue/10 text-xin-blue font-bold text-sm flex items-center justify-center">
                  {c.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-xin-blue">{c.full_name}</div>
                  <div className="text-xs text-slate-400">{c.email || c.phone || '—'}</div>
                </div>
              </div>
              <StatusBadge status={c.status} language={language} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, language }: { status: string; language: string }) {
  const map: Record<string, { bg: string; text: string; label: string; labelZh: string }> = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active', labelZh: '活跃' },
    prospect: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Prospect', labelZh: '潜在' },
    inactive: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Inactive', labelZh: '非活跃' },
  };
  const s = map[status] || map.inactive;
  return <span className={`${s.bg} ${s.text} text-xs font-semibold px-2.5 py-1 rounded-full`}>{language === 'zh' ? s.labelZh : s.label}</span>;
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue" /></div>;
}
