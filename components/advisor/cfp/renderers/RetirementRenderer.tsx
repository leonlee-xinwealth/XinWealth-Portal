import React from 'react';
import type { RendererProps } from '../SectionCard';
import {
  AssumptionsList, ExecutiveSummaryGrid, fmtRM, GapBar, GenericClientViewEditor,
  KVTable, NarrativeBlock, RecommendationList, SectionHeading, StatTile,
} from '../primitives';

export default function RetirementRenderer({ c, setDraft, readOnly, t }: RendererProps) {
  const setES = (k: string, v: string) =>
    setDraft({ ...c, executive_summary: { ...c.executive_summary, [k]: v } });

  const depletionTone = c.depletion_age == null
    ? 'good'
    : c.depletion_age < 85
      ? 'bad'
      : c.depletion_age < 100
        ? 'warn'
        : 'good';

  return (
    <>
      <ExecutiveSummaryGrid es={c.executive_summary} onChange={setES} readOnly={readOnly} t={t} />

      {/* Headline figures (deterministic) */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Retirement Snapshot', '退休概览')}
        </SectionHeading>
        <div className="grid sm:grid-cols-4 gap-3">
          <StatTile
            label={t('Years to Retirement', '距退休年数')}
            value={c.years_to_retirement == null ? '—' : `${c.years_to_retirement}`}
          />
          <StatTile label={t('Income Need at Retirement', '退休时所需收入')} value={fmtRM(c.income_need_at_retirement)} />
          <StatTile label={t('Capital Needed', '所需资本')} value={fmtRM(c.capital_needed)} />
          <StatTile
            label={t('Required Monthly Top-up', '所需每月增额')}
            value={fmtRM(c.required_monthly_topup)}
            tone={c.gap > 0 ? 'bad' : 'good'}
          />
        </div>
      </div>

      <GapBar
        label={t('Retirement Funding', '退休资金')}
        need={c.capital_needed}
        covered={c.total_projected}
        gap={c.gap}
        t={t}
      />

      {/* Projection sources */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Projection Sources', '资金投影')}
        </SectionHeading>
        <KVTable
          rows={[
            { k: t('EPF (projected)', 'EPF（预计）'), v: fmtRM(c.epf_projected) },
            { k: t('PRS (projected)', 'PRS（预计）'), v: fmtRM(c.prs_projected) },
            { k: t('Other investable (projected)', '其他可投资资产（预计）'), v: fmtRM(c.other_projected) },
            { k: t('Total projected', '预计总额'), v: fmtRM(c.total_projected), strong: true },
          ]}
        />
      </div>

      {/* Stress test */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Drawdown Stress Test', '资金压力测试')}
        </SectionHeading>
        <div className="grid sm:grid-cols-3 gap-3">
          <StatTile
            label={t('Depletion Age', '资金耗尽年龄')}
            value={c.depletion_age == null ? '—' : `${c.depletion_age}`}
            sub={c.depletion_age == null ? t('lasts to 100', '可支撑至 100 岁') : undefined}
            tone={depletionTone}
          />
          <StatTile
            label={t('Survives to 85', '可支撑至 85 岁')}
            value={c.survives_to_85 ? '✓' : '✕'}
            tone={c.survives_to_85 ? 'good' : 'bad'}
          />
          <StatTile
            label={t('Survives to 100', '可支撑至 100 岁')}
            value={c.survives_to_100 ? '✓' : '✕'}
            tone={c.survives_to_100 ? 'good' : 'bad'}
          />
        </div>
      </div>

      {/* Narrative paragraphs */}
      <div>
        <SectionHeading>{t('Gap Analysis', '缺口分析')}</SectionHeading>
        <NarrativeBlock
          value={c.gap_analysis ?? ''}
          onChange={v => setDraft({ ...c, gap_analysis: v })}
          readOnly={readOnly}
          rows={4}
        />
      </div>
      <div>
        <SectionHeading>{t('Funding Plan', '资金计划')}</SectionHeading>
        <NarrativeBlock
          value={c.funding_plan ?? ''}
          onChange={v => setDraft({ ...c, funding_plan: v })}
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
