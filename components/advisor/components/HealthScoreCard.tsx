import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { RefreshCw } from 'lucide-react';
import { firstDayOfCurrentMonth, fmtMultiplier, fmtPercent, fmtRM, safeNumber, toMonthly, yyyyMmDd } from '../utils/finance';

type Tone = 'good' | 'warn' | 'bad' | 'na';

const toneStyles: Record<Tone, { value: string; pill: string }> = {
  good: { value: 'text-emerald-600', pill: 'bg-emerald-100 text-emerald-700' },
  warn: { value: 'text-amber-600', pill: 'bg-amber-100 text-amber-700' },
  bad: { value: 'text-red-500', pill: 'bg-red-100 text-red-600' },
  na: { value: 'text-slate-400', pill: 'bg-slate-100 text-slate-500' },
};

export default function HealthScoreCard({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>('');

  const [data, setData] = useState<{
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlySurplus: number;
    totalMonthlyLoanRepayment: number;
    liquidAssets: number;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    lifeSumAssured: number;
  } | null>(null);

  const snapshotDate = useMemo(() => firstDayOfCurrentMonth(), []);
  const snapshotDateStr = useMemo(() => yyyyMmDd(snapshotDate), [snapshotDate]);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const [{ data: assets, error: aErr }, { data: liabilities, error: lErr }, { data: cashflow, error: cErr }, { data: policies, error: pErr }] = await Promise.all([
        supabase.from('assets').select('current_value, liquidity').eq('client_id', clientId),
        supabase.from('liabilities').select('outstanding_balance, monthly_payment').eq('client_id', clientId),
        supabase.from('cashflow_entries').select('amount, frequency, direction').eq('client_id', clientId),
        supabase.from('insurance_policies').select('sum_assured, policy_type, end_date').eq('client_id', clientId),
      ]);

      const combinedError = aErr || lErr || cErr || pErr;
      if (combinedError) throw combinedError;

      const monthlyIncome = (cashflow || [])
        .filter((e: any) => (e.direction || '').toLowerCase() === 'inflow')
        .reduce((s: number, e: any) => s + toMonthly(safeNumber(e.amount), e.frequency), 0);
      const monthlyExpenses = (cashflow || [])
        .filter((e: any) => (e.direction || '').toLowerCase() === 'outflow')
        .reduce((s: number, e: any) => s + toMonthly(safeNumber(e.amount), e.frequency), 0);
      const monthlySurplus = monthlyIncome - monthlyExpenses;

      const totalMonthlyLoanRepayment = (liabilities || [])
        .reduce((s: number, l: any) => s + safeNumber(l.monthly_payment), 0);

      const liquidAssets = (assets || [])
        .filter((a: any) => String(a.liquidity || '').toLowerCase() === 'high')
        .reduce((s: number, a: any) => s + safeNumber(a.current_value), 0);

      const totalAssets = (assets || []).reduce((s: number, a: any) => s + safeNumber(a.current_value), 0);
      const totalLiabilities = (liabilities || []).reduce((s: number, l: any) => s + safeNumber(l.outstanding_balance), 0);
      const netWorth = totalAssets - totalLiabilities;

      const activePolicies = (policies || []).filter((p: any) => !p.end_date || p.end_date >= today);
      const lifeSumAssured = activePolicies
        .filter((p: any) => ['life', 'investment_linked'].includes(String(p.policy_type || '').toLowerCase()))
        .reduce((s: number, p: any) => s + safeNumber(p.sum_assured), 0);

      setData({
        monthlyIncome,
        monthlyExpenses,
        monthlySurplus,
        totalMonthlyLoanRepayment,
        liquidAssets,
        totalAssets,
        totalLiabilities,
        netWorth,
        lifeSumAssured,
      });
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveSnapshotIfPossible(payload: any) {
    try {
      setSaving(true);
      const { error } = await supabase.from('health_snapshots').upsert(payload, { onConflict: 'client_id,snapshot_date' });
      if (error) throw error;
    } catch {
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { load(); }, [clientId]);

  const metrics = useMemo(() => {
    if (!data) return null;

    const annualIncome = data.monthlyIncome * 12;
    const savingsRate = data.monthlyIncome > 0 ? (data.monthlySurplus / data.monthlyIncome) * 100 : null;
    const dsr = data.monthlyIncome > 0 ? (data.totalMonthlyLoanRepayment / data.monthlyIncome) * 100 : null;
    const emergencyMonths = data.monthlyExpenses > 0 ? (data.liquidAssets / data.monthlyExpenses) : null;
    const lifeCoverage = annualIncome > 0 ? (data.lifeSumAssured / annualIncome) : null;

    const toneSavings: Tone = savingsRate === null ? 'na' : (savingsRate >= 20 ? 'good' : (savingsRate >= 10 ? 'warn' : 'bad'));
    const toneDSR: Tone = dsr === null ? 'na' : (dsr < 40 ? 'good' : (dsr <= 60 ? 'warn' : 'bad'));
    const toneEmergency: Tone = emergencyMonths === null ? 'na' : (emergencyMonths >= 6 ? 'good' : (emergencyMonths >= 3 ? 'warn' : 'bad'));
    const toneLife: Tone = lifeCoverage === null ? 'na' : (lifeCoverage >= 10 ? 'good' : (lifeCoverage >= 5 ? 'warn' : 'bad'));
    const toneNW: Tone = data.netWorth === 0 ? 'warn' : (data.netWorth > 0 ? 'good' : 'bad');

    return {
      annualIncome,
      savingsRate,
      dsr,
      emergencyMonths,
      lifeCoverage,
      toneSavings,
      toneDSR,
      toneEmergency,
      toneLife,
      toneNW,
    };
  }, [data]);

  useEffect(() => {
    if (!data || !metrics) return;
    const payload = {
      client_id: clientId,
      snapshot_date: snapshotDateStr,
      net_worth: data.netWorth,
      total_assets: data.totalAssets,
      total_liabilities: data.totalLiabilities,
      savings_ratio: metrics.savingsRate === null ? null : metrics.savingsRate / 100,
      debt_service_ratio: metrics.dsr === null ? null : metrics.dsr / 100,
      basic_liquidity_ratio: metrics.emergencyMonths === null ? null : metrics.emergencyMonths,
      life_insurance_coverage: metrics.lifeCoverage === null ? null : metrics.lifeCoverage,
      raw_metrics: {
        monthly_income: data.monthlyIncome,
        monthly_expenses: data.monthlyExpenses,
        monthly_surplus: data.monthlySurplus,
        total_monthly_loan_repayment: data.totalMonthlyLoanRepayment,
        liquid_assets: data.liquidAssets,
        total_life_sum_assured: data.lifeSumAssured,
        annual_income: metrics.annualIncome,
      }
    };
    saveSnapshotIfPossible(payload);
  }, [clientId, data, metrics, snapshotDateStr]);

  const updatedText = useMemo(() => {
    const d = new Date(snapshotDateStr);
    return d.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-MY', { year: 'numeric', month: 'short' });
  }, [language, snapshotDateStr]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-xin-blue">{t('Financial Health Overview', '财务健康概览')}</div>
          <div className="h-8 w-20 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-slate-50 rounded-2xl p-4">
              <div className="h-3 w-16 bg-slate-200 rounded animate-pulse mb-2" />
              <div className="h-6 w-20 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-xin-blue truncate">{t('Financial Health Overview', '财务健康概览')}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {t(`Data as of ${updatedText}`, `数据日期：${updatedText}`)}
            {saving ? t(' · Saving…', ' · 保存中…') : ''}
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
        >
          <RefreshCw size={14} />
          {t('Refresh', '刷新')}
        </button>
      </div>

      {err ? (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{err}</div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
        <Metric
          title={t('Savings Rate', '储蓄率')}
          value={metrics?.savingsRate === null ? '—' : fmtPercent(metrics!.savingsRate)}
          tone={metrics?.toneSavings || 'na'}
          subtitle={t('Monthly surplus / income', '月结余 / 月收入')}
          language={language}
        />
        <Metric
          title={t('DSR', '负债比')}
          value={metrics?.dsr === null ? '—' : fmtPercent(metrics!.dsr)}
          tone={metrics?.toneDSR || 'na'}
          subtitle={t('Loan repayment / income', '每月还款 / 月收入')}
          language={language}
        />
        <Metric
          title={t('Emergency Fund', '紧急预备金')}
          value={metrics?.emergencyMonths === null ? '—' : `${metrics!.emergencyMonths.toFixed(1)}mo`}
          tone={metrics?.toneEmergency || 'na'}
          subtitle={t('Liquid assets / expenses', '高流动资产 / 月支出')}
          language={language}
        />
        <Metric
          title={t('Life Coverage', '人寿保障倍数')}
          value={metrics?.lifeCoverage === null ? '—' : fmtMultiplier(metrics!.lifeCoverage)}
          tone={metrics?.toneLife || 'na'}
          subtitle={t('Life SA / annual income', '寿险保额 / 年收入')}
          language={language}
        />
        <Metric
          title={t('Net Worth', '净资产')}
          value={data ? `RM ${fmtRM(data.netWorth)}` : '—'}
          tone={metrics?.toneNW || 'na'}
          subtitle={t('Assets - liabilities', '资产 - 负债')}
          language={language}
        />
      </div>
    </div>
  );
}

function Metric({ title, value, tone, subtitle, language }: { title: string; value: string; tone: Tone; subtitle: string; language: string }) {
  const s = toneStyles[tone];
  const labelMapEn: Record<Tone, string> = { good: 'Healthy', warn: 'Warning', bad: 'Critical', na: 'N/A' };
  const labelMapZh: Record<Tone, string> = { good: '健康', warn: '注意', bad: '危险', na: '不足' };
  const label = language === 'zh' ? labelMapZh[tone] : labelMapEn[tone];

  return (
    <div className="bg-slate-50 rounded-2xl p-4">
      <div className="text-[11px] text-slate-500 font-semibold">{title}</div>
      <div className={`text-2xl font-bold mt-1 ${s.value}`}>{value}</div>
      <div className="flex items-center justify-between mt-2 gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.pill}`}>{label}</span>
        <span className="text-[10px] text-slate-400 truncate">{subtitle}</span>
      </div>
    </div>
  );
}

