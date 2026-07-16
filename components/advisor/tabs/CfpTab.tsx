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
