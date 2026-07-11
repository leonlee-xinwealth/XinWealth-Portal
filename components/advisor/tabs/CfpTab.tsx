import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';

// CFP report workspace: one financial_reports row per client per period; each
// agent contributes a report_sections row. Phase 2 ships the first section —
// insurance_planning (保险佬). Advisors generate, edit, and approve entirely
// in-portal; no Telegram/n8n involvement.

interface Report {
  id: string;
  period: string;
  status: string;
  created_at: string;
  report_sections: Section[];
}

interface Section {
  id: string;
  report_id: string;
  section_type: string;
  agent: string;
  status: 'generating' | 'draft' | 'approved' | 'failed';
  content: any;
  error: string | null;
  generated_at: string | null;
  approved_at: string | null;
  updated_at: string;
}

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

const fmtRM = (n: number | null | undefined) =>
  n == null ? '—' : `RM ${Number(n).toLocaleString()}`;

function currentQuarter(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `Q${q}'${String(now.getFullYear()).slice(2)}`;
}

export default function CfpTab({ clientId, advisorId }: { clientId: string; advisorId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [period, setPeriod] = useState(currentQuarter());
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadReports(selectId?: string) {
    const { data } = await supabase
      .from('financial_reports')
      .select('*, report_sections(*)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    const rows = (data as Report[]) || [];
    setReports(rows);
    setSelectedId(prev => selectId ?? prev ?? rows[0]?.id ?? null);
    setLoading(false);
  }

  useEffect(() => { setLoading(true); loadReports(); }, [clientId]);

  async function createReport() {
    const p = period.trim();
    if (!p) return;
    setMsg(null);
    const { data, error } = await supabase
      .from('financial_reports')
      .insert({ client_id: clientId, advisor_id: advisorId, period: p })
      .select('id')
      .single();
    if (error) {
      const dup = error.code === '23505';
      setMsg({
        ok: false,
        text: dup
          ? t(`A report for ${p} already exists.`, `${p} 的报告已存在。`)
          : t(`Create failed: ${error.message}`, `创建失败：${error.message}`),
      });
      return;
    }
    await loadReports((data as any).id);
  }

  const selected = reports.find(r => r.id === selectedId) || null;

  if (loading) {
    return <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" />
    </div>;
  }

  return (
    <div className="space-y-4">
      {/* Report picker / creator */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {reports.map(r => (
            <button
              key={r.id}
              onClick={() => { setSelectedId(r.id); setMsg(null); }}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                r.id === selectedId ? 'bg-xin-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.period}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <input
              value={period}
              onChange={e => setPeriod(e.target.value)}
              placeholder={t('Period e.g. Q3\'26', "周期，如 Q3'26")}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:border-xin-blue"
            />
            <button
              onClick={createReport}
              className="bg-xin-blue text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-xin-blueLight transition-colors"
            >
              + {t('New Report', '新建报告')}
            </button>
          </div>
        </div>
        {msg && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {msg.text}
          </div>
        )}
      </div>

      {!selected ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-slate-400 text-sm">
          {t('Create a report period to start the CFP workflow.', '先创建一个报告周期，开始 CFP 流程。')}
        </div>
      ) : (
        <InsuranceSectionCard
          report={selected}
          t={t}
          onChanged={() => loadReports(selected.id)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- section card

function InsuranceSectionCard({
  report, t, onChanged,
}: {
  report: Report;
  t: (en: string, zh: string) => string;
  onChanged: () => void;
}) {
  const section = report.report_sections.find(s => s.section_type === 'insurance_planning') || null;
  const [invoking, setInvoking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Local editable copy of content while in draft.
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(section?.content ? JSON.parse(JSON.stringify(section.content)) : null); }, [section?.id, section?.generated_at]);

  const staleGenerating = useMemo(() => {
    if (!section || section.status !== 'generating') return false;
    return Date.now() - new Date(section.updated_at).getTime() > 3 * 60 * 1000;
  }, [section]);

  async function generate() {
    setInvoking(true);
    setErr(null);
    const { error } = await supabase.functions.invoke('insurance-brain', {
      body: { mode: 'cfp_section', report_id: report.id },
    });
    setInvoking(false);
    if (error) setErr(error.message);
    onChanged();
  }

  async function saveDraft() {
    if (!section || !draft) return;
    setSaving(true);
    const { error } = await supabase
      .from('report_sections')
      .update({ content: draft })
      .eq('id', section.id);
    setSaving(false);
    if (error) setErr(error.message); else onChanged();
  }

  async function setStatus(status: 'draft' | 'approved') {
    if (!section) return;
    const patch: any = { status, approved_at: status === 'approved' ? new Date().toISOString() : null };
    if (status === 'approved' && draft) patch.content = draft; // approve saves edits too
    const { error } = await supabase.from('report_sections').update(patch).eq('id', section.id);
    if (error) setErr(error.message); else onChanged();
  }

  const header = (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className="text-lg">🛡️</span>
        <h3 className="font-serif font-bold text-xin-blue">{t('Insurance Planning', '保险规划')}</h3>
        <span className="text-xs text-slate-400">insurance_brain · {report.period}</span>
        {section?.status === 'approved' && (
          <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            ✓ {t('Approved', '已定稿')}
          </span>
        )}
        {section?.status === 'draft' && (
          <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            {t('Draft', '草稿')}
          </span>
        )}
      </div>
    </div>
  );

  // --- empty / failed / stale-generating → Generate button
  if (!section || section.status === 'failed' || staleGenerating) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        {header}
        {section?.status === 'failed' && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
            {t('Last generation failed: ', '上次生成失败：')}{section.error}
          </div>
        )}
        {err && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{err}</div>}
        <button
          onClick={generate}
          disabled={invoking}
          className="bg-xin-blue text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-50"
        >
          {invoking
            ? t('Generating… (10–30s)', '生成中…（10–30 秒）')
            : section
              ? `↻ ${t('Retry Generation', '重试生成')}`
              : `🧠 ${t('Generate Insurance Planning Section', '生成保险规划章节')}`}
        </button>
        <p className="text-xs text-slate-400">
          {t(
            'The agent computes the CNA deterministically from the client\'s data, then drafts the narrative. Personal identifiers never reach the AI.',
            '智能体先用客户数据做确定性 CNA 计算，再生成叙述草稿。个人身份信息不会传给 AI。',
          )}
        </p>
      </div>
    );
  }

  // --- generating (fresh)
  if (section.status === 'generating' || invoking) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        {header}
        <div className="flex items-center gap-3 text-sm text-slate-500 py-6 justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-xin-blue" />
          {t('Generating section…', '章节生成中…')}
        </div>
      </div>
    );
  }

  const c = draft || section.content;
  if (!c) return null;
  const readOnly = section.status === 'approved';

  const setES = (k: string, v: string) =>
    setDraft({ ...c, executive_summary: { ...c.executive_summary, [k]: v } });
  const setCR = (i: number, k: string, v: string) => {
    const arr = [...c.coverage_review];
    arr[i] = { ...arr[i], [k]: v };
    setDraft({ ...c, coverage_review: arr });
  };
  const setRec = (i: number, k: string, v: string | number) => {
    const arr = [...c.recommendations];
    arr[i] = { ...arr[i], [k]: v };
    setDraft({ ...c, recommendations: arr });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-6">
      {header}
      {err && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{err}</div>}

      {/* Executive summary row */}
      <div>
        <h4 className="text-sm font-bold text-xin-blue border-l-4 border-xin-gold pl-2 mb-2">
          {t('Executive Summary Row', '执行摘要行')}
        </h4>
        <div className="grid md:grid-cols-2 gap-3">
          {([
            ['findings', t('Findings', '发现')],
            ['action_plan', t('Action Plan', '行动计划')],
            ['expected_completion_date', t('Expected Completion Date', '预计完成时间')],
            ['remarks', t('Remarks', '备注')],
          ] as [string, string][]).map(([k, label]) => (
            <div key={k}>
              <label className="text-xs text-slate-500 block mb-1">{label}</label>
              <textarea
                value={c.executive_summary?.[k] ?? ''}
                onChange={e => setES(k, e.target.value)}
                disabled={readOnly}
                rows={k === 'findings' || k === 'action_plan' ? 3 : 2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Policy overview (read-only, from DB) */}
      <div>
        <h4 className="text-sm font-bold text-xin-blue border-l-4 border-xin-gold pl-2 mb-2">
          {t('Policy Overview', '保单总览')} <span className="text-xs font-normal text-slate-400">({t('from records', '来自库内记录')})</span>
        </h4>
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
        <h4 className="text-sm font-bold text-xin-blue border-l-4 border-xin-gold pl-2 mb-2">
          {t('Capital Need Analysis', '资本需求分析 CNA')} <span className="text-xs font-normal text-slate-400">({t('deterministic — edit client data to change', '确定性计算——改客户资料才会变')})</span>
        </h4>
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
        <p className="text-[11px] text-slate-400 mt-2">{(c.cna?.assumptions || []).join(' · ')}</p>
      </div>

      {/* Coverage review */}
      <div>
        <h4 className="text-sm font-bold text-xin-blue border-l-4 border-xin-gold pl-2 mb-2">
          {t('Coverage Review', '保障逐类评估')}
        </h4>
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

      {/* Gap analysis + death scenario */}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <h4 className="text-sm font-bold text-xin-blue border-l-4 border-xin-gold pl-2 mb-2">{t('Gap Analysis', '缺口分析')}</h4>
          <textarea
            value={c.gap_analysis ?? ''}
            onChange={e => setDraft({ ...c, gap_analysis: e.target.value })}
            disabled={readOnly}
            rows={5}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>
        <div>
          <h4 className="text-sm font-bold text-xin-blue border-l-4 border-xin-gold pl-2 mb-2">{t('Death Scenario Note', '身故情景说明')}</h4>
          <textarea
            value={c.death_scenario_note ?? ''}
            onChange={e => setDraft({ ...c, death_scenario_note: e.target.value })}
            disabled={readOnly}
            rows={5}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <h4 className="text-sm font-bold text-xin-blue border-l-4 border-xin-gold pl-2 mb-2">{t('Recommendations', '建议')}</h4>
        <div className="space-y-2">
          {(c.recommendations || []).map((r: any, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="number"
                min={1}
                value={r.priority}
                onChange={e => setRec(i, 'priority', parseInt(e.target.value) || 1)}
                disabled={readOnly}
                className="w-14 border border-slate-200 rounded-lg px-2 py-2 text-sm text-center shrink-0 disabled:bg-slate-50"
                title={t('Priority', '优先级')}
              />
              <div className="flex-1 space-y-1">
                <input
                  value={r.title}
                  onChange={e => setRec(i, 'title', e.target.value)}
                  disabled={readOnly}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
                />
                <textarea
                  value={r.detail}
                  onChange={e => setRec(i, 'detail', e.target.value)}
                  disabled={readOnly}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-xin-blue disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              {!readOnly && (
                <button
                  onClick={() => setDraft({ ...c, recommendations: c.recommendations.filter((_: any, j: number) => j !== i) })}
                  className="text-slate-300 hover:text-red-500 pt-2"
                  title={t('Remove', '删除')}
                >✕</button>
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={() => setDraft({ ...c, recommendations: [...(c.recommendations || []), { title: '', detail: '', priority: (c.recommendations?.length || 0) + 1 }] })}
              className="text-sm text-xin-blue font-semibold hover:underline"
            >
              + {t('Add recommendation', '添加建议')}
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
        {readOnly ? (
          <button
            onClick={() => setStatus('draft')}
            className="bg-white border border-xin-blue/30 text-xin-blue text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blue/5 transition-colors"
          >
            {t('Reopen as Draft', '重新打开草稿')}
          </button>
        ) : (
          <>
            <button
              onClick={saveDraft}
              disabled={saving}
              className="bg-white border border-xin-blue/30 text-xin-blue text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blue/5 transition-colors disabled:opacity-50"
            >
              {saving ? '…' : `💾 ${t('Save', '保存')}`}
            </button>
            <button
              onClick={() => setStatus('approved')}
              className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors"
            >
              ✓ {t('Approve Section', '定稿本节')}
            </button>
            <button
              onClick={() => { if (confirm(t('Regenerate will overwrite the current draft. Continue?', '重新生成会覆盖当前草稿，继续？'))) generate(); }}
              disabled={invoking}
              className="ml-auto text-sm text-slate-400 hover:text-xin-blue font-semibold transition-colors disabled:opacity-50"
            >
              ↻ {t('Regenerate', '重新生成')}
            </button>
          </>
        )}
        {section.generated_at && (
          <span className="text-[11px] text-slate-300 w-full">
            {t('Generated', '生成于')} {new Date(section.generated_at).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
