import React from 'react';
import type { RendererProps } from '../SectionCard';
import {
  AssumptionsList, ExecutiveSummaryGrid, fmtPct, fmtRM, GenericClientViewEditor,
  NarrativeBlock, RecommendationList, SectionHeading, StatTile,
} from '../primitives';

const SOURCE_BADGE: Record<string, string> = {
  advisor: 'bg-blue-50 text-blue-700',
  detected: 'bg-amber-50 text-amber-700',
  auto: 'bg-slate-100 text-slate-500',
  none: 'bg-slate-50 text-slate-400',
};

const SOURCE_LABELS: Record<string, [string, string]> = {
  advisor: ['Advisor', '顾问指定'],
  detected: ['Detected', '系统识别'],
  auto: ['Auto', '自动计算'],
  none: ['None', '无'],
};

export default function TaxRenderer({ c, setDraft, readOnly, t }: RendererProps) {
  const setES = (k: string, v: string) =>
    setDraft({ ...c, executive_summary: { ...c.executive_summary, [k]: v } });

  return (
    <>
      <ExecutiveSummaryGrid es={c.executive_summary} onChange={setES} readOnly={readOnly} t={t} />

      {/* Headline figures (deterministic) */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Tax Position', '税务状况')}
        </SectionHeading>
        <div className="grid sm:grid-cols-4 gap-3">
          <StatTile label={t('Chargeable Income', '应课税收入')} value={fmtRM(c.chargeable_income)} />
          <StatTile label={t('Tax Payable', '应缴税额')} value={fmtRM(c.tax_payable)} />
          <StatTile label={t('Marginal Rate', '边际税率')} value={fmtPct(c.marginal_rate, 0)} />
          <StatTile label={t('Effective Rate', '有效税率')} value={fmtPct(c.effective_rate)} />
        </div>
      </div>

      {c.non_resident && (
        <div className="bg-amber-50 text-amber-700 text-sm px-3 py-2 rounded-lg">
          {t(
            'Non-resident: flat 30% rate; most reliefs unavailable.',
            '非居民：按 30% 单一税率，多数减免不适用。',
          )}
        </div>
      )}

      {/* Reliefs table */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Reliefs', '减免项目')}
        </SectionHeading>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="py-1.5 pr-2">{t('Relief', '项目')}</th>
                <th className="py-1.5 pr-2 text-right">{t('Claimed', '已用')}</th>
                <th className="py-1.5 pr-2 text-right">{t('Cap', '上限')}</th>
                <th className="py-1.5 pr-2 text-right">{t('Headroom', '余额')}</th>
                <th className="py-1.5 pr-2">{t('Source', '来源')}</th>
              </tr>
            </thead>
            <tbody>
              {(c.reliefs_detail || []).map((r: any, i: number) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="py-1.5 pr-2 text-xs">{r.label}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtRM(r.claimed)}</td>
                  <td className="py-1.5 pr-2 text-right text-slate-400">{fmtRM(r.cap)}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtRM(r.headroom)}</td>
                  <td className="py-1.5 pr-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SOURCE_BADGE[r.source] || SOURCE_BADGE.none}`}>
                      {t(...(SOURCE_LABELS[r.source] || SOURCE_LABELS.none))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(c.reliefs_detail || []).length && (
            <p className="text-sm text-slate-400">{t('No relief data on record', '库内暂无减免数据')}</p>
          )}
        </div>
      </div>

      {/* Optimization opportunities */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Optimization Opportunities', '优化空间')}
        </SectionHeading>
        {(c.optimization_opportunities || []).length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="py-1.5 pr-2">{t('Relief', '项目')}</th>
                  <th className="py-1.5 pr-2 text-right">{t('Additional Claimable', '可增额')}</th>
                  <th className="py-1.5 text-right">{t('Est. Tax Saving', '预计节税')}</th>
                </tr>
              </thead>
              <tbody>
                {c.optimization_opportunities.map((o: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 pr-2 text-xs">{o.label}</td>
                    <td className="py-1.5 pr-2 text-right">{fmtRM(o.additional_claimable)}</td>
                    <td className="py-1.5 text-right font-bold text-emerald-600">{fmtRM(o.est_tax_saving)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t('No further relief headroom identified', '暂无进一步的减免空间')}</p>
        )}
      </div>

      {/* Narrative paragraphs */}
      <div>
        <SectionHeading>{t('Tax Position Commentary', '税务状况点评')}</SectionHeading>
        <NarrativeBlock
          value={c.tax_position ?? ''}
          onChange={v => setDraft({ ...c, tax_position: v })}
          readOnly={readOnly}
          rows={4}
        />
      </div>
      <div>
        <SectionHeading>{t('Optimization', '优化建议')}</SectionHeading>
        <NarrativeBlock
          value={c.optimization ?? ''}
          onChange={v => setDraft({ ...c, optimization: v })}
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

      <div className="bg-slate-50 text-slate-500 text-xs px-3 py-2 rounded-lg">
        {c.disclaimer}
      </div>

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
