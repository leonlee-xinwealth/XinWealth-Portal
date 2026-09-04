import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { CfpSectionType, SECTION_META } from './sectionMeta';
import ChatPanel from './ChatPanel';
import { TwoStepButton, type T } from './primitives';
import { reviewStateOf, STATE_META, type ReviewSection } from './reviewState';

// Generic shell for every CFP section card: lifecycle states, generate /
// client-view / save / approve actions, renderer dispatch. Per-section layout
// lives in renderers/; this shell owns everything that is identical across
// the 8 sections (ported from the original InsuranceSectionCard).

export interface Section extends ReviewSection {
  id: string;
  report_id: string;
  agent: string;
  // deno-lint-ignore no-explicit-any
  content: any;
  generated_at: string | null;
  approved_at: string | null;
  /** advisor who signed off; set alongside approved_at */
  approved_by?: string | null;
}

export interface RendererProps {
  // deno-lint-ignore no-explicit-any
  c: any;
  // deno-lint-ignore no-explicit-any
  setDraft: (next: any) => void;
  readOnly: boolean;
  t: T;
  language: 'en' | 'zh';
}

export default function SectionCard({
  reportId, period, section, sectionType, renderer: Renderer, t, language, onChanged, onExportPdf,
  advisorId,
}: {
  reportId: string;
  period: string;
  /** stamped onto approved_by so an approval has a name against it */
  advisorId?: string;
  section: Section | null;
  sectionType: CfpSectionType;
  renderer: React.ComponentType<RendererProps> | null;
  t: T;
  language: 'en' | 'zh';
  onChanged: () => void;
  // deno-lint-ignore no-explicit-any
  onExportPdf?: (content: any) => Promise<void>;
}) {
  const meta = SECTION_META[sectionType];
  const [invoking, setInvoking] = useState(false);
  const [genCV, setGenCV] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Local editable copy of content while in draft.
  // deno-lint-ignore no-explicit-any
  const [draft, setDraft] = useState<any>(null);
  useEffect(() => {
    setDraft(section?.content ? JSON.parse(JSON.stringify(section.content)) : null);
  }, [section?.id, section?.generated_at]);

  // Same reading of "where is this section" the progress strip, the review page
  // and the export gate use. Four independent derivations of this is how a gate
  // ends up disagreeing with the card it is gating.
  const state = reviewStateOf(section);

  async function generate(force = false) {
    setInvoking(true);
    setErr(null);
    const { error } = await supabase.functions.invoke('cfp-brain', {
      body: {
        mode: 'generate_section', report_id: reportId, section_type: sectionType,
        ...(force ? { force: true } : {}),
      },
    });
    setInvoking(false);
    if (error) setErr(error.message);
    onChanged();
  }

  async function generateClientView() {
    setGenCV(true);
    setErr(null);
    const { error } = await supabase.functions.invoke('cfp-brain', {
      body: { mode: 'client_view', report_id: reportId, section_type: sectionType, language },
    });
    setGenCV(false);
    if (error) setErr(error.message);
    onChanged();
  }

  async function exportPdf() {
    if (!onExportPdf || !c) return;
    setExporting(true);
    setErr(null);
    try {
      await onExportPdf(c);
    } catch (e) {
      setErr((e as Error)?.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
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
    const approving = status === 'approved';
    // deno-lint-ignore no-explicit-any
    const patch: any = {
      status,
      approved_at: approving ? new Date().toISOString() : null,
      approved_by: approving ? advisorId ?? null : null,
    };
    // Approving means the advisor has read this against the numbers as they
    // stand now, whatever the flag used to say.
    if (approving) { patch.stale_reason = null; patch.stale_at = null; }
    if (approving && draft) patch.content = draft; // approve saves edits too
    const { error } = await supabase.from('report_sections').update(patch).eq('id', section.id);
    if (error) setErr(error.message); else onChanged();
  }

  const header = (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center gap-2 text-left"
      >
        <span className="text-lg">{meta.emoji}</span>
        <h3 className="font-serif font-bold text-xin-blue">{t(meta.en, meta.zh)}</h3>
        <span className="text-xs text-slate-400">{meta.personaZh} · {meta.agent} · {period}</span>
        {section && state !== 'missing' && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATE_META[state].chip}`}>
            {state === 'approved' ? '✓ ' : state === 'stale' ? '⚠️ ' : ''}
            {t(STATE_META[state].en, STATE_META[state].zh)}
          </span>
        )}
        <span className="text-slate-300 text-xs">{collapsed ? '▸' : '▾'}</span>
      </button>
    </div>
  );

  // --- nothing to show yet → Generate button
  if (state === 'missing' || state === 'failed') {
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
          onClick={() => generate()}
          disabled={invoking}
          className="bg-xin-blue text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-50"
        >
          {invoking
            ? t('Generating… (10–30s)', '生成中…（10–30 秒）')
            : section
              ? `↻ ${t('Retry Generation', '重试生成')}`
              : `🧠 ${t(`Generate ${meta.en} Section`, `生成${meta.zh}章节`)}`}
        </button>
        <p className="text-xs text-slate-400">
          {t(
            'All figures are computed deterministically from the client\'s data before the AI drafts the narrative. Personal identifiers never reach the AI.',
            '所有数字先由确定性代码从客户数据算出，AI 只负责叙述草稿。个人身份信息不会传给 AI。',
          )}
        </p>
      </div>
    );
  }

  // --- generating (fresh)
  if (state === 'generating' || invoking) {
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

  // Unreachable: 'missing' covers a null row and returned above. TypeScript
  // cannot see that through reviewStateOf, and asserting is worse than a guard.
  if (!section) return null;

  const c = draft || section.content;
  if (!c) return null;
  const readOnly = state === 'approved';
  const cv = c.client_view;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-6">
      {header}
      {err && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{err}</div>}
      {/* A regeneration can fail after a good draft already exists. The server
          keeps the section at 'draft' so the earlier work survives, which means
          this banner is the only thing telling the advisor that what they are
          looking at is the PREVIOUS version, not the one they just asked for. */}
      {section.status === 'draft' && section.error && (
        <div className="bg-amber-50 text-amber-800 text-sm px-3 py-2 rounded-lg">
          {t(
            'The last regeneration failed, so this is the previous draft: ',
            '上次重新生成失败，以下仍是上一版草稿：',
          )}
          {section.error}
        </div>
      )}
      {/* The server withdrew an approval because the numbers moved underneath
          it. Silent demotion would look like the advisor's sign-off was lost. */}
      {state === 'stale' && (
        <div className="bg-amber-50 text-amber-800 text-sm px-3 py-2 rounded-lg">
          ⚠️ {t(
            'The figures behind this section changed after it was approved, so the approval was withdrawn. Re-read it — or regenerate — before approving again.',
            '本节定稿后，其依据的数字发生了变化，定稿已自动撤回。请重新阅读，或重新生成后再定稿。',
          )}
        </div>
      )}

      {!collapsed && (
        <>
          {Renderer
            ? <Renderer c={c} setDraft={setDraft} readOnly={readOnly} t={t} language={language} />
            : <pre className="text-xs text-slate-500 overflow-x-auto">{JSON.stringify(c, null, 2)}</pre>}

          {/* Client view actions (editor lives inside the renderer) */}
          <div className="rounded-xl border border-xin-blue/15 bg-xin-blue/[0.02] p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-sm font-bold text-xin-blue">
                  📄 {t('Client Report (Plain Language)', '客户版报告（通俗版）')}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('A warm, jargon-free version for the client.', '为客户准备的通俗、无术语版本。')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generateClientView}
                  disabled={genCV}
                  className="bg-white border border-xin-blue/30 text-xin-blue text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blue/5 transition-colors disabled:opacity-50"
                >
                  {genCV
                    ? t('Generating…', '生成中…')
                    : cv
                      ? `↻ ${t('Regenerate Client View', '重新生成客户版')}`
                      : `🧠 ${t('Generate Client View', '生成客户版')}`}
                </button>
                {onExportPdf && (
                  <button
                    onClick={exportPdf}
                    disabled={exporting}
                    className="bg-xin-gold text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-goldDark transition-colors disabled:opacity-50"
                    title={cv ? undefined : t('Exports the technical version until a client view is generated', '在生成客户版之前，导出的是专业版内容')}
                  >
                    {exporting ? t('Preparing…', '准备中…') : `⬇ ${t('Export Client PDF', '导出客户版 PDF')}`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Ask the agent / instruct revisions (脱敏 chat) */}
          <ChatPanel
            sectionId={section.id}
            reportId={reportId}
            sectionType={sectionType}
            personaZh={meta.personaZh}
            t={t}
            language={language}
            canRevise={!readOnly}
            onSectionChanged={onChanged}
          />

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
            {readOnly ? (
              <>
                <button
                  onClick={() => setStatus('draft')}
                  className="bg-white border border-xin-blue/30 text-xin-blue text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blue/5 transition-colors"
                >
                  {t('Reopen as Draft', '重新打开草稿')}
                </button>
                {/* The server refuses to overwrite an approval without this
                    flag, so the confirm step here is not the only guard. */}
                <TwoStepButton
                  label={<>↻ {t('Regenerate', '重新生成')}</>}
                  confirmLabel={<>↻ {t('Discard the approved version?', '确认放弃已定稿内容？')}</>}
                  onConfirm={() => generate(true)}
                  disabled={invoking}
                  className="ml-auto text-sm text-slate-400 hover:text-red-600 font-semibold transition-colors disabled:opacity-50"
                />
              </>
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
                <TwoStepButton
                  label={<>↻ {t('Regenerate', '重新生成')}</>}
                  confirmLabel={<>↻ {t('Overwrite current draft?', '确认覆盖当前草稿？')}</>}
                  onConfirm={() => generate()}
                  disabled={invoking}
                  className="ml-auto text-sm text-slate-400 hover:text-xin-blue font-semibold transition-colors disabled:opacity-50"
                />
              </>
            )}
            {section.generated_at && (
              <span className="text-[11px] text-slate-300 w-full">
                {t('Generated', '生成于')} {new Date(section.generated_at).toLocaleString()}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
