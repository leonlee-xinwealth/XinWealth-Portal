import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { getCaseTemplate } from '../cases/caseTemplates';
import { Users, UserCheck, Target, AlertCircle, Calendar, Gift, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();

  const [advisor, setAdvisor] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [pendingFollowUps, setPendingFollowUps] = useState<any[]>([]);
  const [expiringPolicies, setExpiringPolicies] = useState<any[]>([]);
  const [renewalCaseMap, setRenewalCaseMap] = useState<Record<string, string>>({});
  const [incompleteClients, setIncompleteClients] = useState<any[]>([]);
  const [overdueProspects, setOverdueProspects] = useState<any[]>([]);
  const [notContacted, setNotContacted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingRenewal, setStartingRenewal] = useState<string | null>(null);

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
        .select('id, full_name, email, phone, status, date_of_birth, nric, risk_profile, last_contacted_at')
        .eq('advisor_id', adv.id)
        .order('full_name');
      setClients(cls || []);

      const clientIds = (cls || []).map((c: any) => c.id);
      if (clientIds.length > 0) {
        const [{ data: cf }, { data: a }, { data: ip }] = await Promise.all([
          supabase.from('cashflow_entries').select('client_id').in('client_id', clientIds),
          supabase.from('assets').select('client_id').in('client_id', clientIds),
          supabase.from('insurance_policies').select('client_id').in('client_id', clientIds),
        ]);

        const hasCashflow = new Set((cf || []).map((r: any) => r.client_id));
        const hasAssets = new Set((a || []).map((r: any) => r.client_id));
        const hasInsurance = new Set((ip || []).map((r: any) => r.client_id));

        const calcMissing = (c: any) => {
          const keys: string[] = [];
          if (!c.date_of_birth) keys.push('dob');
          if (!c.phone) keys.push('phone');
          if (!c.nric) keys.push('nric');
          if (!c.risk_profile) keys.push('risk');
          if (!hasCashflow.has(c.id)) keys.push('cashflow');
          if (!hasAssets.has(c.id)) keys.push('assets');
          if (!hasInsurance.has(c.id)) keys.push('insurance');
          return keys;
        };

        const incompletes = (cls || [])
          .map((c: any) => ({ ...c, missingKeys: calcMissing(c) }))
          .filter((c: any) => c.missingKeys.length > 0);
        setIncompleteClients(incompletes);
      } else {
        setIncompleteClients([]);
      }

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

      // Load expiring insurance policies (within 60 days)
      const in60days = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
      if (clientIds.length > 0) {
        const { data: policies } = await supabase
          .from('insurance_policies')
          .select('id, provider, policy_type, policy_number, end_date, client_id')
          .in('client_id', clientIds)
          .not('end_date', 'is', null)
          .gte('end_date', today)
          .lte('end_date', in60days)
          .order('end_date');
        setExpiringPolicies(policies || []);

        const policyIds = (policies || []).map((p: any) => p.id);
        if (policyIds.length > 0) {
          const { data: openRenewalCases } = await supabase
            .from('cases')
            .select('renewed_from_policy_id, id')
            .in('renewed_from_policy_id', policyIds)
            .eq('status', 'open');
          const renewalMap: Record<string, string> = {};
          (openRenewalCases || []).forEach((c: any) => {
            if (c.renewed_from_policy_id) renewalMap[c.renewed_from_policy_id] = c.id;
          });
          setRenewalCaseMap(renewalMap);
        } else {
          setRenewalCaseMap({});
        }
      }

      // Load overdue prospect actions
      const { data: prospectActions } = await supabase
        .from('clients')
        .select('id, full_name, next_action, next_action_date')
        .eq('advisor_id', adv.id)
        .eq('status', 'prospect')
        .not('next_action_date', 'is', null)
        .lte('next_action_date', today)
        .order('next_action_date');
      setOverdueProspects(prospectActions || []);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const notContactedList = (cls || [])
        .filter(c => c.status === 'active')
        .filter(c => {
          if (!c.last_contacted_at) return true;
          return new Date(c.last_contacted_at) < thirtyDaysAgo;
        })
        .map(c => ({
          ...c,
          daysSinceContact: c.last_contacted_at
            ? Math.floor((Date.now() - new Date(c.last_contacted_at).getTime()) / 86400000)
            : null,
        }))
        .sort((a, b) => (b.daysSinceContact ?? 999) - (a.daysSinceContact ?? 999));
      setNotContacted(notContactedList);

      setLoading(false);
    }
    load();
  }, []);

  // Birthday calculations
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
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

  const urgentBirthdays = upcomingBirthdays.filter(c => c.daysUntil <= 3);

  async function handleStartRenewal(policy: any) {
    if (startingRenewal) return; // prevent duplicate clicks
    setStartingRenewal(policy.id);
    try {
      if (!advisor) return;

      const { data: newCase, error } = await supabase
        .from('cases')
        .insert({
          client_id: policy.client_id,
          advisor_id: advisor.id, // use existing advisor state, no extra query
          case_type: 'car_insurance', // TODO: map policy_type → case_type when non-car types are supported
          renewed_from_policy_id: policy.id,
          due_date: policy.end_date,
        })
        .select()
        .single();

      if (error || !newCase) {
        alert(t('Failed to create renewal case. Please try again.', '创建续保案件失败，请重试。'));
        return;
      }

      const template = getCaseTemplate('car_insurance');
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

      navigate(`/advisor/cases/${newCase.id}`);
    } finally {
      setStartingRenewal(null);
    }
  }

  const active = clients.filter(c => c.status === 'active').length;
  const prospects = clients.filter(c => c.status === 'prospect').length;
  const overdueFollowUps = pendingFollowUps.filter(n => n.follow_up_date < today.toISOString().split('T')[0]);

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const stats = [
    {
      label: t('Total Clients', '总客户'),
      value: clients.length,
      icon: <Users size={20} />,
      color: 'text-xin-blue',
      bg: 'bg-blue-50',
      href: '/advisor/clients',
    },
    {
      label: t('Active', '活跃'),
      value: active,
      icon: <UserCheck size={20} />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      href: '/advisor/clients?status=active',
    },
    {
      label: t('Prospects', '潜在'),
      value: prospects,
      icon: <Target size={20} />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/advisor/clients?status=prospect',
    },
  ];

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-xin-blue">
          {t('Good morning', '早上好')}{advisor ? `, ${advisor.display_name?.split(' ')[0] ?? ''}` : ''} 👋
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
          <Link
            key={s.href}
            to={s.href}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all block"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 font-medium">{s.label}</span>
              <div className={`${s.bg} ${s.color} p-2 rounded-xl`}>{s.icon}</div>
            </div>
            <div className="flex items-end justify-between">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <ChevronRight size={14} className="text-slate-300 mb-1" />
            </div>
          </Link>
        ))}
      </div>

      {/* Action panels - 3 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

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

        {/* Upcoming Renewals */}
        <ActionCard
          title={t('Upcoming Renewals (60d)', '到期续保（60天内）')}
          icon="🔄"
          count={expiringPolicies.length}
          urgent={expiringPolicies.some(p => {
            const d = Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000);
            return d <= 30;
          })}
          empty={expiringPolicies.length === 0}
          emptyText={t('No policies expiring soon', '没有即将到期的保单')}
        >
          {expiringPolicies.slice(0, 4).map(policy => {
            const cl = clientMap[policy.client_id];
            const days = Math.ceil((new Date(policy.end_date).getTime() - Date.now()) / 86400000);
            const existingCaseId = renewalCaseMap[policy.id];
            return (
              <div key={policy.id} className="flex items-center gap-2.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-4 px-4 transition-colors">
                <Avatar name={cl?.full_name || '?'} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-xin-blue truncate">{cl?.full_name}</div>
                  <div className="text-xs text-slate-500">{policy.provider} · {policy.policy_type}</div>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                  days <= 0 ? 'bg-red-100 text-red-600' :
                  days <= 7 ? 'bg-orange-100 text-orange-600' :
                  days <= 30 ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {days <= 0 ? t('Expired', '已过期') : `${days}d`}
                </span>
                {existingCaseId ? (
                  <Link
                    to={`/advisor/cases/${existingCaseId}`}
                    className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shrink-0"
                  >
                    {t('In Progress', '进行中')}
                  </Link>
                ) : (
                  <button
                    onClick={() => handleStartRenewal(policy)}
                    disabled={startingRenewal === policy.id}
                    className="text-[10px] font-bold px-2 py-1 rounded-md bg-xin-gold/10 text-amber-700 hover:bg-xin-gold/20 transition-colors shrink-0 whitespace-nowrap disabled:opacity-50"
                  >
                    {startingRenewal === policy.id ? t('...', '...') : t('+ Renew', '续保')}
                  </button>
                )}
              </div>
            );
          })}
          {expiringPolicies.length > 4 ? (
            <div className="py-2.5 text-center text-xs text-slate-400">
              + {expiringPolicies.length - 4} {t('more', '更多')}
            </div>
          ) : null}
        </ActionCard>

        <ActionCard
          title={t('Incomplete Profiles', '资料不完整')}
          icon="🧾"
          count={incompleteClients.length}
          urgent={incompleteClients.length > 0}
          empty={incompleteClients.length === 0}
          emptyText={t('All profiles look complete 🎉', '所有客户资料看起来都完整 🎉')}
        >
          {incompleteClients.slice(0, 4).map(c => (
            <Link key={c.id} to={`/advisor/clients/${c.id}`}
              className="flex items-start gap-2.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-4 px-4 transition-colors"
            >
              <Avatar name={c.full_name || '?'} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-xin-blue truncate">{c.full_name}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {t('Missing:', '缺少：')} {Array.isArray(c.missingKeys) ? c.missingKeys.map((k: string) => ({
                    dob: t('DOB', '生日'),
                    phone: t('Phone', '电话'),
                    nric: t('NRIC', '身份证'),
                    risk: t('Risk', '风险评级'),
                    cashflow: t('No cashflow', '缺少收支'),
                    assets: t('No assets', '缺少资产'),
                    insurance: t('No insurance', '缺少保单'),
                  } as Record<string, string>)[k]).filter(Boolean).join(', ') : ''}
                </div>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-red-100 text-red-600">
                {t('Fix', '补全')}
              </span>
            </Link>
          ))}
          {incompleteClients.length > 4 ? (
            <div className="py-2.5 text-center text-xs text-slate-400">
              + {incompleteClients.length - 4} {t('more', '更多')}
            </div>
          ) : null}
        </ActionCard>
      </div>

      {/* Prospect pipeline actions */}
      <ActionCard
        title={t('Prospect Actions', '潜在客户跟进')}
        icon="🎯"
        count={overdueProspects.length}
        urgent={overdueProspects.length > 0}
        empty={overdueProspects.length === 0}
        emptyText={t('All prospects up to date 🎉', '所有潜在客户已跟进 🎉')}
      >
        {overdueProspects.slice(0, 4).map(prospect => {
          const isOverdue = prospect.next_action_date < todayStr;
          const dueDate = new Date(prospect.next_action_date);
          const diffDays = Math.round((today.getTime() - dueDate.getTime()) / 86400000);
          return (
            <Link key={prospect.id} to="/advisor/pipeline"
              className="flex items-center gap-2.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-4 px-4 transition-colors"
            >
              <Avatar name={prospect.full_name || '?'} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-xin-blue truncate">{prospect.full_name}</div>
                <div className="text-xs text-slate-500 truncate">{prospect.next_action}</div>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                {isOverdue ? `${diffDays}${t('d overdue', '天逾期')}` : t('Today', '今天')}
              </span>
            </Link>
          );
        })}
        {overdueProspects.length > 4 ? (
          <div className="py-2.5 text-center text-xs text-slate-400">
            + {overdueProspects.length - 4} {t('more', '更多')}
          </div>
        ) : null}
      </ActionCard>

      {/* Block C: Needs Attention */}
      {(urgentBirthdays.length > 0 || notContacted.length > 0) && (
        <ActionCard
          title={t('Needs Attention', '需要关注')}
          icon="🔔"
          count={urgentBirthdays.length + notContacted.length}
          urgent={true}
          empty={false}
          emptyText=""
        >
          {urgentBirthdays.slice(0, 3).map(c => (
            <Link key={`bday-${c.id}`} to={`/advisor/clients/${c.id}`}
              className="flex items-center gap-2.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-4 px-4 transition-colors"
            >
              <Avatar name={c.full_name} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-xin-blue truncate">{c.full_name}</div>
                <div className="text-xs text-slate-500">{c.dobFormatted}</div>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-pink-100 text-pink-600">
                🎂 {c.daysUntil === 0 ? t('Today!', '今天!') : `${c.daysUntil}d`}
              </span>
            </Link>
          ))}
          {notContacted.slice(0, 5).map(c => (
            <Link key={`nc-${c.id}`} to={`/advisor/clients/${c.id}`}
              className="flex items-center gap-2.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-4 px-4 transition-colors"
            >
              <Avatar name={c.full_name} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-xin-blue truncate">{c.full_name}</div>
                <div className="text-xs text-slate-500">
                  {c.daysSinceContact === null
                    ? t('Never contacted', '从未联系')
                    : `${c.daysSinceContact}${t(' days no contact', ' 天没联系')}`}
                </div>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-slate-100 text-slate-600">
                💬
              </span>
            </Link>
          ))}
          {(urgentBirthdays.length + notContacted.length) > 8 && (
            <div className="py-2.5 text-center text-xs text-slate-400">
              + {urgentBirthdays.length + notContacted.length - 8} {t('more', '更多')}
            </div>
          )}
        </ActionCard>
      )}

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
