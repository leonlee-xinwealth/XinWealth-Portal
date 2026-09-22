import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { CFP_SECTION_ORDER, SECTION_META, type CfpSectionType } from '../cfp/sectionMeta';
import { RENDERERS } from '../cfp/renderers';
import ChatPanel from '../cfp/ChatPanel';
import ReviewProgress from '../cfp/ReviewProgress';
import GenerateAllButton from '../cfp/GenerateAllButton';
import { TwoStepButton } from '../cfp/primitives';
import {
  nextPending,
  reviewStateOf,
  STATE_META,
  summarizeReview,
  type ReviewSection,
} from '../cfp/reviewState';

// 逐板块审核 — one section, full screen.
//
// The CFP tab is a workspace: report picker, goal CRUD, eight expandable cards,
// export. That is the right shape for setting a report up and the wrong shape
// for reading one, which is a job that needs the advisor to actually read a page
// of prose and decide whether they will put their name on it. This route does
// exactly one thing: show one section, let it be edited, take a decision, move
// on. Everything else on screen is either the progress across the eight or the
// controls for the section in front of you.

interface SectionRow extends ReviewSection {
  id: string;
  report_id: string;
  agent: string;
  // deno-lint-ignore no-explicit-any
  content: any;
  generated_at: string | null;
  approved_at: string | null;
}

interface ReportRow {
  id: string;
  client_id: string;
  advisor_id: string;
  period: string;
  partner_client_id: string | null;
}

export default function CfpReviewPage() {
  const { id: clientId, reportId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { language } = useLanguage();
  const t = useCallback(
    (en: string, zh: string) => (language === 'zh' ? zh : en),
    [language],
  );

  const [report, setReport] = useState<ReportRow | null>(null);
  const [clientName, setClientName] = useState('');
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'approve' | 'generate' | null>(null);
  // deno-lint-ignore no-explicit-any
  const [draft, setDraft] = useState<any>(null);

  const paramSection = params.get('section') as CfpSectionType | null;
  const current: CfpSectionType =
    paramSection && CFP_SECTION_ORDER.includes(paramSection)
      ? paramSection
      : CFP_SECTION_ORDER[0];

  const goTo = useCallback(
    (section: CfpSectionType) => {
      setParams({ section }, { replace: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setParams],
  );

  const load = useCallback(async () => {
    if (!reportId) return;
    const { data } = await supabase
      .from('financial_reports')
      .select('id, client_id, advisor_id, period, partner_client_id, report_sections(*)')
      .eq('id', reportId)
      .single();
    if (!data) { setErr(t('Report not found.', '找不到该报告。')); setLoading(false); return; }
    // deno-lint-ignore no-explicit-any
    const r = data as any;
    setReport(r);
    setSections((r.report_sections ?? []) as SectionRow[]);
    setLoading(false);
  }, [reportId, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled || !clientId) return;
      const { data: cl } = await supabase
        .from('clients').select('full_name').eq('id', clientId).single();
      // deno-lint-ignore no-explicit-any
      if (!cancelled) setClientName((cl as any)?.full_name ?? '');
    })();
    return () => { cancelled = true; };
  }, [load, clientId]);

  // Staleness is otherwise only ever discovered when somebody regenerates. An
  // advisor who edited an asset elsewhere and came straight here would be shown
  // eight approvals that no longer describe the numbers. This costs no LLM call
  // and writes nothing unless something actually moved.
  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.functions.invoke('cfp-brain', {
        body: { mode: 'refresh_fingerprints', report_id: reportId },
      });
      // deno-lint-ignore no-explicit-any
      const stale = (data as any)?.stale;
      if (!cancelled && stale && (stale.demoted?.length || stale.flagged?.length)) load();
    })();
    return () => { cancelled = true; };
  }, [reportId, load]);

  const section = useMemo(
    () => sections.find(s => s.section_type === current) ?? null,
    [sections, current],
  );
  const summary = useMemo(() => summarizeReview(sections), [sections]);
  const state = reviewStateOf(section);

  // Reset the editable copy whenever we land on a different section or a new
  // generation lands underneath us.
  useEffect(() => {
    setDraft(section?.content ? JSON.parse(JSON.stringify(section.content)) : null);
    setErr(null);
  }, [section?.id, section?.generated_at, current]);

  const meta = SECTION_META[current];
  const Renderer = RENDERERS[current] ?? null;
  const index = CFP_SECTION_ORDER.indexOf(current);
  const readOnly = state === 'approved';
  const c = draft ?? section?.content ?? null;

  async function generate(force = false) {
    setBusy('generate');
    setErr(null);
    const { error } = await supabase.functions.invoke('cfp-brain', {
      body: {
        mode: 'generate_section', report_id: reportId, section_type: current,
        ...(force ? { force: true } : {}),
      },
    });
    if (error) setErr(error.message);
    await load();
    setBusy(null);
  }

  async function save() {
    if (!section || !draft) return;
    setBusy('save');
    const { error } = await supabase
      .from('report_sections').update({ content: draft }).eq('id', section.id);
    setBusy(null);
    if (error) { setErr(error.message); return; }
    await load();
  }

  async function approveAndContinue() {
    if (!section) return;
    setBusy('approve');
    const { error } = await supabase
      .from('report_sections')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: report?.advisor_id ?? null,
        // The advisor has now read this against the current numbers, whatever
        // the flag used to say.
        stale_reason: null,
        stale_at: null,
        ...(draft ? { content: draft } : {}),
      })
      .eq('id', section.id);
    setBusy(null);
    if (error) { setErr(error.message); return; }

    // Recompute from what the approval just produced rather than the state we
    // rendered with, so "what's next" reflects this decision.
    const after = sections.map(s =>
      s.id === section.id ? { ...s, status: 'approved' as const, stale_reason: null } : s);
    setSections(after);
    const next = nextPending(summarizeReview(after), current);
    await load();
    if (next) goTo(next); else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function reopen() {
    if (!section) return;
    const { error } = await supabase
      .from('report_sections')
      .update({ status: 'draft', approved_at: null, approved_by: null })
      .eq('id', section.id);
    if (error) setErr(error.message); else await load();
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue" />
      </div>
    );
  }

  const sm = STATE_META[state];
  const backToTab = () => navigate(`/advisor/clients/${clientId}?tab=cfp`);

  return (
    <div className="max-w-6xl mx-auto pb-28">
      {/* --- header: who, which report, where in the eight --- */}
      <div className="sticky top-0 z-20 bg-xin-bg/95 backdrop-blur pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={backToTab}
            className="text-sm text-slate-500 hover:text-xin-blue font-semibold"
          >
            ← {t('Back to report', '返回报告')}
          </button>
          <h1 className="font-serif font-bold text-xin-blue text-lg">
            {clientName} · {report?.period}
          </h1>
          <span className="text-xs text-slate-400">
            {t('Section review', '逐板块审核')} {index + 1}/{CFP_SECTION_ORDER.length}
          </span>
          <span className="ml-auto text-xs text-slate-500">
            {t(
              `${summary.approvedCount} of ${summary.total} approved`,
              `已定稿 ${summary.approvedCount}/${summary.total}`,
            )}
          </span>
        </div>
        <ReviewProgress summary={summary} current={current} onSelect={goTo} t={t} />
      </div>

      {/* --- the section itself --- */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap border-b border-slate-100 pb-3">
            <span className="text-xl">{meta.emoji}</span>
            <h2 className="font-serif font-bold text-xin-blue">{t(meta.en, meta.zh)}</h2>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sm.chip}`}>
              {t(sm.en, sm.zh)}
            </span>
            <span className="text-xs text-slate-400">{meta.personaZh}</span>
          </div>

          {err && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{err}</div>}

          {state === 'stale' && (
            <div className="bg-amber-50 text-amber-800 text-sm px-3 py-2 rounded-lg">
              ⚠️ {t(
                'The figures behind this section changed after it was approved, so the approval was withdrawn. Re-read it — or regenerate — before approving again.',
                '本节定稿后，其依据的数字发生了变化，定稿已自动撤回。请重新阅读，或重新生成后再定稿。',
              )}
            </div>
          )}

          {/* The server keeps prior content on a failed rerun; this banner is
              the only thing telling the advisor they are reading the OLD one. */}
          {section?.error && section.content && (
            <div className="bg-amber-50 text-amber-800 text-sm px-3 py-2 rounded-lg">
              {t('Last regeneration failed, showing the previous draft: ', '上次重新生成失败，以下仍是上一版草稿：')}
              {section.error}
            </div>
          )}

          {state === 'generating' ? (
            <div className="flex items-center gap-3 text-sm text-slate-500 py-16 justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-xin-blue" />
              {t('Generating section…', '章节生成中…')}
            </div>
          ) : !c ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-slate-400">
                {state === 'failed'
                  ? t('The last attempt failed: ', '上次生成失败：') + (section?.error ?? '')
                  : t('This section has not been generated yet.', '本板块尚未生成。')}
              </p>
              <button
                onClick={() => generate()}
                disabled={busy === 'generate'}
                className="bg-xin-blue text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-50"
              >
                {busy === 'generate'
                  ? t('Generating… (10–30s)', '生成中…（10–30 秒）')
                  : `🧠 ${t('Generate this section', '生成本板块')}`}
              </button>
            </div>
          ) : Renderer ? (
            <Renderer c={c} setDraft={setDraft} readOnly={readOnly} t={t} language={language} />
          ) : (
            <pre className="text-xs text-slate-500 overflow-x-auto">{JSON.stringify(c, null, 2)}</pre>
          )}
        </div>

        {/* --- rail: batch generation and the section's agent --- */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-bold text-xin-blue">{t('Generation', '生成')}</h3>
            {reportId && (
              <GenerateAllButton
                reportId={reportId}
                summary={summary}
                t={t}
                onSectionDone={load}
              />
            )}
            <p className="text-[11px] text-slate-400">
              {t(
                'Every figure is computed deterministically before the AI writes a word, and no personal identifier reaches the model.',
                '所有数字先由确定性代码算出，AI 只负责叙述；个人身份信息不会传给模型。',
              )}
            </p>
          </div>

          {section && c && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <ChatPanel
                sectionId={section.id}
                reportId={section.report_id}
                sectionType={current}
                personaZh={meta.personaZh}
                t={t}
                language={language}
                canRevise={!readOnly}
                onSectionChanged={load}
              />
            </div>
          )}
        </div>
      </div>

      {/* --- the decision bar: fixed, because the decision is the point --- */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => goTo(CFP_SECTION_ORDER[(index + CFP_SECTION_ORDER.length - 1) % CFP_SECTION_ORDER.length])}
            className="text-sm font-semibold text-slate-500 hover:text-xin-blue px-3 py-2"
          >
            ← {t('Previous', '上一个')}
          </button>
          <button
            onClick={() => goTo(CFP_SECTION_ORDER[(index + 1) % CFP_SECTION_ORDER.length])}
            className="text-sm font-semibold text-slate-500 hover:text-xin-blue px-3 py-2"
          >
            {t('Next', '下一个')} →
          </button>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {readOnly ? (
              <>
                <span className="text-xs text-emerald-700 font-semibold">
                  ✓ {t('Approved', '已定稿')}
                  {section?.approved_at && ` · ${new Date(section.approved_at).toLocaleDateString()}`}
                </span>
                <button
                  onClick={reopen}
                  className="bg-white border border-xin-blue/30 text-xin-blue text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blue/5 transition-colors"
                >
                  {t('Reopen as draft', '重新打开草稿')}
                </button>
                {/* Regenerating an approved section is a real need (the data
                    moved) but it destroys reviewed prose, so the server refuses
                    it without force and the UI asks twice. */}
                <TwoStepButton
                  label={<>↻ {t('Regenerate', '重新生成')}</>}
                  confirmLabel={<>↻ {t('Discard the approved version?', '确认放弃已定稿内容？')}</>}
                  onConfirm={() => generate(true)}
                  disabled={busy === 'generate'}
                  className="text-sm text-slate-400 hover:text-red-600 font-semibold px-3 py-2 transition-colors disabled:opacity-50"
                />
              </>
            ) : c ? (
              <>
                <TwoStepButton
                  label={<>↻ {t('Regenerate', '重新生成')}</>}
                  confirmLabel={<>↻ {t('Overwrite this draft?', '确认覆盖当前草稿？')}</>}
                  onConfirm={() => generate()}
                  disabled={busy === 'generate'}
                  className="text-sm text-slate-400 hover:text-xin-blue font-semibold px-3 py-2 transition-colors disabled:opacity-50"
                />
                <button
                  onClick={save}
                  disabled={busy === 'save'}
                  className="bg-white border border-xin-blue/30 text-xin-blue text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blue/5 transition-colors disabled:opacity-50"
                >
                  {busy === 'save' ? '…' : `💾 ${t('Save draft', '保存草稿')}`}
                </button>
                <button
                  onClick={approveAndContinue}
                  disabled={busy === 'approve'}
                  className="bg-emerald-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  ✓ {summary.blocking.length > 1
                    ? t('Approve & next', '定稿并进入下一个')
                    : t('Approve — last section', '定稿（最后一个板块）')}
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-400">
                {t('Generate this section to review it.', '生成本板块后即可审核。')}
              </span>
            )}
          </div>
        </div>

        {summary.canExport && (
          <div className="bg-emerald-50 border-t border-emerald-100">
            <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-emerald-800 font-semibold">
                ✓ {t('All 8 sections approved.', '8 个板块已全部定稿。')}
              </span>
              <button
                onClick={backToTab}
                className="text-xs font-semibold text-emerald-800 underline hover:no-underline"
              >
                {t('Go to export →', '前往导出 →')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
