import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import SectionCard, { Section } from '../cfp/SectionCard';
import { CFP_SECTION_ORDER, SECTION_META } from '../cfp/sectionMeta';
import { RENDERERS } from '../cfp/renderers';
import { GoalsCrud } from '../cfp/renderers/GoalsRenderer';

// CFP report workspace: one financial_reports row per client per period; each
// of the 8 paraplanner agents (cfp-brain modules) contributes a
// report_sections row. Advisors generate, edit, and approve entirely
// in-portal. Section layout lives in ../cfp/renderers.

interface Report {
  id: string;
  period: string;
  status: string;
  created_at: string;
  report_sections: Section[];
}

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
  const [exportingReport, setExportingReport] = useState(false);

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

  // Insurance keeps its dedicated client PDF exporter (react-pdf + CJK font
  // dynamic-imported so they stay out of the main bundle until an export).
  async function exportInsurancePdf(content: any) {
    const selected = reports.find(r => r.id === selectedId);
    if (!selected) return;
    const [{ data: cl }, { data: adv }] = await Promise.all([
      supabase.from('clients').select('full_name').eq('id', clientId).single(),
      supabase.from('advisors').select('display_name').eq('id', advisorId).single(),
    ]);
    const { exportInsurancePdf: doExport } = await import('../../../pdf/insuranceReport/exportInsurancePdf');
    await doExport(content, {
      clientName: (cl as any)?.full_name ?? '',
      advisorName: (adv as any)?.display_name ?? '',
      period: selected.period,
      generatedDate: new Date().toLocaleDateString(),
      language,
    });
  }

  // Unified report export: pulls together every generated section into one
  // client-facing PDF (react-pdf + CJK font dynamic-imported, same pattern
  // as exportInsurancePdf above).
  async function exportFullReport() {
    const selected = reports.find(r => r.id === selectedId);
    if (!selected) return;
    const sections = selected.report_sections.filter(s => s.content);
    if (sections.length === 0) return;

    const hasUnapproved = sections.some(s => s.status !== 'approved');
    setExportingReport(true);
    setMsg(null);
    try {
      const [{ data: cl }, { data: adv }, { data: rpt }, { data: assets }, { data: liabilities }] = await Promise.all([
        supabase.from('clients')
          .select('full_name, date_of_birth, marital_status, number_of_dependants, occupation, employment_status, retirement_age')
          .eq('id', clientId).single(),
        supabase.from('advisors').select('display_name, email').eq('id', advisorId).single(),
        supabase.from('financial_reports').select('baseline').eq('id', selected.id).single(),
        supabase.from('assets').select('asset_type, name, current_value').eq('client_id', clientId),
        supabase.from('liabilities').select('liability_type, name, outstanding_balance').eq('client_id', clientId),
      ]);

      const { exportCfpReport: doExport } = await import('../../../pdf/cfpReport/exportCfpReport');
      await doExport({
        clientName: (cl as any)?.full_name ?? '',
        advisorName: (adv as any)?.display_name ?? '',
        advisorEmail: (adv as any)?.email ?? undefined,
        period: selected.period,
        generatedDate: new Date().toLocaleDateString(),
        language,
        hasUnapproved,
        client: {
          date_of_birth: (cl as any)?.date_of_birth ?? null,
          marital_status: (cl as any)?.marital_status ?? null,
          number_of_dependants: (cl as any)?.number_of_dependants ?? null,
          occupation: (cl as any)?.occupation ?? null,
          employment_status: (cl as any)?.employment_status ?? null,
          retirement_age: (cl as any)?.retirement_age ?? null,
        },
        baseline: (rpt as any)?.baseline ?? null,
        sections: sections.map(s => ({ section_type: s.section_type, status: s.status, content: s.content })),
        assets: (assets as any) ?? [],
        liabilities: (liabilities as any) ?? [],
      });
    } catch (err: any) {
      setMsg({ ok: false, text: t(`Export failed: ${err?.message ?? err}`, `导出失败：${err?.message ?? err}`) });
    } finally {
      setExportingReport(false);
    }
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
        {selected && selected.report_sections.some(s => s.content) && (
          <div className="flex justify-end items-center gap-2 mt-3">
            {selected.report_sections.some(s => s.content && s.status !== 'approved') && (
              <span className="text-[11px] text-amber-600">
                {t('Unapproved sections export with a DRAFT tag.', '未定稿板块导出时标注 DRAFT。')}
              </span>
            )}
            <button
              onClick={exportFullReport}
              disabled={exportingReport}
              className="bg-white border border-xin-blue text-xin-blue text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-xin-blue hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingReport ? t('Exporting…', '导出中…') : `⬇ ${t('Export Full Report', '导出完整报告')}`}
            </button>
          </div>
        )}
      </div>

      {!selected ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-slate-400 text-sm">
          {t('Create a report period to start the CFP workflow.', '先创建一个报告周期，开始 CFP 流程。')}
        </div>
      ) : (
        <>
          {/* Goal data feeds goals_planning + the insurance CNA */}
          <GoalsCrud clientId={clientId} advisorId={advisorId} t={t} />

          {CFP_SECTION_ORDER.map(sectionType => (
            <SectionCard
              key={sectionType}
              reportId={selected.id}
              period={selected.period}
              section={selected.report_sections.find(s => s.section_type === sectionType) || null}
              sectionType={sectionType}
              renderer={RENDERERS[sectionType] ?? null}
              t={t}
              language={language}
              onChanged={() => loadReports(selected.id)}
              onExportPdf={SECTION_META[sectionType].hasPdf ? exportInsurancePdf : undefined}
            />
          ))}
        </>
      )}
    </div>
  );
}
