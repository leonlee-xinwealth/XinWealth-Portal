import React from 'react';
import type { RendererProps } from '../SectionCard';
import {
  AssumptionsList, ExecutiveSummaryGrid, fmtPct, fmtRM, GenericClientViewEditor,
  NarrativeBlock, RecommendationList, SectionHeading, StatTile,
} from '../primitives';

const EF_TONE: Record<string, 'good' | 'warn' | 'bad'> = {
  sufficient: 'good',
  partial: 'warn',
  insufficient: 'bad',
};

export default function CashflowRenderer({ c, setDraft, readOnly, t }: RendererProps) {
  const setES = (k: string, v: string) =>
    setDraft({ ...c, executive_summary: { ...c.executive_summary, [k]: v } });
  const ef = c.emergency_fund || {};

  return (
    <>
      <ExecutiveSummaryGrid es={c.executive_summary} onChange={setES} readOnly={readOnly} t={t} />

      {/* Monthly position (deterministic) */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Monthly Position', '每月收支状况')}
        </SectionHeading>
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
