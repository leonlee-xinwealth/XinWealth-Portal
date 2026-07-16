import React from 'react';
import type { RendererProps } from '../SectionCard';
import {
  AssumptionsList, ExecutiveSummaryGrid, fmtPct, fmtRM, GenericClientViewEditor,
  KVTable, NarrativeBlock, RecommendationList, SectionHeading, StatTile, T,
} from '../primitives';

const BUCKET_LABELS: Record<string, [string, string]> = {
  equity: ['Equity', '股票'],
  bond: ['Bond', '债券'],
  cash: ['Cash', '现金'],
  alternatives: ['Alternatives', '另类资产'],
};

const bucketLabel = (bucket: string, t: T) => t(...(BUCKET_LABELS[bucket] || [bucket, bucket]));

export default function InvestmentRenderer({ c, setDraft, readOnly, t }: RendererProps) {
  const setES = (k: string, v: string) =>
    setDraft({ ...c, executive_summary: { ...c.executive_summary, [k]: v } });

  return (
    <>
      <ExecutiveSummaryGrid es={c.executive_summary} onChange={setES} readOnly={readOnly} t={t} />

      {/* Headline figures (deterministic) */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Portfolio Snapshot', '投资组合概览')}
        </SectionHeading>
        <div className="grid sm:grid-cols-4 gap-3">
          <StatTile label={t('Investable Total', '可投资总额')} value={fmtRM(c.investable_total)} />
          <StatTile
            label={t('Risk Band', '风险属性')}
            value={c.risk_band ? c.risk_band.charAt(0).toUpperCase() + c.risk_band.slice(1) : '—'}
            tone={c.risk_band_defaulted ? 'warn' : 'neutral'}
            sub={c.risk_band_defaulted ? t('Defaulted — no risk profile on file', '默认值——库内无风险评估') : undefined}
          />
          <StatTile label={t('Expected Return', '预期回报')} value={fmtPct(c.expected_return)} />
          <StatTile label={t('Expected Volatility', '预期波动率')} value={fmtPct(c.expected_vol)} />
        </div>
      </div>

      {/* Current vs target allocation */}
      <div>
        <SectionHeading>{t('Current vs Target Allocation', '当前 vs 目标配置')}</SectionHeading>
        <div className="space-y-3">
          {(c.drift || []).map((d: any, i: number) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">{bucketLabel(d.bucket, t)}</span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    d.drift_pp != null && Math.abs(d.drift_pp) > 5
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  {d.drift_pp == null ? '—' : `${d.drift_pp > 0 ? '+' : ''}${d.drift_pp}pp`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="w-14 shrink-0">{t('Current', '当前')}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-xin-blue/60"
                    style={{ width: `${Math.min(100, d.current_pct ?? 0)}%` }}
                  />
                </div>
                <span className="w-10 text-right">{d.current_pct == null ? '—' : `${d.current_pct}%`}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="w-14 shrink-0">{t('Target', '目标')}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-xin-gold/60"
                    style={{ width: `${Math.min(100, d.target_pct ?? 0)}%` }}
                  />
                </div>
                <span className="w-10 text-right">{d.target_pct}%</span>
              </div>
            </div>
          ))}
          {!(c.drift || []).length && (
            <p className="text-sm text-slate-400">{t('No allocation data on record', '库内暂无配置数据')}</p>
          )}
        </div>
      </div>

      {/* Rebalancing actions */}
      <div>
        <SectionHeading>{t('Rebalancing Actions', '再平衡操作')}</SectionHeading>
        {(c.rebalancing_actions || []).length ? (
          <div className="flex flex-wrap gap-2">
            {c.rebalancing_actions.map((a: any, i: number) => (
              <span
                key={i}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  a.action === 'increase' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {a.action === 'increase' ? '↑' : '↓'} {bucketLabel(a.bucket, t)} {fmtRM(a.amount)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t('Allocation within tolerance band', '配置在容忍带内')}</p>
        )}
      </div>

      {/* Wealth projection */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('10–15 Year Wealth Projection', '10-15 年财富投射')}
        </SectionHeading>
        <KVTable
          rows={(c.wealth_projection || []).map((w: any) => ({
            k: t(`Year ${w.year}`, `第 ${w.year} 年`),
            v: fmtRM(w.projected),
          }))}
        />
      </div>

      {/* Narrative paragraphs */}
      <div>
        <SectionHeading>{t('Allocation Review', '配置点评')}</SectionHeading>
        <NarrativeBlock
          value={c.allocation_review ?? ''}
          onChange={v => setDraft({ ...c, allocation_review: v })}
          readOnly={readOnly}
          rows={4}
        />
      </div>
      <div>
        <SectionHeading>{t('Rebalancing Plan', '再平衡计划')}</SectionHeading>
        <NarrativeBlock
          value={c.rebalancing_plan ?? ''}
          onChange={v => setDraft({ ...c, rebalancing_plan: v })}
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
