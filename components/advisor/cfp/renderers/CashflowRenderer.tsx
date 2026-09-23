import React from 'react';
import type { RendererProps } from '../SectionCard';
import {
  AssumptionsList, ExecutiveSummaryGrid, fmtPct, fmtRM, GenericClientViewEditor,
  NarrativeBlock, RecommendationList, SectionHeading, StatTile, type T,
} from '../primitives';

const EF_TONE: Record<string, 'good' | 'warn' | 'bad'> = {
  sufficient: 'good',
  partial: 'warn',
  insufficient: 'bad',
};

// Follow-up fix: this section's `content` now carries a handful of plan
// facts copied verbatim from the baseline (financial_reports.baseline) — see
// supabase/functions/cfp-brain/modules/cashflow/calc.ts. This renderer only
// ever sees `content` (SectionCard passes `section.content`, never the
// baseline itself), so these fields are the only way it can show the same
// basis / statutory / auto-item facts the PDF's pdf/cfpReport/select/
// cashflow.ts reads straight off the baseline. Every read below is
// optional-safe: a report saved before this fix simply lacks these fields,
// and every block below degrades to nothing rather than printing "undefined".

/** Mirrors the PDF's planBasisLineOf (pdf/cfpReport/select/cashflow.ts),
 *  minus the actuals month label — that comes from baseline.cashflow_basis,
 *  which this section's content does not carry. */
function basisLineOf(c: any, t: T): string | null {
  if (c.cashflow_source === 'items') {
    const asOf = typeof c.items_as_of === 'string' ? c.items_as_of.slice(0, 7) : null;
    return asOf
      ? t(`Basis: standing items (as of ${asOf})`, `依据：常设项目（截至 ${asOf}）`)
      : t('Basis: standing items', '依据：常设项目');
  }
  if (c.cashflow_source === 'actuals') {
    return t('Basis: actual records, annualised', '依据：实际记录年化');
  }
  return null;
}

function autoItemTag(it: any, t: T): string {
  const estimated = Array.isArray(it?.estimated) && it.estimated.length > 0;
  return estimated ? t('Auto · Estimated', '自动 · 估算') : t('Auto', '自动');
}

export default function CashflowRenderer({ c, setDraft, readOnly, t }: RendererProps) {
  const setES = (k: string, v: string) =>
    setDraft({ ...c, executive_summary: { ...c.executive_summary, [k]: v } });
  const ef = c.emergency_fund || {};
  const basisLine = basisLineOf(c, t);
  const autoItems: any[] = Array.isArray(c.derived_items) ? c.derived_items : [];
  const employeeEpf = typeof c.monthly_employee_epf === 'number' ? c.monthly_employee_epf : 0;
  const employerEpf = typeof c.monthly_employer_epf === 'number' ? c.monthly_employer_epf : 0;
  const socsoEis = typeof c.monthly_socso_eis === 'number' ? c.monthly_socso_eis : 0;
  const disposableSurplus = typeof c.annual_disposable_surplus === 'number' ? c.annual_disposable_surplus : null;

  return (
    <>
      <ExecutiveSummaryGrid es={c.executive_summary} onChange={setES} readOnly={readOnly} t={t} />

      {/* Monthly position (deterministic) */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Monthly Position', '每月收支状况')}
        </SectionHeading>
        {basisLine && <p className="text-[11px] text-slate-400 mb-2">{basisLine}</p>}
        <div className="grid sm:grid-cols-4 gap-3">
          <StatTile label={t('Monthly Income', '月收入')} value={fmtRM(c.monthly_income)} />
          <StatTile label={t('Monthly Expenses', '月支出')} value={fmtRM(c.monthly_expenses)} />
          <StatTile
            label={t('Monthly Surplus', '月盈余')}
            value={fmtRM(c.monthly_surplus)}
            tone={c.monthly_surplus > 0 ? 'good' : 'bad'}
          />
          <StatTile
            label={t('Savings Ratio', '储蓄率')}
            value={fmtPct(c.savings_ratio)}
            sub={`${t('Debt service', '偿债比')} ${fmtPct(c.debt_service_ratio)}`}
          />
        </div>
      </div>

      {/* Expense breakdown */}
      <div>
        <SectionHeading>{t('Expense Breakdown', '支出结构')}</SectionHeading>
        <div className="space-y-1.5">
          {(c.expense_breakdown || []).map((e: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-36 shrink-0 text-xs text-slate-500 truncate">{e.category}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-xin-blue/60"
                  style={{ width: `${Math.min(100, Math.round((e.share ?? 0) * 100))}%` }}
                />
              </div>
              <span className="w-24 text-right text-xs">{fmtRM(e.monthly_amount)}</span>
              <span className="w-12 text-right text-[11px] text-slate-400">{fmtPct(e.share, 0)}</span>
            </div>
          ))}
          {!(c.expense_breakdown || []).length && (
            <p className="text-sm text-slate-400">{t('No recurring expenses on record', '库内暂无经常性支出')}</p>
          )}
        </div>
      </div>

      {/* Auto items (P2a/P2b) — installments/premiums/statutory deductions
          the plan folded in automatically instead of a hand-typed row.
          `c.derived_items` mirrors baseline.derived_items verbatim; empty
          when the client has none, or on a report saved before this fix. */}
      {autoItems.length > 0 && (
        <div>
          <SectionHeading hint={t('already folded into the totals above — not separately entered', '已计入以上合计——非手动录入')}>
            {t('Auto Items', '自动生成项目')}
          </SectionHeading>
          <div className="space-y-1">
            {autoItems.map((it: any, i: number) => {
              const isLoan = it?.source_type === 'liability';
              const principal = isLoan && typeof it?.principal_monthly === 'number' ? it.principal_monthly : null;
              const interest = isLoan && typeof it?.interest_monthly === 'number' ? it.interest_monthly : null;
              return (
                <div key={it?.key ?? i} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-xs text-slate-600 truncate">{it?.source_name || it?.category}</span>
                  <span className="w-64 text-right text-[11px] text-slate-400 truncate">
                    {principal != null && interest != null
                      ? `${t('Principal', '本金')} ${fmtRM(principal)} · ${t('Interest', '利息')} ${fmtRM(interest)} · ${autoItemTag(it, t)}`
                      : autoItemTag(it, t)}
                  </span>
                  <span className="w-24 text-right text-xs">{fmtRM(it?.monthly_amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Statutory deductions & disposable surplus (P2b 决策 6) — employee
          EPF is forced savings, already excluded from monthly_expenses above
          (not spending); employer EPF never reaches the client's own cash
          flow at all (info only, for net-worth reconciliation); SOCSO/EIS is
          a real expense already folded into monthly_expenses. Disposable
          surplus = annual surplus minus the employee EPF that can't be
          redirected — absent (null) on a report saved before this field
          existed, in which case this whole block stays hidden. */}
      {(employeeEpf > 0 || socsoEis > 0 || disposableSurplus != null) && (
        <div>
          <SectionHeading>{t('Statutory & Disposable Surplus', '法定项目与可支配盈余')}</SectionHeading>
          <div className="grid sm:grid-cols-3 gap-3">
            {employeeEpf > 0 && (
              <StatTile
                label={t('Employee EPF (savings)', '雇员 EPF（储蓄）')}
                value={fmtRM(employeeEpf)}
                tone="good"
                sub={employerEpf > 0
                  ? `${t('Employer', '雇主')} ${fmtRM(employerEpf)} ${t('(info only, not cash flow)', '（仅供参考，不计入现金流）')}`
                  : t('Excluded from monthly expenses above', '已从以上月支出中剔除')}
              />
            )}
            {socsoEis > 0 && (
              <StatTile label={t('SOCSO/EIS', 'SOCSO/EIS')} value={fmtRM(socsoEis)} sub={t('Already in expenses above', '已计入以上支出')} />
            )}
            {disposableSurplus != null && (
              <StatTile
                label={t('Disposable Surplus (annual)', '可支配盈余（年）')}
                value={fmtRM(disposableSurplus)}
                tone={disposableSurplus > 0 ? 'good' : 'bad'}
                sub={t('After forced EPF savings', '扣除强制 EPF 储蓄后')}
              />
            )}
          </div>
        </div>
      )}

      {/* One-off items (P2b 决策 4) — near-"now" one_off standing items,
          listed separately so they never distort the monthly figures above.
          `c.one_off_items` mirrors baseline.one_off_items verbatim (empty on
          the actuals path / a pre-P2b report), so this degrades to nothing
          rather than an empty heading. */}
      {!!(c.one_off_items || []).length && (
        <div>
          <SectionHeading hint={t('near "now" — excluded from the monthly figures above', '临近当前月份——不计入以上月度数字')}>
            {t('One-off Items', '一次性收支')}
          </SectionHeading>
          <div className="space-y-1">
            {c.one_off_items.map((it: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-xs text-slate-600 truncate">{it.name || it.category}</span>
                <span className="w-20 text-right text-[11px] text-slate-400">{it.effective_from ? String(it.effective_from).slice(0, 7) : '—'}</span>
                <span className={`w-24 text-right text-xs ${it.direction === 'inflow' ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {it.direction === 'inflow' ? '+' : '−'}{fmtRM(it.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emergency fund verdict */}
      <div>
        <SectionHeading>{t('Emergency Fund', '紧急预备金')}</SectionHeading>
        <div className="grid sm:grid-cols-4 gap-3">
          <StatTile label={t('Target (3–6 months)', '目标（3–6 个月）')} value={`${fmtRM(ef.need_low)} – ${fmtRM(ef.need_high)}`} />
          <StatTile label={t('Current Buffer', '当前储备')} value={fmtRM(ef.actual)} tone={EF_TONE[ef.status] || 'neutral'} />
          <StatTile label={t('Months Covered', '可支撑月数')} value={ef.months_covered == null ? '—' : `${ef.months_covered}`} tone={EF_TONE[ef.status] || 'neutral'} />
          <StatTile label={t('Shortfall vs 6mo', '距 6 个月缺口')} value={fmtRM(ef.shortfall)} tone={ef.shortfall > 0 ? 'warn' : 'good'} />
        </div>
      </div>

      {/* Narrative paragraphs */}
      <div>
        <SectionHeading>{t('Budget Commentary', '预算点评')}</SectionHeading>
        <NarrativeBlock
          value={c.budget_commentary ?? ''}
          onChange={v => setDraft({ ...c, budget_commentary: v })}
          readOnly={readOnly}
          rows={4}
        />
      </div>
      <div>
        <SectionHeading>{t('Emergency Fund Plan', '紧急预备金计划')}</SectionHeading>
        <NarrativeBlock
          value={c.emergency_fund_plan ?? ''}
          onChange={v => setDraft({ ...c, emergency_fund_plan: v })}
          readOnly={readOnly}
          rows={4}
        />
      </div>

      <RecommendationList
        items={c.recommendations || []}
        onChange={items => setDraft({ ...c, recommendations: items })}
        readOnly={readOnly}
        t={t}
      />

      <AssumptionsList items={c.assumptions} />

      {c.client_view && (
        <div>
          <SectionHeading>{t('Client View Content', '客户版内容')}</SectionHeading>
          <GenericClientViewEditor
            cv={c.client_view}
            onChange={(k, v) => setDraft({ ...c, client_view: { ...c.client_view, [k]: v } })}
            readOnly={readOnly}
            t={t}
          />
        </div>
      )}
    </>
  );
}
