import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import type { RendererProps } from '../SectionCard';
import {
  AssumptionsList, ExecutiveSummaryGrid, fmtRM, GenericClientViewEditor,
  NarrativeBlock, RecommendationList, SectionHeading,
} from '../primitives';

// Goals section renderer + the client_goals CRUD table that feeds it.
// Goal rows are DB truth (advisor edits them, then regenerates the section);
// the section content shows the deterministic funding math per goal.

const GOAL_TYPES: Array<[string, string, string]> = [
  ['education', 'Education', '子女教育'],
  ['house', 'House Purchase', '购房'],
  ['business', 'Business', '创业'],
  ['other', 'Other', '其他'],
];

export function GoalsCrud({
  clientId, advisorId, t, onChanged,
}: {
  clientId: string;
  advisorId: string;
  t: (en: string, zh: string) => string;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('client_goals')
      .select('*')
      .eq('client_id', clientId)
      .order('priority');
    setRows(data || []);
  }
  useEffect(() => { load(); }, [clientId]);

  async function addGoal() {
    setSaving(true);
    setErr(null);
    const { error } = await supabase.from('client_goals').insert({
      client_id: clientId,
      advisor_id: advisorId,
      goal_type: 'education',
      name: t('New goal', '新目标'),
      target_amount: 50000,
      target_year: new Date().getFullYear() + 10,
      priority: rows.length + 1,
    });
    setSaving(false);
    if (error) setErr(error.message);
    else { await load(); onChanged?.(); }
  }

  async function update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from('client_goals').update(patch).eq('id', id);
    if (error) setErr(error.message);
    else { await load(); onChanged?.(); }
  }

  async function remove(id: string) {
    if (!confirm(t('Delete this goal?', '删除该目标？'))) return;
    const { error } = await supabase.from('client_goals').delete().eq('id', id);
    if (error) setErr(error.message);
    else { await load(); onChanged?.(); }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-xin-blue">🎯 {t('Client Goals (data)', '客户目标（数据）')}</h4>
        <button
          onClick={addGoal}
          disabled={saving}
          className="text-sm text-xin-blue font-semibold hover:underline disabled:opacity-50"
        >
          + {t('Add goal', '添加目标')}
        </button>
      </div>
      {err && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-2">{err}</div>}
      {!rows.length
        ? <p className="text-sm text-slate-400">{t('No goals yet — add education/house/business goals so the agents can plan for them.', '暂无目标——添加教育/购房/创业目标后，智能体才能纳入规划。')}</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="py-1.5 pr-2">{t('Type', '类型')}</th>
                  <th className="py-1.5 pr-2">{t('Name', '名称')}</th>
                  <th className="py-1.5 pr-2">{t('Amount (today)', '金额（现值）')}</th>
                  <th className="py-1.5 pr-2">{t('Year', '目标年')}</th>
                  <th className="py-1.5 pr-2">{t('Saved', '已储蓄')}</th>
                  <th className="py-1.5 pr-2">{t('Monthly', '月供')}</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map(g => (
                  <tr key={g.id} className="border-b border-slate-50">
                    <td className="py-1 pr-2">
                      <select
                        value={g.goal_type}
                        onChange={e => update(g.id, { goal_type: e.target.value })}
                        className="border border-slate-200 rounded-lg px-1.5 py-1 text-xs"
                      >
                        {GOAL_TYPES.map(([v, en, zh]) => <option key={v} value={v}>{t(en, zh)}</option>)}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        defaultValue={g.name}
                        onBlur={e => e.target.value !== g.name && update(g.id, { name: e.target.value })}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-32"
                      />
                    </td>
                    {(['target_amount', 'target_year', 'current_saved', 'monthly_contribution'] as const).map(k => (
                      <td key={k} className="py-1 pr-2">
                        <input
                          type="number"
                          defaultValue={g[k]}
                          onBlur={e => Number(e.target.value) !== Number(g[k]) && update(g.id, { [k]: Number(e.target.value) || 0 })}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-24"
                        />
                      </td>
                    ))}
                    <td className="py-1 text-right">
                      <button onClick={() => remove(g.id)} className="text-slate-300 hover:text-red-500" title={t('Delete', '删除')}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <p className="text-[11px] text-slate-400 mt-2">
        {t(
          'Education goals feed the insurance CNA and the goal section. Regenerate sections after editing.',
          '教育目标会同时喂给保险 CNA 与目标章节。编辑后请重新生成相关章节。',
        )}
      </p>
    </div>
  );
}

export default function GoalsRenderer({ c, setDraft, readOnly, t }: RendererProps) {
  const setES = (k: string, v: string) =>
    setDraft({ ...c, executive_summary: { ...c.executive_summary, [k]: v } });
  const setGoalCommentary = (i: number, v: string) => {
    const arr = [...(c.goals || [])];
    arr[i] = { ...arr[i], commentary: v };
    setDraft({ ...c, goals: arr });
  };

  return (
    <>
      <ExecutiveSummaryGrid es={c.executive_summary} onChange={setES} readOnly={readOnly} t={t} />

      <div>
        <SectionHeading>{t('Overview', '总览')}</SectionHeading>
        <NarrativeBlock
          value={c.overview ?? ''}
          onChange={v => setDraft({ ...c, overview: v })}
          readOnly={readOnly}
          rows={3}
        />
      </div>

      {/* Per-goal funding math (deterministic) + editable commentary */}
      <div>
        <SectionHeading hint={t('deterministic — edit goals data to change', '确定性计算——改目标数据才会变')}>
          {t('Goal Funding Analysis', '目标资金测算')}
        </SectionHeading>
        <div className="space-y-3">
          {(c.goals || []).map((g: any, i: number) => (
            <div key={g.id ?? i} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
              <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                <span className="text-sm font-bold text-xin-blue">
                  {g.name} <span className="text-xs font-normal text-slate-400">({g.goal_type} · {g.target_year})</span>
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.on_track ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {g.on_track ? `✓ ${t('On track', '进度正常')}` : t('Needs funding', '需加储蓄')}
                </span>
              </div>
              <div className="grid sm:grid-cols-4 gap-2 text-xs text-slate-500 mb-2">
                <span>{t('Future cost', '未来成本')}<br /><b className="text-slate-700">{fmtRM(g.future_cost)}</b></span>
                <span>{t('Projected savings', '预计累积')}<br /><b className="text-slate-700">{fmtRM(g.projected_savings)}</b></span>
                <span>{t('Gap', '缺口')}<br /><b className={g.gap > 0 ? 'text-red-600' : 'text-emerald-600'}>{fmtRM(g.gap)}</b></span>
                <span>{t('Required monthly', '所需月储蓄')}<br /><b className="text-slate-700">{fmtRM(g.required_monthly)}</b></span>
              </div>
              <NarrativeBlock
                value={g.commentary ?? ''}
                onChange={v => setGoalCommentary(i, v)}
                readOnly={readOnly}
                rows={2}
              />
            </div>
          ))}
          {!(c.goals || []).length && (
            <p className="text-sm text-slate-400">{t('No goals on record — add goals above and regenerate.', '库内暂无目标——先在上方添加目标再重新生成。')}</p>
          )}
        </div>
        {!!(c.goals || []).length && (
          <p className="text-sm mt-2 font-semibold text-xin-blue">
            {t('Total required monthly saving', '所需月储蓄合计')}: {fmtRM(c.total_required_monthly)}
          </p>
        )}
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
