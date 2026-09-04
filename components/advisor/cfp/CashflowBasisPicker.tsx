import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AlertTriangle } from 'lucide-react';
import {
  defaultBasis, formatBasis, monthlyBreakdown, recordedYears,
  type CashflowBasis, type PeriodRow,
} from '../../../supabase/functions/_shared/cashflow/periods';
import type { T } from './primitives';

// Which months of actuals the whole plan is annualised from.
//
// Every ratio in the report — savings rate, emergency fund, retirement capital,
// the budget waterfall — is built on this one choice, and it is a JUDGEMENT, not
// a calculation: a month holding one entry might be a lean month or a
// half-entered one, and only the advisor knows which. So the per-month record
// sits right next to the control rather than behind it.
//
// Changing the basis changes every figure in the report, which is why it is part
// of each section's fingerprint: approved sections are withdrawn for re-reading
// the moment it moves. See supabase/functions/cfp-brain/fingerprint.ts.

const MONTHS_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt = (n: number) => n.toLocaleString('en-MY', { maximumFractionDigits: 0 });

export default function CashflowBasisPicker({
  clientId, partnerClientId, reportId, planningInputs, t, language, onSaved,
}: {
  clientId: string;
  /** joint plan — both spouses' months are on the same basis */
  partnerClientId?: string | null;
  reportId: string;
  // deno-lint-ignore no-explicit-any
  planningInputs: any;
  t: T;
  language: 'en' | 'zh';
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const saved: CashflowBasis | null = planningInputs?.cashflow_basis ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = partnerClientId ? [clientId, partnerClientId] : [clientId];
      const { data } = await supabase
        .from('cashflow_entries')
        .select('direction, amount, frequency, period_month, category, linked_asset_id')
        .in('client_id', ids);
      if (!cancelled) { setRows((data ?? []) as PeriodRow[]); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [clientId, partnerClientId]);

  const years = useMemo(() => recordedYears(rows), [rows]);
  const fallback = useMemo(() => defaultBasis(rows), [rows]);
  const effective = saved ?? fallback;

  const [draft, setDraft] = useState<CashflowBasis | null>(null);
  useEffect(() => { setDraft(effective); }, [saved, fallback]);

  const breakdown = useMemo(
    () => (draft ? monthlyBreakdown(rows, draft.year) : []),
    [rows, draft?.year],
  );
  const inBasis = (m: number) => !!draft && m >= draft.from_month && m <= draft.to_month;
  const monthName = (m: number) => (language === 'zh' ? MONTHS_ZH : MONTHS_EN)[m - 1];

  // Months inside the window that hold nothing, and months holding a single row
  // where others hold several. Both mean the average is being taken over
  // something the advisor should look at first.
  const selectedWithData = breakdown.filter(m => inBasis(m.month));
  const emptyInWindow = draft
    ? (draft.to_month - draft.from_month + 1) - selectedWithData.length
    : 0;
  const thin = selectedWithData.filter(
    m => m.entries === 1 && selectedWithData.some(o => o.entries >= 3),
  );

  async function save(next: CashflowBasis | null) {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from('financial_reports')
      .update({ planning_inputs: { ...(planningInputs ?? {}), cashflow_basis: next } })
      .eq('id', reportId);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setOpen(false);
    onSaved();
  }

  if (loading) return null;

  if (!effective) {
    return (
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        ⚠️ {t(
          'This client has no cashflow recorded, so income and expenses will be reported as zero. Add entries on the Cashflow tab first.',
          '这位客户尚未录入任何月份的收支，报告的收入与支出会显示为零。请先到现金流分页录入。',
        )}
      </div>
    );
  }

  return (
    <div className="text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-500">{t('Annualised from', '收支基准')}</span>
        <span className="font-semibold text-xin-blue">
          {formatBasis(effective, language === 'zh' ? 'zh' : 'en')}
        </span>
        {!saved && (
          <span className="text-slate-400">
            {t('(all recorded months)', '（全部已录月份）')}
          </span>
        )}
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xin-blue font-semibold hover:underline"
        >
          {open ? t('close', '收起') : t('change', '更改')}
        </button>
        {(thin.length > 0 || emptyInWindow > 0) && !open && (
          <span className="text-amber-700 flex items-center gap-1">
            <AlertTriangle size={12} />
            {t('check the months', '基准月份需要确认')}
          </span>
        )}
      </div>

      {open && draft && (
        <div className="mt-2 bg-white border border-slate-200 rounded-xl p-3 space-y-3">
          <p className="text-slate-500 leading-relaxed">
            {t(
              'Every figure in the report — savings rate, emergency fund, retirement capital — is annualised from the months you pick here. A month with one entry is usually half-entered rather than genuinely lean, and averaging it in will understate the client.',
              '报告里的每一个数字 —— 储蓄率、紧急预备金、退休所需资本 —— 都是按这里选定的月份年化出来的。只有一笔记录的月份通常是没录完，而不是真的花得少；把它平均进去会低估这位客户。',
            )}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={draft.year}
              onChange={e => {
                const y = Number(e.target.value);
                const months = monthlyBreakdown(rows, y).map(m => m.month);
                setDraft({
                  year: y,
                  from_month: months[0] ?? 1,
                  to_month: months[months.length - 1] ?? 12,
                });
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-xin-blue"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-slate-400">{t('months', '月份')}</span>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
              const has = breakdown.find(b => b.month === m);
              return (
                <button
                  key={m}
                  onClick={() => setDraft(d => {
                    if (!d) return d;
                    // Click sets one end of the range and keeps it ordered.
                    if (m < d.from_month) return { ...d, from_month: m };
                    if (m > d.to_month) return { ...d, to_month: m };
                    return { ...d, from_month: m, to_month: m };
                  })}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    inBasis(m)
                      ? 'bg-xin-blue text-white'
                      : has
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-white text-slate-300 border border-slate-100'
                  }`}
                >
                  {monthName(m)}
                </button>
              );
            })}
          </div>

          <div className="border border-slate-100 rounded-lg overflow-hidden">
            {breakdown.length === 0 ? (
              <div className="px-3 py-2 text-slate-400">{t('no entries this year', '本年度无记录')}</div>
            ) : breakdown.map(m => (
              <div
                key={m.month}
                className={`flex items-center gap-3 px-3 py-1.5 border-b border-slate-50 last:border-0 ${
                  inBasis(m.month) ? 'bg-xin-blue/[0.04]' : 'opacity-40'
                }`}
              >
                <span className="w-10 font-semibold text-xin-blue">{monthName(m.month)}</span>
                <span className="text-emerald-600 w-24">+RM {fmt(m.income)}</span>
                <span className="text-red-500 w-24">−RM {fmt(m.expenses)}</span>
                <span className={`ml-auto ${m.entries === 1 ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                  {t(`${m.entries} entries`, `${m.entries} 笔`)}
                </span>
              </div>
            ))}
          </div>

          {(thin.length > 0 || emptyInWindow > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800 flex items-start gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <div>
                {thin.length > 0 && (
                  <div>
                    {t(
                      `${thin.map(m => monthName(m.month)).join(', ')} holds a single entry. If it is only half entered, narrow the basis to the complete months instead.`,
                      `${thin.map(m => monthName(m.month)).join('、')}只有一笔记录。如果这个月没录完，请把基准收窄到完整的月份。`,
                    )}
                  </div>
                )}
                {emptyInWindow > 0 && (
                  <div>
                    {t(
                      `${emptyInWindow} month(s) in this range have no entries at all; the average is taken over the ${selectedWithData.length} that do.`,
                      `所选区间内有 ${emptyInWindow} 个月完全没有记录，月均按有记录的 ${selectedWithData.length} 个月计算。`,
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {err && <div className="text-red-600">{err}</div>}

          <div className="flex items-center gap-2">
            <button
              onClick={() => save(draft)}
              disabled={saving}
              className="bg-xin-blue text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-xin-blueLight transition-colors disabled:opacity-50"
            >
              {saving ? '…' : t('Use these months', '使用这些月份')}
            </button>
            {saved && (
              <button
                onClick={() => save(null)}
                disabled={saving}
                className="text-slate-500 font-semibold px-2 py-1.5 hover:text-xin-blue disabled:opacity-50"
              >
                {t('Reset to all recorded months', '恢复为全部已录月份')}
              </button>
            )}
            {/* Regenerating is what actually applies it; approved sections are
                withdrawn automatically because the basis is fingerprinted. */}
            <span className="text-slate-400 ml-auto">
              {t('Regenerate sections to apply', '需重新生成板块后生效')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
