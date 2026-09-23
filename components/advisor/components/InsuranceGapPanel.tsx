import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { fmtRM, planAnnualIncomeExpenses, safeNumber } from '../utils/finance';
import {
  defaultBasis, type PeriodRow,
} from '../../../supabase/functions/_shared/cashflow/periods';
import type { LiabilityRow, PolicyRow } from '../../../supabase/functions/_shared/finance/derived';
import type { StandingItem } from '../../../supabase/functions/_shared/cashflow/items';
import { computeCna, type CnaProtectionSet, type CnaResult } from '../../../supabase/functions/_shared/insurance/cna';
import { buildCfpCnaInput, type CfpFinancials } from '../../../supabase/functions/_shared/insurance/mapping';

// P5 (2026-09-26-cfp-p5-insurance-design.md 决策 1): this panel no longer owns
// any gap formula. It only fetches the live rows, shapes them into the
// CfpFinancials the shared module expects (mirrors
// cfp-brain/modules/insurance/module.ts's toCfpFinancials), and renders
// computeCna's output verbatim — the same numbers the CFP report and the
// client portal will show.

type CategoryKey = keyof CnaProtectionSet;

const CATEGORY_ROWS: Array<{ key: CategoryKey; en: string; zh: string; needBased: boolean }> = [
  { key: 'death', en: 'Death', zh: '身故', needBased: true },
  { key: 'tpd', en: 'TPD', zh: '全残（TPD）', needBased: true },
  { key: 'ci', en: 'Critical Illness', zh: '重大疾病', needBased: true },
  { key: 'ci_early_cover', en: 'Early-stage CI (cover only)', zh: '早期重疾（只显示保障）', needBased: false },
  { key: 'medical', en: 'Medical', zh: '医药', needBased: false },
  { key: 'pa', en: 'Personal Accident (cover only)', zh: '意外（只显示保障）', needBased: false },
];

const toneText: Record<string, string> = {
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-red-500',
  na: 'text-slate-400',
};

export default function InsuranceGapPanel({ clientId, refreshKey }: { clientId: string; refreshKey?: number }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [result, setResult] = useState<CnaResult | null>(null);
  const [annualIncome, setAnnualIncome] = useState<number | null>(null);
  const [excludeGroup, setExcludeGroup] = useState(false);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const [
        { data: cashflow, error: cErr },
        { data: policies, error: pErr },
        { data: liabilities, error: lErr },
        { data: items, error: iErr },
        { data: assets, error: aErr },
        { data: clientRow, error: clErr },
      ] = await Promise.all([
        supabase.from('cashflow_entries').select('amount, frequency, direction, period_month, category, linked_asset_id').eq('client_id', clientId),
        supabase.from('insurance_policies').select('id, policy_type, plan_name, provider, sum_assured, premium, premium_frequency, policy_number, cash_value, start_date, end_date, status, is_group_employer, covers_liability_id, nomination_type, policy_riders(category, sum_assured, room_board_daily, annual_limit, lifetime_limit)').eq('client_id', clientId),
        supabase.from('liabilities').select('id, name, liability_type, outstanding_balance, interest_rate, monthly_payment, remaining_months, rate_type, original_principal, end_date').eq('client_id', clientId),
        supabase.from('cashflow_items').select('*').eq('client_id', clientId),
        supabase.from('assets').select('asset_type, current_value').eq('client_id', clientId),
        supabase.from('clients').select('has_epf, date_of_birth, number_of_dependants').eq('id', clientId).maybeSingle(),
      ]);
      if (cErr || pErr || lErr || iErr || aErr || clErr) throw (cErr || pErr || lErr || iErr || aErr || clErr);

      // Same 口径 as the CFP report and the health score: read the plan
      // (cashflow_items when the client has any, otherwise the months on
      // record averaged) rather than treating each row as a standing monthly
      // commitment — spec 2026-09-25-cfp-p2b decision 1.
      const rows = (cashflow || []) as PeriodRow[];
      const { annualIncome: incomeAnnualRaw } = planAnnualIncomeExpenses({
        rows,
        liabilities: (liabilities || []) as LiabilityRow[],
        policies: (policies || []) as PolicyRow[],
        items: (items || []) as StandingItem[],
        basis: defaultBasis(rows),
        client: { has_epf: clientRow?.has_epf, date_of_birth: clientRow?.date_of_birth },
      });
      setAnnualIncome(incomeAnnualRaw > 0 ? incomeAnnualRaw : null);

      // Shape into CfpFinancials — mirrors cfp-brain/modules/insurance/
      // module.ts's toCfpFinancials, so the advisor panel and the CFP report
      // read the live rows the exact same way.
      const financials: CfpFinancials = {
        client: {
          id: clientId,
          date_of_birth: clientRow?.date_of_birth ?? null,
          number_of_dependants: clientRow?.number_of_dependants ?? 0,
          occupation: null,
          retirement_age: null,
          marital_status: null,
        },
        inflows: (cashflow || [])
          .filter((r: any) => r.direction === 'inflow')
          .map((r: any) => ({ amount: safeNumber(r.amount), frequency: r.frequency, category: r.category || '' })),
        liabilities: (liabilities || []).map((l: any) => ({
          id: l.id ?? null,
          liability_type: l.liability_type,
          name: l.name ?? '',
          outstanding_balance: safeNumber(l.outstanding_balance),
          monthly_payment: l.monthly_payment != null ? safeNumber(l.monthly_payment) : null,
        })),
        assets: (assets || []).map((a: any) => ({
          asset_type: a.asset_type,
          current_value: safeNumber(a.current_value),
        })),
        policies: (policies || []).map((p: any) => ({
          policy_type: p.policy_type,
          provider: p.provider ?? null,
          sum_assured: p.sum_assured != null ? safeNumber(p.sum_assured) : null,
          premium: p.premium != null ? safeNumber(p.premium) : null,
          premium_frequency: p.premium_frequency ?? null,
          policy_number: p.policy_number ?? null,
          cash_value: p.cash_value != null ? safeNumber(p.cash_value) : null,
          start_date: p.start_date ?? null,
          end_date: p.end_date ?? null,
          status: p.status ?? null,
          is_group_employer: p.is_group_employer ?? null,
          covers_liability_id: p.covers_liability_id ?? null,
          nomination_type: p.nomination_type ?? null,
          policy_riders: (p.policy_riders || []).map((r: any) => ({
            category: r.category,
            sum_assured: r.sum_assured != null ? safeNumber(r.sum_assured) : null,
            room_board_daily: r.room_board_daily != null ? safeNumber(r.room_board_daily) : null,
            annual_limit: r.annual_limit != null ? safeNumber(r.annual_limit) : null,
            lifetime_limit: r.lifetime_limit != null ? safeNumber(r.lifetime_limit) : null,
          })),
        })),
      };

      // The plan's income wins over mapping.ts's own row-by-row
      // annualizeInflows fallback (which is wrong for cashflow_entries
      // actuals — see mapping.ts's own doc comment on annualizeInflows).
      const cnaInput = buildCfpCnaInput(financials, { annual_income: incomeAnnualRaw });
      setResult(computeCna(cnaInput));
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
      setResult(null);
      setAnnualIncome(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [clientId, refreshKey]);

  const activeSet: CnaProtectionSet | null = useMemo(() => {
    if (!result) return null;
    return excludeGroup ? result.excluding_group : result;
  }, [result, excludeGroup]);

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
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 select-none cursor-pointer">
            <input type="checkbox" checked={excludeGroup} onChange={e => setExcludeGroup(e.target.checked)} className="rounded border-slate-300" />
            {t('Exclude group cover', '不含团保')}
          </label>
          <button
            onClick={load}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            {t('Refresh', '刷新')}
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{err}</div>
      ) : null}

      {activeSet && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] bg-slate-50 text-[11px] font-semibold text-slate-500 px-4 py-2">
            <div>{t('Type', '类型')}</div>
            <div>{t('Need', '需求')}</div>
            <div>{t('Cover', '现有保障')}</div>
            <div>{t('Gap', '缺口')}</div>
          </div>
          {CATEGORY_ROWS.map(row => {
            const item = activeSet[row.key];
            const isInsufficient = row.needBased && result?.insufficient;
            const need = item.need;
            const gap = item.gap;
            const tone: 'good' | 'warn' | 'bad' | 'na' = (() => {
              if (row.key === 'medical') {
                const m = item as CnaResult['medical'];
                if (!m.has_cover) return 'bad';
                if (m.low_limit) return 'warn';
                return 'good';
              }
              if (!row.needBased || isInsufficient || need == null) return 'na';
              return (gap ?? 0) > 0 ? 'bad' : 'good';
            })();
            return (
              <div key={row.key} className="px-4 py-2.5 border-t border-slate-50 text-xs">
                <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center">
                  <div className="font-semibold text-xin-blue">{t(row.en, row.zh)}</div>
                  <div className="text-slate-600">{row.needBased && !isInsufficient && need != null ? `RM ${fmtRM(need)}` : '—'}</div>
                  <div className="text-slate-600">
                    {row.key === 'medical'
                      ? (item as CnaResult['medical']).has_cover
                        ? `${t('Yes', '有')}${(item as CnaResult['medical']).annual_limit > 0 ? ` · RM ${fmtRM((item as CnaResult['medical']).annual_limit)}/${t('yr', '年')}` : ''}`
                        : t('None', '无')
                      : `RM ${fmtRM(item.cover)}`}
                  </div>
                  <div className={`font-bold ${toneText[tone]}`}>
                    {row.needBased && !isInsufficient && gap != null ? `RM ${fmtRM(gap)}` : '—'}
                  </div>
                </div>
                {item.notes.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {item.notes.map((n, i) => (
                      <div key={i} className="text-[11px] text-slate-400">{n}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
