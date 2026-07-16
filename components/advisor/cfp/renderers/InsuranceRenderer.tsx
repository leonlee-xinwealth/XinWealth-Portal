import React from 'react';
import type { RendererProps } from '../SectionCard';
import {
  AssumptionsList, ExecutiveSummaryGrid, fmtRM, NarrativeBlock, RecommendationList, SectionHeading,
} from '../primitives';

// Ported 1:1 from the original CfpTab InsuranceSectionCard body — zero visual
// change intended. Deterministic blocks (policy overview, CNA) stay read-only.

const COVERAGE_LABELS: Record<string, [string, string]> = {
  life: ['Life', '人寿'],
  critical_illness: ['Critical Illness', '重疾'],
  medical: ['Medical', '医疗'],
  accident: ['Accident', '意外'],
  disability_income: ['Disability Income', '残疾收入'],
  savings_retirement: ['Savings & Retirement', '储蓄与退休'],
};

const LEVEL_STYLES: Record<string, string> = {
  adequate: 'bg-emerald-50 text-emerald-700',
  fair: 'bg-amber-50 text-amber-700',
  insufficient: 'bg-red-50 text-red-600',
  none: 'bg-red-600 text-white',
  unknown: 'bg-slate-100 text-slate-500',
};

export default function InsuranceRenderer({ c, setDraft, readOnly, t }: RendererProps) {
  const setES = (k: string, v: string) =>
    setDraft({ ...c, executive_summary: { ...c.executive_summary, [k]: v } });
  const setCR = (i: number, k: string, v: string) => {
    const arr = [...c.coverage_review];
    arr[i] = { ...arr[i], [k]: v };
    setDraft({ ...c, coverage_review: arr });
  };
  const setScen = (i: number, k: string, v: string) => {
    const arr = [...(c.scenarios || [])];
    arr[i] = { ...arr[i], [k]: v };
    setDraft({ ...c, scenarios: arr });
  };
  const cv = c.client_view;
  const setCV = (k: string, v: string) =>
    setDraft({ ...c, client_view: { ...cv, [k]: v } });
  const setCVItem = (k: string, i: number, field: string, v: string) => {
    const arr = [...((cv?.[k]) || [])];
    arr[i] = { ...arr[i], [field]: v };
    setDraft({ ...c, client_view: { ...cv, [k]: arr } });
  };

  return (
    <>
      <ExecutiveSummaryGrid es={c.executive_summary} onChange={setES} readOnly={readOnly} t={t} />

      {/* Policy overview (read-only, from DB) */}
      <div>
        <SectionHeading hint={t('from records', '来自库内记录')}>
          {t('Policy Overview', '保单总览')}
        </SectionHeading>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="py-1.5 pr-3">{t('Provider', '保险公司')}</th>
                <th className="py-1.5 pr-3">{t('Policy No.', '保单号')}</th>
                <th className="py-1.5 pr-3">{t('Type', '类型')}</th>
                <th className="py-1.5 pr-3">{t('Sum Assured', '保额')}</th>
                <th className="py-1.5 pr-3">{t('Cash Value', '现金价值')}</th>
                <th className="py-1.5">{t('Annual Premium', '年缴保费')}</th>
              </tr>
            </thead>
            <tbody>
              {(c.policy_overview || []).map((p: any, i: number) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1.5 pr-3">{p.provider ?? '—'}</td>
                  <td className="py-1.5 pr-3">{p.policy_number ?? '—'}</td>
                  <td className="py-1.5 pr-3">{p.policy_type}</td>
                  <td className="py-1.5 pr-3">{fmtRM(p.sum_assured)}</td>
                  <td className="py-1.5 pr-3">{fmtRM(p.cash_value)}</td>
                  <td className="py-1.5">{fmtRM(p.annual_premium)}</td>
                </tr>
              ))}
              {!(c.policy_overview || []).length && (
                <tr><td colSpan={6} className="py-3 text-slate-400 text-center">{t('No policies on record', '库内暂无保单')}</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-xin-blue">
                <td colSpan={5} className="py-1.5 pr-3 text-right">{t('Total annual premium', '年缴保费合计')}</td>
                <td className="py-1.5">{fmtRM(c.annual_premium_total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* CNA (read-only, deterministic) */}
      <div>
        <SectionHeading hint={t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')}>
          {t('Capital Need Analysis', '资本需求分析 CNA')}
        </SectionHeading>
        <div className="grid sm:grid-cols-3 gap-3">
          {(c.cna?.gaps || []).filter((g: any) => !g.flag_only).map((g: any) => (
            <div key={g.key} className="border border-slate-100 rounded-xl p-3">
              <div className="text-xs text-slate-500 mb-1">{g.key === 'life' ? t('Life', '人寿') : t('Critical Illness', '重疾')}</div>
              <div className="text-xs text-slate-400">{t('Need', '需求')} {fmtRM(g.need)}</div>
              <div className="text-xs text-slate-400">{t('Covered', '已覆盖')} {fmtRM(g.covered)}</div>
              <div className={`text-sm font-bold mt-1 ${g.gap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {g.gap > 0 ? `${t('Gap', '缺口')} ${fmtRM(g.gap)}` : `✓ ${t('Sufficient', '已足够')}`}
              </div>
            </div>
          ))}
          {(c.cna?.gaps || []).filter((g: any) => g.flag_only).map((g: any) => (
            <div key={g.key} className="border border-slate-100 rounded-xl p-3">
              <div className="text-xs text-slate-500 mb-1">{t('Medical', '医疗')}</div>
              <div className={`text-sm font-bold mt-1 ${g.has_cover ? 'text-emerald-600' : 'text-red-600'}`}>
                {g.has_cover ? `✓ ${t('Has cover', '已有保障')}` : t('No cover found', '未见保障')}
              </div>
            </div>
          ))}
        </div>
        <AssumptionsList items={c.cna?.assumptions} />
      </div>

      {/* Coverage review */}
      <div>
        <SectionHeading>{t('Coverage Review', '保障逐类评估')}</SectionHeading>
        <div className="space-y-2">
          {(c.coverage_review || []).map((r: any, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-xs font-semibold text-slate-600 w-28 shrink-0 pt-2">
                {COVERAGE_LABELS[r.category] ? t(...COVERAGE_LABELS[r.category]) : r.category}
              </span>
              <select
                value={r.level}
                onChange={e => setCR(i, 'level', e.target.value)}
                disabled={readOnly}
                className={`text-xs font-semibold rounded-lg px-2 py-2 border-0 shrink-0 ${LEVEL_STYLES[r.level] || 'bg-slate-100'}`}
              >
                {['adequate', 'fair', 'insufficient', 'none', 'unknown'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <textarea
                value={r.commentary}
                onChange={e => setCR(i, 'commentary', e.target.value)}
                disabled={readOnly}
                rows={2}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Gap analysis */}
      <div>
        <SectionHeading>{t('Gap Analysis', '缺口分析')}</SectionHeading>
        <NarrativeBlock
          value={c.gap_analysis ?? ''}
          onChange={v => setDraft({ ...c, gap_analysis: v })}
          readOnly={readOnly}
          rows={4}
        />
      </div>

      {/* Real-life scenarios */}
      <div>
        <SectionHeading hint={t('what-if impact', '如果发生的实际影响')}>
          {t('Real-Life Scenarios', '真实生活场景')}
        </SectionHeading>
        <div className="space-y-3">
          {(c.scenarios || []).map((s: any, i: number) => (
            <div key={i} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={s.title}
                  onChange={e => setScen(i, 'title', e.target.value)}
                  disabled={readOnly}
                  placeholder={t('Scenario title', '场景标题')}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-xin-blue focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
                />
                {!readOnly && (
                  <button
                    onClick={() => setDraft({ ...c, scenarios: c.scenarios.filter((_: any, j: number) => j !== i) })}
                    className="text-slate-300 hover:text-red-500"
                    title={t('Remove', '删除')}
                  >✕</button>
                )}
              </div>
              {([
                ['trigger', t('Trigger', '触发事件')],
                ['life_impact', t('Life Impact', '对生活的冲击')],
                ['protection_response', t('How Protection Helps', '保障如何化解')],
              ] as [string, string][]).map(([k, label]) => (
                <div key={k} className="mb-1.5">
                  <label className="text-[11px] text-slate-500 block">{label}</label>
                  <textarea
                    value={s[k] ?? ''}
                    onChange={e => setScen(i, k, e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              ))}
            </div>
          ))}
          {!(c.scenarios || []).length && (
            <p className="text-sm text-slate-400">{t('No scenarios — regenerate to produce them.', '暂无场景——重新生成即可产出。')}</p>
          )}
          {!readOnly && (
            <button
              onClick={() => setDraft({ ...c, scenarios: [...(c.scenarios || []), { title: '', trigger: '', life_impact: '', protection_response: '' }] })}
              className="text-sm text-xin-blue font-semibold hover:underline"
            >
              + {t('Add scenario', '添加场景')}
            </button>
          )}
        </div>
      </div>

      <RecommendationList
        items={c.recommendations || []}
        onChange={items => setDraft({ ...c, recommendations: items })}
        readOnly={readOnly}
        t={t}
      />

      {/* Insurance-specific client view editor (legacy PDF shape) */}
      {cv && (
        <div className="space-y-3 pt-1">
          <SectionHeading>{t('Client View Content', '客户版内容')}</SectionHeading>
          {([
            ['data_gathering_intro', t('Part 1 · Data Gathering intro', '第一部分 · 资料收集 引言')],
            ['finding_intro', t('Part 2 · Finding intro', '第二部分 · 分析诊断 引言')],
            ['gap_analysis_plain', t('Gap analysis (plain)', '缺口分析（通俗）')],
            ['recommendation_intro', t('Part 3 · Recommendation intro', '第三部分 · 建议 引言')],
            ['disclaimer', t('Disclaimer', '免责声明')],
          ] as [string, string][]).map(([k, label]) => (
            <NarrativeBlock
              key={k}
              label={label}
              value={cv?.[k] ?? ''}
              onChange={v => setCV(k, v)}
              readOnly={readOnly}
              rows={k === 'gap_analysis_plain' ? 3 : 2}
            />
          ))}

          {!!(cv?.scenarios_plain?.length) && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">{t('Scenarios (plain)', '生活场景（通俗）')}</label>
              <div className="space-y-2">
                {cv.scenarios_plain.map((sc: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={sc.title ?? ''}
                      onChange={e => setCVItem('scenarios_plain', i, 'title', e.target.value)}
                      disabled={readOnly}
                      className="w-40 shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-xin-blue disabled:bg-slate-50"
                    />
                    <textarea
                      value={sc.plain ?? ''}
                      onChange={e => setCVItem('scenarios_plain', i, 'plain', e.target.value)}
                      disabled={readOnly}
                      rows={2}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm disabled:bg-slate-50"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!(cv?.recommendations_plain?.length) && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">{t('Recommendations (plain)', '建议（通俗）')}</label>
              <div className="space-y-2">
                {cv.recommendations_plain.map((r: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={r.title ?? ''}
                      onChange={e => setCVItem('recommendations_plain', i, 'title', e.target.value)}
                      disabled={readOnly}
                      className="w-40 shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold disabled:bg-slate-50"
                    />
                    <textarea
                      value={r.plain ?? ''}
                      onChange={e => setCVItem('recommendations_plain', i, 'plain', e.target.value)}
                      disabled={readOnly}
                      rows={2}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm disabled:bg-slate-50"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {!readOnly && (
            <p className="text-[11px] text-slate-400">
              {t('Edits here are saved with the Save button below.', '此处的修改通过下方的「保存」按钮一并保存。')}
            </p>
          )}
        </div>
      )}
    </>
  );
}
