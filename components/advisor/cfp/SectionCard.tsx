import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { CfpSectionType, SECTION_META } from './sectionMeta';
import ChatPanel from './ChatPanel';
import { TwoStepButton, type T } from './primitives';

// Generic shell for every CFP section card: lifecycle states, generate /
// client-view / save / approve actions, renderer dispatch. Per-section layout
// lives in renderers/; this shell owns everything that is identical across
// the 8 sections (ported from the original InsuranceSectionCard).

export interface Section {
  id: string;
  report_id: string;
  section_type: string;
  agent: string;
  status: 'generating' | 'draft' | 'approved' | 'failed';
  // deno-lint-ignore no-explicit-any
  content: any;
  error: string | null;
  generated_at: string | null;
  approved_at: string | null;
  updated_at: string;
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
}: {
  reportId: string;
  period: string;
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

  const staleGenerating = useMemo(() => {
    if (!section || section.status !== 'generating') return false;
    return Date.now() - new Date(section.updated_at).getTime() > 3 * 60 * 1000;
  }, [section]);

  async function generate() {
    setInvoking(true);
    setErr(null);
    const { error } = await supabase.functions.invoke('cfp-brain', {
      body: { mode: 'generate_section', report_id: reportId, section_type: sectionType },
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
    // deno-lint-ignore no-explicit-any
    const patch: any = { status, approved_at: status === 'approved' ? new Date().toISOString() : null };
    if (status === 'approved' && draft) patch.content = draft; // approve saves edits too
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
        <span className="text-slate-300 text-xs">{collapsed ? '▸' : '▾'}</span>
      </button>
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
  const cv = c.client_view;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-6">
      {header}
      {err && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{err}</div>}

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
                <TwoStepButton
                  label={<>↻ {t('Regenerate', '重新生成')}</>}
                  confirmLabel={<>↻ {t('Overwrite current draft?', '确认覆盖当前草稿？')}</>}
                  onConfirm={generate}
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
