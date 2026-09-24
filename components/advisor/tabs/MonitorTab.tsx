import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fmtRM } from '../utils/finance';
import { isMissingTableError } from '../assets/degrade';
import { monthsBetweenFractional } from '../review/dateMath';
import {
  planCashflow, type LiabilityRow, type PolicyRow,
} from '../../../supabase/functions/_shared/finance/derived';
import { defaultBasis, type PeriodRow } from '../../../supabase/functions/_shared/cashflow/periods';
import type { StandingItem } from '../../../supabase/functions/_shared/cashflow/items';
import {
  computeAlerts, type Alert, type AlertLiability, type AlertPolicy, type AlertReview, type AlertSeverity, type AlertSnapshot,
} from '../../../supabase/functions/_shared/finance/alerts';

// CFP P4 Task B — 客户详情「监控」: actual net worth (health_snapshots) vs a
// plan-projection line, small multiples for the trend ratios, an
// unexplained-gap bar chart, and the client's current alerts.
// spec docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md
// 决策 3, 5, 6 (客户详情新增「监控」).
//
// `reviews` (and health_snapshots.unexplained_gap, which only exists once
// the same P4 migration has run) may not exist in every environment yet —
// this tab degrades to "no review data" rather than crashing, same pattern
// as NetworthTab/PortfolioTab already use for asset_valuations (P3).

const SEVERITY_STYLE: Record<AlertSeverity, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  low: { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' },
};

const fmtMonth = (d: string) => {
  if (!d) return '';
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-MY', { month: 'short', year: '2-digit' });
};

export default function MonitorTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsUnavailable, setReviewsUnavailable] = useState(false);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: snaps }, { data: l }, { data: cf }, { data: it }, { data: p }, { data: cl }] = await Promise.all([
      supabase.from('health_snapshots').select('*').eq('client_id', clientId).order('snapshot_date'),
      supabase.from('liabilities').select('id, name, liability_type, outstanding_balance, interest_rate, monthly_payment, remaining_months, rate_type, original_principal, end_date').eq('client_id', clientId),
      supabase.from('cashflow_entries').select('amount, frequency, direction, period_month, category').eq('client_id', clientId),
      supabase.from('cashflow_items').select('*').eq('client_id', clientId),
      supabase.from('insurance_policies').select('id, policy_type, plan_name, provider, premium, premium_frequency, status, sum_assured, end_date').eq('client_id', clientId),
      supabase.from('clients').select('has_epf, date_of_birth').eq('id', clientId).maybeSingle(),
    ]);
    setSnapshots(snaps || []);
    setLiabilities(l || []);
    setCashflow(cf || []);
    setItems(it || []);
    setPolicies(p || []);
    setClient(cl || null);

    // reviews (P4) may not exist in every environment yet — degrade to "no
    // review-cadence alerts" instead of failing the whole tab.
    try {
      const { data: rv, error } = await supabase.from('reviews').select('id, kind, status, period_end, approved_at').eq('client_id', clientId);
      if (error) throw error;
      setReviews(rv || []);
      setReviewsUnavailable(false);
    } catch (e) {
      setReviews([]);
      setReviewsUnavailable(isMissingTableError(e as any));
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [clientId]);

  // ---- plan-projection line (决策 3/6): from the FIRST snapshot, net worth
  // extrapolated by the current plan's monthly explained increment (surplus
  // + principal + employer EPF — the same three terms reconcile.ts's
  // `explained` carries, minus the unpredictable market-change term, since a
  // "plan" line has no way to know future market moves). ----
  const monthlyExplained = useMemo(() => {
    const rows = (cashflow || []) as PeriodRow[];
    const itemRows = (items || []) as StandingItem[];
    const plan = planCashflow({
      rows,
      liabilities: (liabilities || []) as LiabilityRow[],
      policies: (policies || []) as PolicyRow[],
      basis: defaultBasis(rows),
      items: itemRows,
      client: { has_epf: client?.has_epf, date_of_birth: client?.date_of_birth },
    });
    const surplus = plan.totals.monthly_income - plan.totals.monthly_expenses;
    return surplus + plan.monthly_principal + plan.monthly_employer_epf;
  }, [cashflow, items, liabilities, policies, client]);

  const netWorthChartData = useMemo(() => {
    if (snapshots.length === 0) return [];
    const first = snapshots[0];
    return snapshots.map((s: any) => ({
      date: s.snapshot_date,
      actual: Number(s.net_worth) || 0,
      plan: (Number(first.net_worth) || 0) + monthlyExplained * monthsBetweenFractional(first.snapshot_date, s.snapshot_date),
    }));
  }, [snapshots, monthlyExplained]);

  const ratioChartData = useMemo(() => snapshots.map((s: any) => ({
    date: s.snapshot_date,
    savings: s.savings_ratio == null ? null : Number(s.savings_ratio) * 100,
    dsr: s.debt_service_ratio == null ? null : Number(s.debt_service_ratio) * 100,
    emergency: s.basic_liquidity_ratio == null ? null : Number(s.basic_liquidity_ratio),
  })), [snapshots]);

  const gapChartData = useMemo(() => snapshots
    .filter((s: any) => s.unexplained_gap != null)
    .map((s: any) => ({ date: s.snapshot_date, gap: Number(s.unexplained_gap) || 0 })), [snapshots]);

  const alerts: Alert[] = useMemo(() => {
    if (snapshots.length === 0) return [];
    const history: AlertSnapshot[] = snapshots.slice(0, -1).map((s: any) => ({
      snapshot_date: s.snapshot_date,
      net_worth: s.net_worth,
      debt_service_ratio: s.debt_service_ratio,
      basic_liquidity_ratio: s.basic_liquidity_ratio,
      unexplained_gap: s.unexplained_gap,
    }));
    const latest = snapshots[snapshots.length - 1];
    const latestSnapshot: AlertSnapshot = {
      snapshot_date: latest.snapshot_date,
      net_worth: latest.net_worth,
      debt_service_ratio: latest.debt_service_ratio,
      basic_liquidity_ratio: latest.basic_liquidity_ratio,
      unexplained_gap: latest.unexplained_gap,
    };
    const alertReviews: AlertReview[] = reviews.map((r: any) => ({
      kind: r.kind, status: r.status, period_end: r.period_end, approved_at: r.approved_at,
    }));
    const alertLiabilities: AlertLiability[] = (liabilities || []).map((l: any) => ({
      id: l.id, name: l.name, liability_type: l.liability_type, outstanding_balance: l.outstanding_balance,
      interest_rate: l.interest_rate, monthly_payment: l.monthly_payment, remaining_months: l.remaining_months,
      rate_type: l.rate_type, original_principal: l.original_principal, end_date: l.end_date,
    }));
    const alertPolicies: AlertPolicy[] = (policies || []).map((p: any) => ({
      policy_type: p.policy_type, premium: p.premium, premium_frequency: p.premium_frequency,
      status: p.status, provider: p.provider, plan_name: p.plan_name,
    }));
    return computeAlerts({
      client_id: clientId,
      snapshots: history,
      latestSnapshot,
      reviews: alertReviews,
      liabilities: alertLiabilities,
      policies: alertPolicies,
      asOf: new Date(),
    });
  }, [snapshots, reviews, liabilities, policies, clientId]);

  if (loading) return <Loader />;

  return (
    <div className="space-y-5">
      {reviewsUnavailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
          {t('Review-cadence features are pending a database upgrade.', '复检功能待数据库升级后启用。')}
        </div>
      )}

      {snapshots.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm shadow-sm">
          {t('No health snapshots yet — they build up automatically as this client\'s profile is reviewed.', '暂无健康快照 — 复检该客户资料后会自动累积。')}
        </div>
      ) : (
        <>
          {/* Net worth: actual vs plan */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-xin-blue mb-3">{t('Net Worth — Actual vs Plan', '净资产 — 实际 vs 计划')}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={netWorthChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={fmtMonth} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} width={60} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <RTooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: 14, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, name: string) => [`RM ${fmtRM(value)}`, name === 'actual' ? t('Actual', '实际') : t('Plan', '计划')]}
                    labelFormatter={fmtMonth}
                  />
                  <Line type="monotone" dataKey="actual" stroke="#0f2f5c" strokeWidth={2.5} dot={{ fill: '#0f2f5c', r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="plan" stroke="#d8c195" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Small multiples */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RatioMini title={t('Savings Ratio', '储蓄率')} data={ratioChartData} dataKey="savings" color="#059669" fmt={(v: number) => `${v.toFixed(0)}%`} fmtMonth={fmtMonth} />
            <RatioMini title={t('DSR', '负债比')} data={ratioChartData} dataKey="dsr" color="#dc2626" fmt={(v: number) => `${v.toFixed(0)}%`} fmtMonth={fmtMonth} />
            <RatioMini title={t('Emergency Fund (months)', '紧急预备金（月）')} data={ratioChartData} dataKey="emergency" color="#2563eb" fmt={(v: number) => `${v.toFixed(1)}mo`} fmtMonth={fmtMonth} />
          </div>

          {/* Unexplained gap */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-xin-blue mb-1">{t('Unexplained Gap per Review', '每次复检的未解释差额')}</h3>
            <p className="text-xs text-slate-400 mb-3">{t('ΔNet worth not explained by plan savings, principal repaid or market movement.', '净资产变化中无法用计划结余、还款本金或市场变动解释的部分。')}</p>
            {gapChartData.length === 0 ? (
              <div className="py-8 text-center text-slate-300 text-xs">{t('No reconciled reviews yet.', '还没有可对账的复检记录。')}</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gapChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={fmtMonth} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} width={60} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <RTooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: 14, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => [`RM ${fmtRM(value)}`, t('Unexplained', '未解释')]}
                      labelFormatter={fmtMonth}
                    />
                    <Bar dataKey="gap" radius={[4, 4, 0, 0]}>
                      {gapChartData.map((d, i) => (
                        <Cell key={i} fill={Math.abs(d.gap) > 5000 ? '#dc2626' : '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}

      {/* Alerts */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-xin-blue">{t('Current Alerts', '当前提醒')}</h3>
          {alerts.length > 0 && <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-600">{alerts.length}</span>}
        </div>
        {alerts.length === 0 ? (
          <div className="py-8 text-center text-emerald-500 text-sm">✓ {t('No alerts.', '暂无提醒。')}</div>
        ) : (
          <div className="px-5 py-2">
            {alerts.map((a, i) => {
              const s = SEVERITY_STYLE[a.severity];
              return (
                <div key={`${a.code}-${i}`} className={`flex items-start gap-3 py-3 border-b border-slate-50 last:border-0`}>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${s.bg} ${s.text}`}>
                    {a.severity === 'high' ? t('High', '严重') : a.severity === 'medium' ? t('Medium', '中等') : t('Low', '低')}
                  </span>
                  <span className="text-sm text-slate-600">{language === 'zh' ? a.message_zh : a.message_en}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RatioMini({ title, data, dataKey, color, fmt, fmtMonth }: {
  title: string; data: any[]; dataKey: string; color: string; fmt: (v: number) => string; fmtMonth: (d: string) => string;
}) {
  const values = data.map(d => d[dataKey]).filter((v: number | null) => v != null);
  const latest = values.length > 0 ? values[values.length - 1] : null;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">{title}</span>
        <span className="text-sm font-bold" style={{ color }}>{latest == null ? '—' : fmt(latest)}</span>
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <RTooltip
              contentStyle={{ backgroundColor: '#fff', borderRadius: 10, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: 11 }}
              formatter={(value: number) => [fmt(value), '']}
              labelFormatter={fmtMonth}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" /></div>;
}
