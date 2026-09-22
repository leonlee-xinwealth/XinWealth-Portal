import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import SectionCard, { Section } from '../cfp/SectionCard';
import { CFP_SECTION_ORDER, SECTION_META } from '../cfp/sectionMeta';
import { RENDERERS } from '../cfp/renderers';
import { GoalsCrud } from '../cfp/renderers/GoalsRenderer';
import { fetchFamilyRelations } from '../FamilyLinkCard';
import ReviewProgress, { ReviewGateNote } from '../cfp/ReviewProgress';
import GenerateAllButton from '../cfp/GenerateAllButton';
import { summarizeReview } from '../cfp/reviewState';
import CashflowBasisPicker from '../cfp/CashflowBasisPicker';

// CFP report workspace: one financial_reports row per client per period; each
// of the 8 paraplanner agents (cfp-brain modules) contributes a
// report_sections row. Advisors generate, edit, and approve entirely
// in-portal. Section layout lives in ../cfp/renderers.
//
// A report with partner_client_id set is a JOINT household plan: cfp-brain
// merges both spouses' data (supabase/functions/cfp-brain/household.ts), so the
// choice is made once at creation and every section is generated against it.

interface Report {
  id: string;
  period: string;
  status: string;
  created_at: string;
  partner_client_id: string | null;
  /** advisor-entered planning inputs; currently the cashflow basis */
  // deno-lint-ignore no-explicit-any
  planning_inputs: any;
  report_sections: Section[];
}

function currentQuarter(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `Q${q}'${String(now.getFullYear()).slice(2)}`;
}

export default function CfpTab({ clientId, advisorId }: { clientId: string; advisorId: string }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [period, setPeriod] = useState(currentQuarter());
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [spouse, setSpouse] = useState<{ id: string; name: string } | null>(null);
  const [joint, setJoint] = useState(false);
  const [dupeCount, setDupeCount] = useState(0);

  // Same type + same amount on both spouses is almost always one jointly-owned
  // item entered twice, which would double-count net worth. cfp-brain flags it
  // in the baseline notes too, but warn here so the advisor can fix the data
  // BEFORE spending a generation on it. Never auto-merged — the advisor decides.
  async function checkDuplicates(partnerId: string) {
    const ids = [clientId, partnerId];
    const [{ data: assets }, { data: liabs }] = await Promise.all([
      supabase.from('assets').select('client_id, asset_type, current_value').in('client_id', ids),
      supabase.from('liabilities').select('client_id, liability_type, outstanding_balance').in('client_id', ids),
    ]);
    const count = (rows: any[], typeKey: string, amountKey: string) => {
      const mine = new Map<string, number>();
      let hits = 0;
      for (const r of rows) {
        const k = `${r[typeKey]}|${r[amountKey] ?? 0}`;
        if (r.client_id === clientId) mine.set(k, (mine.get(k) ?? 0) + 1);
      }
      for (const r of rows) {
        if (r.client_id === clientId) continue;
        const k = `${r[typeKey]}|${r[amountKey] ?? 0}`;
        const left = mine.get(k) ?? 0;
        if (left > 0) { mine.set(k, left - 1); hits++; }
      }
      return hits;
    };
    setDupeCount(
      count((assets as any[]) ?? [], 'asset_type', 'current_value') +
      count((liabs as any[]) ?? [], 'liability_type', 'outstanding_balance'),
    );
  }

  async function loadSpouse() {
    const rels = await fetchFamilyRelations(clientId);
    const s = rels.find(r => r.relationship_type === 'spouse');
    setSpouse(s ? { id: s.related_client_id, name: s.related?.full_name ?? '' } : null);
  }

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

  useEffect(() => { setLoading(true); setJoint(false); loadReports(); loadSpouse(); }, [clientId]);

  async function createReport() {
    const p = period.trim();
    if (!p) return;
    setMsg(null);
    const { data, error } = await supabase
      .from('financial_reports')
      .insert({
        client_id: clientId,
        advisor_id: advisorId,
        period: p,
        partner_client_id: joint && spouse ? spouse.id : null,
      })
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
  // `draftPreview` is the escape hatch through the export gate. An advisor
  // cannot judge whether the prose reads right without seeing it laid out, so a
  // hard gate with no preview would just push them to approve sections blind in
  // order to look at them. The preview stamps DRAFT on every page (see
  // hasUnapproved → the cover in pdf/cfpReport), which is what makes it safe to
  // offer: a preview that escapes to a client is visibly not the final report.
  async function exportFullReport(draftPreview = false) {
    const selected = reports.find(r => r.id === selectedId);
    if (!selected) return;
    const sections = selected.report_sections.filter(s => s.content);
    if (sections.length === 0) return;

    const hasUnapproved = draftPreview || sections.some(s => s.status !== 'approved');
    // Joint report: pull both spouses so the PDF can attribute each holding.
    const partnerId = selected.partner_client_id;
    const ids = partnerId ? [clientId, partnerId] : [clientId];
    setExportingReport(true);
    setMsg(null);
    try {
      const [{ data: cls }, { data: adv }, { data: rpt }, { data: assets }, { data: liabilities }, { data: suit }] = await Promise.all([
        supabase.from('clients')
          .select('id, full_name, date_of_birth, marital_status, number_of_dependants, occupation, employment_status, retirement_age')
          .in('id', ids),
        supabase.from('advisors').select('display_name, email').eq('id', advisorId).single(),
        supabase.from('financial_reports').select('baseline').eq('id', selected.id).single(),
        supabase.from('assets').select('client_id, asset_type, name, current_value').in('client_id', ids),
        supabase.from('liabilities').select('client_id, liability_type, name, outstanding_balance').in('client_id', ids),
        // The suitability assessment is also issued standalone to prospects.
        // Those rows have client_id = null, so filtering on THIS client's id is
        // what keeps a prospect's answers out of a named client's plan.
        supabase.from('suitability_assessments')
          .select('submitted_at, suitability_results(*)')
          .eq('client_id', clientId)
          .in('status', ['submitted', 'reviewed'])
          .order('submitted_at', { ascending: false })
          .limit(1),
      ]);

      const rows = (cls as any[]) ?? [];
      const cl = rows.find(r => r.id === clientId);
      const partner = partnerId ? rows.find(r => r.id === partnerId) : null;
      const toClient = (r: any) => ({
        date_of_birth: r?.date_of_birth ?? null,
        marital_status: r?.marital_status ?? null,
        number_of_dependants: r?.number_of_dependants ?? null,
        occupation: r?.occupation ?? null,
        employment_status: r?.employment_status ?? null,
        retirement_age: r?.retirement_age ?? null,
      });
      // Only label an owner when there are two of them to tell apart.
      const ownerOf = (row: any) =>
        partner ? (rows.find(r => r.id === row.client_id)?.full_name ?? undefined) : undefined;

      // PostgREST returns the embedded result as an array even on a to-one
      // relation. No submitted assessment is the normal case, not an error.
      const sa = ((suit as any[]) ?? [])[0] ?? null;
      const sr = sa ? (Array.isArray(sa.suitability_results) ? sa.suitability_results[0] : sa.suitability_results) : null;

      const { exportCfpReport: doExport } = await import('../../../pdf/cfpReport/exportCfpReport');
      await doExport({
        clientName: cl?.full_name ?? '',
        partnerName: partner?.full_name ?? undefined,
        advisorName: (adv as any)?.display_name ?? '',
        advisorEmail: (adv as any)?.email ?? undefined,
        period: selected.period,
        generatedDate: new Date().toLocaleDateString(),
        language,
        hasUnapproved,
        client: toClient(cl),
        partner: partner ? toClient(partner) : undefined,
        baseline: (rpt as any)?.baseline ?? null,
        sections: sections.map(s => ({ section_type: s.section_type, status: s.status, content: s.content })),
        assets: ((assets as any[]) ?? []).map(a => ({ ...a, owner: ownerOf(a) })),
        liabilities: ((liabilities as any[]) ?? []).map(l => ({ ...l, owner: ownerOf(l) })),
        suitability: sr ? {
          finalProfile: sr.final_profile,
          finalBand: sr.final_band,
          capacityBand: sr.capacity_band,
          toleranceBand: sr.tolerance_band,
          horizonCeilingBand: sr.horizon_ceiling_band,
          productLevel: sr.product_level ?? null,
          expectationGap: sr.expectation_gap ?? null,
          targetReturnPct: sr.target_return_pct ?? null,
          redFlags: sr.red_flags ?? [],
          requiresAdvisorReview: sr.requires_advisor_review === true,
          // The frozen ruleset, so a reprinted report always shows the bands
          // that applied when the assessment was taken.
          configSnapshot: sr.config_snapshot ?? {},
          submittedAt: sa?.submitted_at ?? null,
        } : null,
      });
    } catch (err: any) {
      setMsg({ ok: false, text: t(`Export failed: ${err?.message ?? err}`, `导出失败：${err?.message ?? err}`) });
    } finally {
      setExportingReport(false);
    }
  }

  const selected = reports.find(r => r.id === selectedId) || null;
  const summary = useMemo(
    // deno-lint-ignore no-explicit-any
    () => summarizeReview((selected?.report_sections ?? []) as any),
    [selected],
  );

  useEffect(() => {
    setDupeCount(0);
    if (selected?.partner_client_id) checkDuplicates(selected.partner_client_id);
  }, [selected?.id, selected?.partner_client_id]);

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
              {r.partner_client_id ? '💑 ' : ''}{r.period}
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

        {/* Joint planning is fixed at creation: every section is generated
            against the merged household data. */}
        {spouse && (
          <label className="flex items-center gap-2 mt-3 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={joint}
              onChange={e => setJoint(e.target.checked)}
              className="accent-xin-blue"
            />
            <span>
              {t(
                `Plan jointly with spouse (${spouse.name})`,
                `与配偶联合规划（${spouse.name}）`,
              )}
            </span>
          </label>
        )}
        {msg && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {msg.text}
          </div>
        )}

        {selected?.partner_client_id && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-slate-50 text-slate-600 text-sm">
            💑 {t(
              `Joint plan — cashflow, net worth, retirement, tax, goals and legacy use both spouses' combined data. Insurance is analysed separately for each of them.`,
              `联合规划 — 现金流、净值、退休、税务、目标与传承按夫妻两人合并数据计算；保险保障需求分别按两人各自测算。`,
            )}
            {dupeCount > 0 && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700">
                ⚠️ {t(
                  `${dupeCount} asset/liability entries look identical on both spouses. A jointly-owned item should be recorded on ONE spouse only — otherwise it is counted twice.`,
                  `检测到 ${dupeCount} 项资产／负债在两人名下完全相同。共同持有的项目只应录在一方名下，否则会被重复计算。`,
                )}
              </div>
            )}
          </div>
        )}
        {selected && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            {/* Which months of actuals every figure in the report is annualised
                from. Sits above the generate button because it has to be right
                BEFORE the sections are written against it. */}
            <CashflowBasisPicker
              clientId={clientId}
              partnerClientId={selected.partner_client_id}
              reportId={selected.id}
              planningInputs={selected.planning_inputs}
              t={t}
              language={language}
              onSaved={() => loadReports(selected.id)}
            />

            <ReviewProgress summary={summary} t={t} compact />

            <div className="flex items-center gap-2 flex-wrap">
              <GenerateAllButton
                reportId={selected.id}
                summary={summary}
                t={t}
                onSectionDone={() => loadReports(selected.id)}
              />
              <button
                onClick={() => navigate(`/advisor/clients/${clientId}/cfp/${selected.id}/review`)}
                className="bg-xin-gold text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-goldDark transition-colors"
              >
                {summary.approvedCount > 0 && !summary.canExport
                  ? `📖 ${t('Continue review', '继续审核')}`
                  : `📖 ${t('Review section by section', '逐板块审核')}`}
              </button>

              <div className="ml-auto flex items-center gap-3 flex-wrap">
                <ReviewGateNote summary={summary} t={t} />
                {/* The gate is on the real export only. */}
                <button
                  onClick={() => exportFullReport(false)}
                  disabled={exportingReport || !summary.canExport}
                  title={summary.canExport ? undefined : t(
                    'Every section must be approved before the client copy can be exported.',
                    '8 个板块全部定稿后才能导出客户版。',
                  )}
                  className="bg-xin-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {exportingReport ? t('Exporting…', '导出中…') : `⬇ ${t('Export Client Report', '导出客户版报告')}`}
                </button>
              </div>
            </div>

            {summary.hasAnyContent && !summary.canExport && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => exportFullReport(true)}
                  disabled={exportingReport}
                  className="bg-white border border-slate-300 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:border-xin-blue hover:text-xin-blue transition-colors disabled:opacity-50"
                >
                  ⬇ {t('Internal draft preview', '内部预览（草稿版）')}
                </button>
                <span className="text-[11px] text-slate-400">
                  {t(
                    'Every page is stamped DRAFT. For checking layout before the sections are approved.',
                    '每页标注 DRAFT，供定稿前检查排版之用。',
                  )}
                </span>
              </div>
            )}
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
              advisorId={advisorId}
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
