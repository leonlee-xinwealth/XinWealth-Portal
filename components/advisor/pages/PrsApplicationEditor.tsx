import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { ChevronLeft, Printer, Download } from 'lucide-react';
import PrsForm from '../prs/PrsForm';
import { toClientsPayload } from '../prs/prsSync';
import { initialPrsFormData, type PrsApplication, type PrsFormData } from '../../../types/prs';
import { ALL_PRS_MAPPINGS, generateOne, generatePack, downloadBytes, missingFields } from '../../../pdf/generatePrsPack';
import type { FormMapping } from '../../../pdf/mappingTypes';
import { samplePrsData } from '../../../pdf/sampleData';

export default function PrsApplicationEditor() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();

  const [app, setApp] = useState<PrsApplication | null>(null);
  const [data, setData] = useState<PrsFormData>(initialPrsFormData);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genWarnings, setGenWarnings] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('prs_applications').select('*').eq('id', id).single()
      .then(({ data: row }) => {
        if (row) {
          setApp(row as PrsApplication);
          setData({ ...initialPrsFormData, ...(row.form_data as object) });
        }
      });
  }, [id]);

  async function save(): Promise<boolean> {
    if (!app) return false;
    setSaving(true);
    try {
      let clientId = app.client_id;
      if (!clientId && data.full_name.trim()) {
        const { data: created, error } = await supabase.from('clients').insert({
          advisor_id: app.advisor_id,
          full_name: data.full_name.trim(),
          status: 'prospect',
          pipeline_stage: 'interested',
          ...toClientsPayload(data),
        }).select('id').single();
        if (error) throw error;
        clientId = (created as { id: string }).id;
      } else if (clientId) {
        const payload = toClientsPayload(data);
        if (Object.keys(payload).length > 0) {
          const { error } = await supabase.from('clients').update(payload).eq('id', clientId);
          if (error) throw error;
        }
      }
      const { error: upErr } = await supabase.from('prs_applications')
        .update({ form_data: data as object, client_id: clientId })
        .eq('id', app.id);
      if (upErr) throw upErr;
      setApp(a => a ? { ...a, client_id: clientId } : a);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(t('Save failed: ', '保存失败：') + msg);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleGeneratePack() {
    if (!(await save())) return;
    setGenerating(true);
    setShowDropdown(false);
    try {
      const { bytes, warnings } = await generatePack(data);
      setGenWarnings(warnings);
      const name = (data.full_name || 'prs').replace(/\s+/g, '-').toLowerCase();
      downloadBytes(bytes, `prs-pack-${name}.pdf`);
      await supabase.from('prs_applications')
        .update({ pdf_generated_at: new Date().toISOString() })
        .eq('id', app!.id);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateOne(mapping: FormMapping) {
    if (!(await save())) return;
    setGenerating(true);
    setShowDropdown(false);
    try {
      const { bytes, warnings } = await generateOne(mapping, data);
      setGenWarnings(warnings);
      const name = (data.full_name || 'prs').replace(/\s+/g, '-').toLowerCase();
      downloadBytes(bytes, `${mapping.id}-${name}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  const missing = missingFields(data);
  const clientName = (app?.client_full_name as string | undefined) || data.full_name || t('New Application', '新申请');

  const STATUS_LABELS: Record<string, { en: string; zh: string; cls: string }> = {
    draft:           { en: 'Draft',           zh: '草稿',      cls: 'bg-slate-100 text-slate-600' },
    awaiting_client: { en: 'Awaiting Client', zh: '待客户填写', cls: 'bg-blue-50 text-blue-700' },
    submitted:       { en: 'To Review',       zh: '待审核',    cls: 'bg-amber-50 text-amber-700' },
    completed:       { en: 'Completed',       zh: '已完成',    cls: 'bg-emerald-50 text-emerald-700' },
    cancelled:       { en: 'Cancelled',       zh: '已取消',    cls: 'bg-rose-50 text-rose-600' },
  };

  return (
    <div className="max-w-2xl pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/advisor/prs')} className="text-slate-400 hover:text-xin-blue transition-colors">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl font-bold text-xin-blue truncate">{clientName}</h1>
          {app && (() => {
            const b = STATUS_LABELS[app.status] ?? STATUS_LABELS.draft;
            return (
              <span className={`inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>
                {language === 'zh' ? b.zh : b.en}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Missing fields warning */}
      {missing.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          <p className="font-semibold mb-1">{t('Recommended fields missing:', '建议填写以下字段：')}</p>
          {missing.map(g => (
            <div key={g.mapping.id}>
              <span className="font-medium">{language === 'zh' ? g.mapping.labelZh : g.mapping.labelEn}: </span>
              {g.keys.join(', ')}
            </div>
          ))}
          <p className="mt-1 opacity-70">{t('You can still generate PDFs.', '仍可生成 PDF。')}</p>
        </div>
      )}

      {/* Gen warnings */}
      {genWarnings.length > 0 && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
          {genWarnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      {/* Form */}
      {app && (
        <PrsForm
          data={data}
          onChange={patch => setData(d => ({ ...d, ...patch }))}
          mode="advisor"
          language={language as 'en' | 'zh'}
        />
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-100 px-4 py-3 flex items-center gap-2 justify-end">
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => setData(samplePrsData)}
            className="px-3 py-2 text-xs font-medium bg-violet-50 text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
          >
            {t('Fill Sample Data', '填入样本数据')}
          </button>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {saving ? t('Saving…', '保存中…') : t('Save Draft', '保存草稿')}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(d => !d)}
            disabled={generating}
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Download size={14} />
          </button>
          {showDropdown && (
            <div className="absolute bottom-full right-0 mb-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
              {ALL_PRS_MAPPINGS.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleGenerateOne(m)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {language === 'zh' ? m.labelZh : m.labelEn}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleGeneratePack}
          disabled={generating}
          className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-xin-blue text-white rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-50"
        >
          <Printer size={14} />
          {generating ? t('Generating…', '生成中…') : t('Generate Pack', '生成全套')}
        </button>
      </div>
    </div>
  );
}
