import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { RefreshCw } from 'lucide-react';
import { firstDayOfCurrentMonth, fmtMultiplier, fmtPercent, fmtRM, yyyyMmDd } from '../utils/finance';
import type { PeriodRow } from '../../../supabase/functions/_shared/cashflow/periods';
import {
  computeSnapshot, type LiabilityRow, type PolicyRow, type SnapshotResult,
} from '../../../supabase/functions/_shared/finance/snapshot';
import type { StandingItem } from '../../../supabase/functions/_shared/cashflow/items';

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

  // P4 Task B — computeSnapshot() is now the ONE place these ratios are
  // computed (spec docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md
  // 决策 3), replacing this component's own hand-rolled math. See the note
  // above `metrics` below for the two figures that change value as a result.
  const [snapshot, setSnapshot] = useState<SnapshotResult | null>(null);

  const snapshotDate = useMemo(() => firstDayOfCurrentMonth(), []);
  const snapshotDateStr = useMemo(() => yyyyMmDd(snapshotDate), [snapshotDate]);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const [{ data: assets, error: aErr }, { data: liabilities, error: lErr }, { data: cashflow, error: cErr }, { data: policies, error: pErr }, { data: items, error: iErr }, { data: clientRow, error: clErr }] = await Promise.all([
        supabase.from('assets').select('current_value, asset_type, ownership_pct').eq('client_id', clientId),
        supabase.from('liabilities').select('id, name, liability_type, outstanding_balance, interest_rate, monthly_payment, remaining_months, rate_type, original_principal, end_date').eq('client_id', clientId),
        supabase.from('cashflow_entries').select('amount, frequency, direction, period_month, category').eq('client_id', clientId),
        supabase.from('insurance_policies').select('id, policy_type, plan_name, provider, premium, premium_frequency, sum_assured, end_date').eq('client_id', clientId),
        supabase.from('cashflow_items').select('*').eq('client_id', clientId),
        supabase.from('clients').select('has_epf, date_of_birth').eq('id', clientId).maybeSingle(),
      ]);

      const combinedError = aErr || lErr || cErr || pErr || iErr || clErr;
      if (combinedError) throw combinedError;

      // P4 Task B — computeSnapshot() (_shared/finance/snapshot.ts) is now
      // the shared definition for every one of these ratios, used verbatim
      // by ReviewTab's approval flow, MonitorTab and this card, so all three
      // read the same numbers. It wraps the same planCashflow() this card
      // used to call directly (same averaging-vs-items behaviour, same
      // installment/premium folding — see its own header for why that
      // matters), so savings ratio, DSR and life coverage are UNCHANGED.
      // Two figures DO change value, both deliberately (spec 决策 3 "assets
      // counted at ownership_pct"): total_assets/net_worth and the emergency
      // fund's liquid-assets total are now weighted by each asset's
      // ownership_pct instead of summing raw current_value — this card
      // previously ignored ownership_pct entirely. For a solely-owned asset
      // (ownership_pct defaults to 100) the number is identical; it only
      // moves for a jointly-owned asset, where it now correctly counts only
      // the client's own share, consistent with every other CFP screen.
      const snap = computeSnapshot({
        assets: (assets || []) as { asset_type: string; current_value: number; ownership_pct?: number | null }[],
        liabilities: (liabilities || []) as LiabilityRow[],
        rows: (cashflow || []) as PeriodRow[],
        items: (items || []) as StandingItem[],
        policies: (policies || []) as PolicyRow[],
        client: { has_epf: clientRow?.has_epf, date_of_birth: clientRow?.date_of_birth },
        asOf: new Date(),
      });
      setSnapshot(snap);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
      setSnapshot(null);
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
    if (!snapshot) return null;

    const savingsRate = snapshot.savings_ratio === null ? null : snapshot.savings_ratio * 100;
    const dsr = snapshot.debt_service_ratio === null ? null : snapshot.debt_service_ratio * 100;
    const emergencyMonths = snapshot.basic_liquidity_ratio;
    const lifeCoverage = snapshot.life_insurance_coverage;
    const netWorth = snapshot.net_worth;

    const toneSavings: Tone = savingsRate === null ? 'na' : (savingsRate >= 20 ? 'good' : (savingsRate >= 10 ? 'warn' : 'bad'));
    const toneDSR: Tone = dsr === null ? 'na' : (dsr < 40 ? 'good' : (dsr <= 60 ? 'warn' : 'bad'));
    const toneEmergency: Tone = emergencyMonths === null ? 'na' : (emergencyMonths >= 6 ? 'good' : (emergencyMonths >= 3 ? 'warn' : 'bad'));
    const toneLife: Tone = lifeCoverage === null ? 'na' : (lifeCoverage >= 10 ? 'good' : (lifeCoverage >= 5 ? 'warn' : 'bad'));
    const toneNW: Tone = netWorth === 0 ? 'warn' : (netWorth > 0 ? 'good' : 'bad');

    return {
      netWorth,
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
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    // Every metric column computeSnapshot exposes — including the ones this
    // card doesn't display (solvency_ratio, non_mortgage_dsr,
    // invest_assets_to_net_worth, passive_income_coverage,
    // liquid_asset_to_net_worth) — so MonitorTab's trend charts and any
    // other reader of health_snapshots get a fully-populated row from this
    // automatic write, not just the five figures this card shows. This is
    // an automatic "heartbeat" snapshot (fires on every page load), separate
    // from a review-driven one: `review_id`/`unexplained_gap` are
    // deliberately left out of the payload so upserting here never clobbers
    // those columns on a row a review approval already wrote.
    const payload = {
      client_id: clientId,
      snapshot_date: snapshotDateStr,
      net_worth: snapshot.net_worth,
      total_assets: snapshot.total_assets,
      total_liabilities: snapshot.total_liabilities,
      savings_ratio: snapshot.savings_ratio,
      debt_service_ratio: snapshot.debt_service_ratio,
      basic_liquidity_ratio: snapshot.basic_liquidity_ratio,
      life_insurance_coverage: snapshot.life_insurance_coverage,
      liquid_asset_to_net_worth: snapshot.liquid_asset_to_net_worth,
      solvency_ratio: snapshot.solvency_ratio,
      non_mortgage_dsr: snapshot.non_mortgage_dsr,
      invest_assets_to_net_worth: snapshot.invest_assets_to_net_worth,
      passive_income_coverage: snapshot.passive_income_coverage,
      raw_metrics: snapshot.raw_metrics,
    };
    saveSnapshotIfPossible(payload);
  }, [clientId, snapshot, snapshotDateStr]);

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
          value={snapshot ? `RM ${fmtRM(snapshot.net_worth)}` : '—'}
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

