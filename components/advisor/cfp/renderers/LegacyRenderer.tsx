import React from 'react';
import type { RendererProps } from '../SectionCard';
import {
  AssumptionsList, ExecutiveSummaryGrid, fmtRM, GenericClientViewEditor,
  KVTable, NarrativeBlock, RecommendationList, SectionHeading, StatTile, T,
} from '../primitives';

const REGIME_LABELS: Record<string, [string, string]> = {
  conventional: ['Conventional', '一般法'],
  syariah: ['Syariah', '回教法'],
  unknown: ['Unknown', '未知'],
};

const WILL_LABELS: Record<string, [string, string]> = {
  has_will: ['Has Will', '已立遗嘱'],
  no_will: ['No Will', '未立遗嘱'],
  unknown: ['Unknown', '未知'],
};

const boolTile = (v: boolean | null, t: T) => ({
  value: v == null ? '—' : v ? '✓' : '✕',
  tone: (v == null ? 'neutral' : v ? 'good' : 'bad') as 'neutral' | 'good' | 'bad',
});

export default function LegacyRenderer({ c, setDraft, readOnly, t }: RendererProps) {
  const setES = (k: string, v: string) =>
    setDraft({ ...c, executive_summary: { ...c.executive_summary, [k]: v } });
  const liquidity = c.estate_liquidity || {};
  const distribution = c.distribution || {};
  const nominations = c.nominations || {};
  const epfTile = boolTile(nominations.epf ?? null, t);
  const insTile = boolTile(nominations.insurance ?? null, t);

  return (
    <>
      <ExecutiveSummaryGrid es={c.executive_summary} onChange={setES} readOnly={readOnly} t={t} />

      {/* Headline figures (deterministic) */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Estate Snapshot', '遗产概览')}
        </SectionHeading>
        <div className="grid sm:grid-cols-4 gap-3">
          <StatTile label={t('Gross Estate', '总遗产')} value={fmtRM(c.gross_estate)} />
          <StatTile label={t('Net Estate (incl. life cover)', '净遗产（含寿险保障）')} value={fmtRM(c.net_estate)} />
          <StatTile label={t('Liquid Assets Available', '可动用流动资产')} value={fmtRM(liquidity.available)} />
          <StatTile
            label={t('Liquidity Verdict', '流动性判定')}
            value={liquidity.status === 'covered' ? t('✓ Sufficient liquidity', '✓ 流动性足够') : fmtRM(liquidity.shortfall)}
            tone={liquidity.status === 'covered' ? 'good' : 'bad'}
          />
        </div>
      </div>

      {/* Distribution */}
      <div>
        <SectionHeading>{t('Distribution', '遗产分配')}</SectionHeading>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {t('Regime', '制度')}: {t(...(REGIME_LABELS[distribution.regime] || REGIME_LABELS.unknown))}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {t('Will Status', '遗嘱状态')}: {t(...(WILL_LABELS[distribution.will_status] || WILL_LABELS.unknown))}
          </span>
        </div>
        {distribution.faraid_flagged ? (
          <div className="bg-amber-50 text-amber-700 text-sm px-3 py-2 rounded-lg">
            {t(
              'Muslim estate follows faraid — shares require a Syariah authority; consider hibah/wasiat.',
              '回教徒遗产受 faraid 约束——份额须由回教法机构确认，可考虑 hibah/wasiat 规划。',
            )}
          </div>
        ) : distribution.intestate_conventional_split ? (
          <KVTable
            rows={distribution.intestate_conventional_split.map((s: any) => ({ k: s.beneficiary, v: s.share }))}
          />
        ) : (
          <p className="text-sm text-slate-400">{t('No intestate split computed', '未计算无遗嘱分配方案')}</p>
        )}
      </div>

      {/* Nominations */}
      <div>
        <SectionHeading>{t('Nominations', '提名安排')}</SectionHeading>
        <div className="grid sm:grid-cols-2 gap-3 mb-2">
          <StatTile label={t('EPF Nomination', 'EPF 提名')} value={epfTile.value} tone={epfTile.tone} />
          <StatTile label={t('Insurance Nomination', '保单提名')} value={insTile.value} tone={insTile.tone} />
        </div>
        <div className="flex flex-wrap gap-2">
          {c.trust_consideration && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-xin-blue/10 text-xin-blue">
              {t('Trust structure worth considering', '可考虑信托架构')}
            </span>
          )}
          {c.asset_isolation_flag && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
              {t('Creditor isolation flagged', '已标记债权隔离需求')}
            </span>
          )}
        </div>
      </div>

      {/* Narrative paragraphs */}
      <div>
        <SectionHeading>{t('Estate Review', '遗产状况点评')}</SectionHeading>
        <NarrativeBlock
          value={c.estate_review ?? ''}
          onChange={v => setDraft({ ...c, estate_review: v })}
          readOnly={readOnly}
          rows={4}
        />
      </div>
      <div>
        <SectionHeading>{t('Readiness', '遗嘱与提名准备度')}</SectionHeading>
        <NarrativeBlock
          value={c.readiness ?? ''}
          onChange={v => setDraft({ ...c, readiness: v })}
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
