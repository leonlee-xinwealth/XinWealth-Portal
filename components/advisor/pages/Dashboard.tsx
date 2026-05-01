import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Users, UserCheck, Target, AlertCircle, Calendar, Gift, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  const [advisor, setAdvisor] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [pendingFollowUps, setPendingFollowUps] = useState<any[]>([]);
  const [expiringPolicies, setExpiringPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adv } = await supabase.from('advisors').select('*').eq('user_id', user.id).single();
      setAdvisor(adv);
      if (!adv) return setLoading(false);

      // Load all clients
      const { data: cls } = await supabase
        .from('clients')
        .select('id, full_name, email, phone, status, date_of_birth')
        .eq('advisor_id', adv.id)
        .order('full_name');
      setClients(cls || []);

      // Load pending follow-ups (due today or overdue)
      const today = new Date().toISOString().split('T')[0];
      const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const { data: notes } = await supabase
        .from('client_notes')
        .select('id, content, follow_up_date, client_id, note_type')
        .eq('advisor_id', adv.id)
        .eq('follow_up_done', false)
        .not('follow_up_date', 'is', null)
        .lte('follow_up_date', in7days)
        .order('follow_up_date');
      setPendingFollowUps(notes || []);

      // Load expiring insurance policies (within 90 days)
      const in90days = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
      const clientIds = (cls || []).map((c: any) => c.id);
      if (clientIds.length > 0) {
        const { data: policies } = await supabase
          .from('insurance_policies')
          .select('id, provider, policy_type, end_date, client_id')
          .in('client_id', clientIds)
          .not('end_date', 'is', null)
          .gte('end_date', today)
          .lte('end_date', in90days)
          .order('end_date');
        setExpiringPolicies(policies || []);
      }

      setLoading(false);
    }
    load();
  }, []);

  // Birthday calculations
  const today = new Date();
  const upcomingBirthdays = clients
    .filter(c => c.date_of_birth)
    .map(c => {
      const dob = new Date(c.date_of_birth);
      const thisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      let daysUntil = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) {
        const nextYear = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        daysUntil = Math.ceil((nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
      return { ...c, daysUntil, dobFormatted: dob.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) };
    })
    .filter(c => c.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const active = clients.filter(c => c.status === 'active').length;
  const prospects = clients.filter(c => c.status === 'prospect').length;
  const overdueFollowUps = pendingFollowUps.filter(n => n.follow_up_date < today.toISOString().split('T')[0]);

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const stats = [
    { label: t('Total Clients', '总客户'), value: clients.length, icon: <Users size={20} />, color: 'text-xin-blue', bg: 'bg-blue-50' },
    { label: t('Active', '活跃'), value: active, icon: <UserCheck size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: t('Prospects', '潜在'), value: prospects, icon: <Target size={20} />, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-xin-blue">
          {t('Good morning', '早上好')}{advisor ? `, ${advisor.display_name.split(' ')[0]}` : ''} 👋
        </h1>
        {advisor && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-slate-400 text-sm">{new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span className="bg-xin-gold/20 text-xin-goldDark text-xs font-bold px-2 py-0.5 rounded-full">{advisor.rank}</span>
          </div>
        )}
      </div>

      {/* Action required banner */}
      {(overdueFollowUps.length > 0 || expiringPolicies.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0" />
          <div className="flex-1 text-sm text-red-700">
            {overdueFollowUps.length > 0 && (
              <span className="font-semibold">{overdueFollowUps.length} {t('overdue follow-up(s)', '个逾期跟进')} </span>
            )}
            {overdueFollowUps.length > 0 && expiringPolicies.length > 0 && '· '}
            {expiringPolicies.length > 0 && (
              <span className="font-semibold">{expiringPolicies.length} {t('policy(ies) expiring soon', '份保单即将到期')}</span>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 font-medium">{s.label}</span>
              <div className={`${s.bg} ${s.color} p-2 rounded-xl`}>{s.icon}</div>
            </div>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Action panels - 3 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Follow-ups */}
        <ActionCard
          title={t('Follow-ups (7 days)', '跟进（7天内）')}
          icon="📅"
          count={pendingFollowUps.length}
          urgent={overdueFollowUps.length > 0}
          empty={pendingFollowUps.length === 0}
          emptyText={t('No pending follow-ups 🎉', '没有待跟进 🎉')}
        >
          {pendingFollowUps.slice(0, 4).map(note => {
            const cl = clientMap[note.client_id];
            const isOverdue = note.follow_up_date < today.toISOString().split('T')[0];
            return (
              <Link key={note.id} to={`/advisor/clients/${note.client_id}`}
                className="flex items-start gap-2.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-4 px-4 transition-colors"
              >
                <Avatar name={cl?.full_name || '?'} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-xin-blue truncate">{cl?.full_name}</div>
                  <div className="text-xs text-slate-500 truncate">{note.content}</div>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                  {isOverdue ? t('Overdue', '逾期') : note.follow_up_date}
                </span>
              </Link>
            );
          })}
        </ActionCard>

        {/* Birthdays */}
        <ActionCard
          title={t('Birthdays (30 days)', '生日（30天内）')}
          icon="🎂"
          count={upcomingBirthdays.length}
          urgent={upcomingBirthdays.some(c => c.daysUntil <= 3)}
          empty={upcomingBirthdays.length === 0}
          emptyText={t('No birthdays this month', '本月没有生日')}
        >
          {upcomingBirthdays.slice(0, 4).map(c => (
            <Link key={c.id} to={`/advisor/clients/${c.id}`}
              className="flex items-center gap-2.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-4 px-4 transition-colors"
            >
              <Avatar name={c.full_name} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-xin-blue truncate">{c.full_name}</div>
                <div className="text-xs text-slate-500">{c.dobFormatted}</div>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                c.daysUntil === 0 ? 'bg-pink-100 text-pink-600' :
                c.daysUntil <= 3 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {c.daysUntil === 0 ? t('Today! 🎉', '今天! 🎉') : `${c.daysUntil}d`}
              </span>
            </Link>
          ))}
        </ActionCard>

        {/* Expiring policies */}
        <ActionCard
          title={t('Expiring Policies (90d)', '到期保单（90天内）')}
          icon="⚠️"
          count={expiringPolicies.length}
          urgent={expiringPolicies.some(p => {
            const days = Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000);
            return days <= 30;
          })}
          empty={expiringPolicies.length === 0}
          emptyText={t('No expiring policies', '没有即将到期的保单')}
        >
          {expiringPolicies.slice(0, 4).map(policy => {
            const cl = clientMap[policy.client_id];
            const days = Math.ceil((new Date(policy.end_date).getTime() - Date.now()) / 86400000);
            return (
              <Link key={policy.id} to={`/advisor/clients/${policy.client_id}`}
                className="flex items-center gap-2.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-4 px-4 transition-colors"
              >
                <Avatar name={cl?.full_name || '?'} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-xin-blue truncate">{cl?.full_name}</div>
                  <div className="text-xs text-slate-500">{policy.provider} · {policy.policy_type}</div>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${days <= 30 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                  {days}d
                </span>
              </Link>
            );
          })}
        </ActionCard>
      </div>

      {/* Recent clients */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <h2 className="font-semibold text-xin-blue text-sm">{t('All Clients', '所有客户')}</h2>
          <Link to="/advisor/clients" className="text-xin-gold text-xs font-semibold hover:text-xin-goldDark flex items-center gap-1">
            {t('Manage', '管理')} <ChevronRight size={12} />
          </Link>
        </div>
        {clients.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            {t('No clients yet.', '还没有客户。')}{' '}
            <Link to="/advisor/clients/new" className="text-xin-gold font-semibold hover:underline">
              {t('Add your first client →', '添加第一位客户 →')}
            </Link>
          </div>
        ) : (
          clients.slice(0, 5).map(c => (
            <Link key={c.id} to={`/advisor/clients/${c.id}`}
              className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar name={c.full_name} />
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

// ── Sub-components ──────────────────────────────────────────

function ActionCard({ title, icon, count, urgent, empty, emptyText, children }: {
  title: string; icon: string; count: number; urgent: boolean;
  empty: boolean; emptyText: string; children?: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${urgent ? 'border-red-200' : 'border-slate-100'}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${urgent ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className={`text-xs font-semibold ${urgent ? 'text-red-700' : 'text-slate-600'}`}>{title}</span>
        </div>
        {count > 0 && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${urgent ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600'}`}>
            {count}
          </span>
        )}
      </div>
      <div className="px-4 py-1">
        {empty ? (
          <div className="py-5 text-center text-slate-400 text-xs">{emptyText}</div>
        ) : children}
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-7 h-7 rounded-full bg-xin-blue/10 text-xin-blue font-bold text-xs flex items-center justify-center shrink-0">
      {name.charAt(0).toUpperCase()}
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

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue" /></div>;
}
