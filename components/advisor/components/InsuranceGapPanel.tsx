import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { fmtRM, safeNumber, toMonthly } from '../utils/finance';

type Row = {
  label: string;
  recommended: string;
  actual: string;
  gap: string;
  tone: 'good' | 'warn' | 'bad' | 'na';
};

const toneText: Record<string, string> = {
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-red-500',
  na: 'text-slate-400',
};

export default function InsuranceGapPanel({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [annualIncome, setAnnualIncome] = useState<number | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const [{ data: cashflow, error: cErr }, { data: policies, error: pErr }] = await Promise.all([
        supabase.from('cashflow_entries').select('amount, frequency, direction').eq('client_id', clientId),
        supabase.from('insurance_policies').select('sum_assured, policy_type, end_date').eq('client_id', clientId),
      ]);
      if (cErr || pErr) throw (cErr || pErr);

      const monthlyIncome = (cashflow || [])
        .filter((e: any) => (e.direction || '').toLowerCase() === 'inflow')
        .reduce((s: number, e: any) => s + toMonthly(safeNumber(e.amount), e.frequency), 0);
      const incomeAnnual = monthlyIncome > 0 ? monthlyIncome * 12 : null;
      setAnnualIncome(incomeAnnual);

      const activePolicies = (policies || []).filter((p: any) => !p.end_date || p.end_date >= today);
      const sumAssuredByTypes = (types: string[]) => activePolicies
        .filter((p: any) => types.includes(String(p.policy_type || '').toLowerCase()))
        .reduce((s: number, p: any) => s + safeNumber(p.sum_assured), 0);

      const actualLife = sumAssuredByTypes(['life', 'investment_linked']);
      const actualCI = sumAssuredByTypes(['critical_illness']);
      const hasMedical = activePolicies.some((p: any) => String(p.policy_type || '').toLowerCase() === 'medical');

      if (!incomeAnnual) {
        setRows([
          { label: t('Life Insurance', '人寿保险'), recommended: '—', actual: actualLife > 0 ? `RM ${fmtRM(actualLife)}` : 'RM 0', gap: '—', tone: 'na' },
          { label: t('Critical Illness', '重大疾病'), recommended: '—', actual: actualCI > 0 ? `RM ${fmtRM(actualCI)}` : 'RM 0', gap: '—', tone: 'na' },
          { label: t('Medical Card', '医疗卡'), recommended: t('Required', '需要'), actual: hasMedical ? t('Yes', '有') : t('None', '无'), gap: hasMedical ? t('OK', '正常') : t('Missing', '缺失'), tone: hasMedical ? 'good' : 'bad' },
        ]);
        return;
      }

      const recLife = incomeAnnual * 10;
      const recCI = incomeAnnual * 4;
      const gapLife = Math.max(0, recLife - actualLife);
      const gapCI = Math.max(0, recCI - actualCI);

      const toneLife = gapLife <= 0 ? 'good' : 'bad';
      const toneCI = gapCI <= 0 ? 'good' : 'bad';

      setRows([
        {
          label: t('Life Insurance', '人寿保险'),
          recommended: `RM ${fmtRM(recLife)}`,
          actual: `RM ${fmtRM(actualLife)}`,
          gap: `RM ${fmtRM(gapLife)}`,
          tone: toneLife,
        },
        {
          label: t('Critical Illness', '重大疾病'),
          recommended: `RM ${fmtRM(recCI)}`,
          actual: `RM ${fmtRM(actualCI)}`,
          gap: `RM ${fmtRM(gapCI)}`,
          tone: toneCI,
        },
        {
          label: t('Medical Card', '医疗卡'),
          recommended: t('Required', '需要'),
          actual: hasMedical ? t('Yes', '有') : t('None', '无'),
          gap: hasMedical ? t('OK', '正常') : t('Missing', '缺失'),
          tone: hasMedical ? 'good' : 'bad',
        }
      ]);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
      setRows([]);
      setAnnualIncome(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [clientId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
        <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-xin-blue">{t('Coverage Analysis', '保障缺口分析')}</div>
          {annualIncome ? (
            <div className="text-xs text-slate-400 mt-0.5">
              {t('Based on annual income of', '基于年收入')} RM {fmtRM(annualIncome)}
            </div>
          ) : (
            <div className="text-xs text-slate-400 mt-0.5">{t('Add income entries in Cash Flow tab to compute recommended coverage.', '请先在收支里填写收入，以计算建议保障。')}</div>
          )}
        </div>
        <button
          onClick={load}
          className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
        >
          {t('Refresh', '刷新')}
        </button>
      </div>

      {err ? (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{err}</div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] bg-slate-50 text-[11px] font-semibold text-slate-500 px-4 py-2">
          <div>{t('Type', '类型')}</div>
          <div>{t('Recommended', '建议')}</div>
          <div>{t('Actual', '现有')}</div>
          <div>{t('Gap', '缺口')}</div>
        </div>
        {rows.map(r => (
          <div key={r.label} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] px-4 py-2.5 border-t border-slate-50 text-xs">
            <div className="font-semibold text-xin-blue">{r.label}</div>
            <div className="text-slate-600">{r.recommended}</div>
            <div className="text-slate-600">{r.actual}</div>
            <div className={`font-bold ${toneText[r.tone]}`}>{r.gap}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

