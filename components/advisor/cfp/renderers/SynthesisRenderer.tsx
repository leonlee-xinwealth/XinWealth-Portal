import React from 'react';
import type { RendererProps } from '../SectionCard';
import { CfpSectionType, SECTION_META } from '../sectionMeta';
import {
  AssumptionsList, ExecutiveSummaryGrid, fmtPct, fmtRM, GenericClientViewEditor,
  NarrativeBlock, RecommendationList, SectionHeading, StatTile,
} from '../primitives';

export default function SynthesisRenderer({ c, setDraft, readOnly, t }: RendererProps) {
  const setES = (k: string, v: string) =>
    setDraft({ ...c, executive_summary: { ...c.executive_summary, [k]: v } });
  const budget = c.budget || {};
  const wealthFreedom = c.wealth_freedom || {};
  const score = c.health_score;
  const scoreTone = score == null ? 'text-slate-300' : score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';

  return (
    <>
      <ExecutiveSummaryGrid es={c.executive_summary} onChange={setES} readOnly={readOnly} t={t} />

      {/* Health score */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Financial Health Score', '财务健康分')}
        </SectionHeading>
        <div className="text-center py-3">
          <div className={`text-4xl font-bold ${scoreTone}`}>{score == null ? '—' : score}</div>
          <div className="text-xs text-slate-400 mt-1">{t('Financial Health Score', '财务健康分')}</div>
        </div>
        <div className="grid sm:grid-cols-5 gap-2">
          {(c.score_components || []).map((s: any, i: number) => (
            <StatTile
              key={i}
              label={s.label_zh}
              value={s.score == null ? '—' : `${s.score}`}
              sub={`${Math.round((s.weight ?? 0) * 100)}%`}
            />
          ))}
        </div>
      </div>

      {/* Budget waterfall */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Budget Waterfall', '预算对账')}
        </SectionHeading>
        <p className="text-xs text-slate-500 mb-2">
          {t('Annual Surplus', '年度盈余')}: <b className="text-xin-blue">{fmtRM(budget.annual_surplus)}</b>
        </p>
        {budget.over_budget && (
          <div className="bg-amber-50 text-amber-700 text-sm px-3 py-2 rounded-lg mb-2">
            {t(
              'Needs exceed the annual surplus — items fund in priority order.',
              '需求超出年度盈余——按优先级顺序分配。',
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="py-1.5 pr-2">{t('Item', '项目')}</th>
                <th className="py-1.5 pr-2 text-right">{t('Required', '需要')}</th>
                <th className="py-1.5 pr-2 text-right">{t('Allocated', '已分配')}</th>
                <th className="py-1.5 text-right">{t('Deferred', '顺延')}</th>
              </tr>
            </thead>
            <tbody>
              {(budget.lines || []).map((l: any, i: number) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="py-1.5 pr-2 text-xs">{l.label_zh}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtRM(l.required_annual)}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtRM(l.allocated_annual)}</td>
                  <td className={`py-1.5 text-right ${l.deferred_annual > 0 ? 'text-red-600 font-semibold' : ''}`}>
                    {fmtRM(l.deferred_annual)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wealth freedom */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Wealth Freedom', '财富自由进程')}
        </SectionHeading>
        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${
                wealthFreedom.stage != null && s <= wealthFreedom.stage ? 'bg-xin-gold' : 'bg-slate-100'
              }`}
              title={`S${s}`}
            />
          ))}
        </div>
        <div className="grid sm:grid-cols-4 gap-3">
          <StatTile label={t('Passive Income (monthly)', '被动收入（月）')} value={fmtRM(wealthFreedom.passive_income_monthly)} />
          <StatTile label={t('Monthly Expenses', '月支出')} value={fmtRM(wealthFreedom.monthly_expenses)} />
          <StatTile label={t('Ratio', '占比')} value={fmtPct(wealthFreedom.ratio)} />
          <StatTile label={t('Gap to Next Stage (monthly)', '距下阶段缺口（月）')} value={fmtRM(wealthFreedom.next_stage_gap_monthly)} />
        </div>
      </div>

      {!!(c.missing_modules || []).length && (
        <div className="bg-slate-50 text-slate-500 text-sm px-3 py-2 rounded-lg">
          {t(
            'Missing sections (treated as zero) — generate them for a complete picture: ',
            '以下章节尚未生成（按零计算）——建议先生成以获取完整视图：',
          )}
          {c.missing_modules
            .map((m: string) => {
              const meta = SECTION_META[m as CfpSectionType];
              return meta ? t(meta.en, meta.zh) : m;
            })
            .join('、')}
        </div>
      )}

      {/* Narrative paragraphs */}
      <div>
        <SectionHeading>{t('Overall Assessment', '整体评估')}</SectionHeading>
        <NarrativeBlock
          value={c.overall_assessment ?? ''}
          onChange={v => setDraft({ ...c, overall_assessment: v })}
          readOnly={readOnly}
          rows={4}
        />
      </div>
      <div>
        <SectionHeading>{t('Priority Plan', '优先顺序计划')}</SectionHeading>
        <NarrativeBlock
          value={c.priority_plan ?? ''}
          onChange={v => setDraft({ ...c, priority_plan: v })}
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
