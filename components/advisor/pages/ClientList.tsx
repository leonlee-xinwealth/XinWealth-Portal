import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, Search } from 'lucide-react';

export default function ClientList() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv) return;
      const { data } = await supabase.from('clients').select('*').eq('advisor_id', adv.id).order('full_name');
      setClients(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.nric || '').includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('Clients', '客户')}</h1>
        <Link to="/advisor/clients/new"
          className="flex items-center gap-2 bg-xin-blue text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-xin-blueLight transition-colors"
        >
          <Plus size={16} />
          {t('Add Client', '添加客户')}
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('Search by name, email, NRIC...', '搜索姓名、邮箱、身份证...')}
          className="w-full max-w-sm pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1.2fr_1.5fr_1fr_100px] px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          <div>{t('Name', '姓名')}</div>
          <div>{t('Phone', '电话')}</div>
          <div>{t('Email', '邮箱')}</div>
          <div>{t('Status', '状态')}</div>
          <div></div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t('No clients found.', '没有客户。')}</div>
        ) : (
          filtered.map(c => (
            <div key={c.id} className="grid grid-cols-[2fr_1.2fr_1.5fr_1fr_100px] px-6 py-3.5 border-b border-slate-50 last:border-0 items-center hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-xin-blue/10 text-xin-blue font-bold text-sm flex items-center justify-center shrink-0">
                  {c.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-xin-blue">{c.salutation ? `${c.salutation} ` : ''}{c.full_name}</div>
                  {c.nric && <div className="text-xs text-slate-400">{c.nric}</div>}
                </div>
              </div>
              <div className="text-sm text-slate-600">{c.phone || '—'}</div>
              <div className="text-sm text-slate-600 truncate pr-2">{c.email || '—'}</div>
              <div><StatusBadge status={c.status} language={language} /></div>
              <div>
                <Link to={`/advisor/clients/${c.id}`}
                  className="text-xs font-semibold text-xin-gold hover:text-xin-goldDark border border-xin-gold/30 px-3 py-1.5 rounded-lg hover:bg-xin-gold/5 transition-colors"
                >
                  {t('View', '查看')}
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 mt-3">{filtered.length} {t('clients', '位客户')}</p>
      )}
    </div>
  );
}

function StatusBadge({ status, language }: { status: string; language: string }) {
  const map: Record<string, any> = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active', labelZh: '活跃' },
    prospect: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Prospect', labelZh: '潜在' },
    inactive: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Inactive', labelZh: '非活跃' },
  };
  const s = map[status] || map.inactive;
  return <span className={`${s.bg} ${s.text} text-xs font-semibold px-2.5 py-1 rounded-full`}>{language === 'zh' ? s.labelZh : s.label}</span>;
}
