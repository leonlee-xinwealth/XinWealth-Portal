import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { ChevronLeft, X } from 'lucide-react';
import { getCaseTemplate, getCaseTypeLabel } from '../cases/caseTemplates';
import type { Case, CaseChecklistItem } from '../cases/types';

// ── Types ──────────────────────────────────────────────────────────────────

interface CaseDetailData extends Case {
  clients: {
    id: string;
    full_name: string;
    status: string;
    pipeline_stage: string | null;
  };
  case_checklist_items: CaseChecklistItem[];
  renewed_policy: {
    provider: string;
    policy_number: string;
  } | null;
}

type LostReasonKey = 'price' | 'no_need' | 'switched_competitor' | 'lost_contact' | 'other';

const LOST_REASONS: { key: LostReasonKey; en: string; zh: string }[] = [
  { key: 'price',               en: 'Price',              zh: '价格问题' },
  { key: 'no_need',             en: 'No Need',            zh: '不需要' },
  { key: 'switched_competitor', en: 'Switched to Competitor', zh: '转投竞争对手' },
  { key: 'lost_contact',        en: 'Lost Contact',       zh: '失去联系' },
  { key: 'other',               en: 'Other',              zh: '其他' },
];

const POLICY_TYPES: [string, string][] = [
  ['life',    'Life Insurance / 人寿险'],
  ['medical', 'Medical / 医疗险'],
  ['car',     'Car Insurance / 车险'],
  ['travel',  'Travel / 旅游险'],
  ['pa',      'PA / 人身意外险'],
  ['other',   'Other / 其他'],
];

const FREQ_OPTIONS: [string, string][] = [
  ['annual',      'Annual / 年缴'],
  ['semi_annual', 'Semi-annual / 半年缴'],
  ['quarterly',   'Quarterly / 季缴'],
  ['monthly',     'Monthly / 月缴'],
];

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string; labelZh: string }> = {
  open:      { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Open',      labelZh: '进行中' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed', labelZh: '已完成' },
  lost:      { bg: 'bg-rose-50',    text: 'text-rose-700',    label: 'Lost',      labelZh: '已流失' },
  cancelled: { bg: 'bg-slate-100',  text: 'text-slate-500',   label: 'Cancelled', labelZh: '已取消' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Calculate the day-diff from today (calendar-day, not millisecond) to `dateStr`. */
function diffDays(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function formatDaysLabel(diff: number | null, t: (en: string, zh: string) => string): string | null {
  if (diff === null) return null;
  if (diff < 0) return t(`${Math.abs(diff)}d overdue`, `逾期 ${Math.abs(diff)} 天`);
  if (diff === 0) return t('Today', '今天');
  return t(`${diff}d left`, `还剩 ${diff} 天`);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  const [caseData, setCaseData] = useState<CaseDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  // Inline edit state
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Modals
  const [showLostModal, setShowLostModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Lost modal state
  const [lostCategory, setLostCategory] = useState<LostReasonKey | null>(null);
  const [lostNotes, setLostNotes] = useState('');
  const [lostSaving, setLostSaving] = useState(false);

  // Complete modal state
  const [policyType, setPolicyType] = useState('car');
  const [provider, setProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [premium, setPremium] = useState('');
  const [premiumFreq, setPremiumFreq] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [completeSaving, setCompleteSaving] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  async function loadCase() {
    if (!id) return;
    const { data, error } = await supabase
      .from('cases')
      .select(`
        *,
        clients(id, full_name, status, pipeline_stage),
        case_checklist_items(*),
        renewed_policy:insurance_policies!renewed_from_policy_id(provider, policy_number)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }
    const d = data as CaseDetailData;
    // Sort checklist items
    d.case_checklist_items.sort((a, b) => a.sort_order - b.sort_order);
    setCaseData(d);
    setDueDate(d.due_date ?? '');
    setNotes(d.notes ?? '');
    setLoading(false);
  }

  useEffect(() => {
    loadCase();
  }, [id]);

  // ── Checklist toggle ───────────────────────────────────────────────────────

  async function toggleChecklist(item: CaseChecklistItem) {
    if (!caseData) return;
    const nowIso = new Date().toISOString();
    const newVal = item.completed_at ? null : nowIso;

    // Optimistic update
    setCaseData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        case_checklist_items: prev.case_checklist_items.map(ci =>
          ci.id === item.id ? { ...ci, completed_at: newVal } : ci
        ),
      };
    });

    await supabase
      .from('case_checklist_items')
      .update({ completed_at: newVal })
      .eq('id', item.id);

    // triggersWon logic
    if (newVal !== null) {
      const template = getCaseTemplate(caseData.case_type);
      const tmpl = template.find(t => t.key === item.item_key);
      if (tmpl?.triggersWon && caseData.clients?.status === 'prospect') {
        await supabase
          .from('clients')
          .update({ pipeline_stage: 'closed_won' })
          .eq('id', caseData.clients.id);
        // Refresh to pick up trigger-updated client status
        loadCase();
      }
    }
  }

  // ── Inline saves ───────────────────────────────────────────────────────────

  async function saveDueDate(value: string) {
    if (!id) return;
    await supabase
      .from('cases')
      .update({ due_date: value || null })
      .eq('id', id);
  }

  async function saveNotes(value: string) {
    if (!id) return;
    await supabase
      .from('cases')
      .update({ notes: value || null })
      .eq('id', id);
  }

  // ── Mark Lost ──────────────────────────────────────────────────────────────

  async function handleMarkLost() {
    if (!id || !lostCategory) return;
    setLostSaving(true);
    await supabase
      .from('cases')
      .update({
        status: 'lost',
        lost_reason_category: lostCategory,
        lost_reason_notes: lostNotes || null,
      })
      .eq('id', id);
    setLostSaving(false);
    setShowLostModal(false);
    setLostCategory(null);
    setLostNotes('');
    loadCase();
  }

  // ── Mark Completed ─────────────────────────────────────────────────────────

  function openCompleteModal() {
    if (!caseData) return;
    const items = caseData.case_checklist_items;
    if (items.length === 0) {
      alert(t(
        'This case has no checklist items. Please contact support.',
        '此案件没有检查清单，请联系支持人员。'
      ));
      return;
    }
    const allDone = items.every(ci => ci.completed_at !== null);
    if (!allDone) {
      alert(t(
        'Please complete all checklist items before marking this case as completed.',
        '请先完成所有检查清单步骤，再标记案件为已完成。'
      ));
      return;
    }
    // Pre-fill policy type from case_type
    const typeMap: Record<string, string> = {
      car_insurance: 'car',
      life_insurance: 'life',
      medical_insurance: 'medical',
    };
    setPolicyType(typeMap[caseData.case_type] ?? 'other');
    setShowCompleteModal(true);
  }

  async function handleMarkCompleted() {
    if (!id || !caseData) return;
    if (!provider || !policyNumber || !premium || !startDate || !endDate) return;

    setCompleteSaving(true);

    // 1. Insert policy first (creates the durable record).
    //    insurance_policies has no advisor_id column — RLS resolves access
    //    via client_id ∈ my_advisor_client_ids().
    const { data: newPolicy, error: pError } = await supabase
      .from('insurance_policies')
      .insert({
        client_id: caseData.clients.id,
        policy_type: policyType,
        provider,
        policy_number: policyNumber,
        premium: parseFloat(premium),
        premium_frequency: premiumFreq,
        start_date: startDate,
        end_date: endDate,
        case_id: id,
      })
      .select('id')
      .single();

    if (pError || !newPolicy) {
      alert(t('Failed to create policy. Please try again.', '创建保单失败，请重试。'));
      setCompleteSaving(false);
      return;
    }

    // 2. Update case status. If this fails, roll back the policy insert
    //    so we don't leave an orphan policy with no completed case.
    const { error: cError } = await supabase
      .from('cases')
      .update({ status: 'completed' })
      .eq('id', id);

    if (cError) {
      await supabase.from('insurance_policies').delete().eq('id', newPolicy.id);
      alert(t('Failed to complete case. Please try again.', '完成案件失败，请重试。'));
      setCompleteSaving(false);
      return;
    }

    setCompleteSaving(false);
    setShowCompleteModal(false);
    loadCase();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue" />
    </div>
  );

  if (!caseData) return (
    <div className="text-rose-500 text-sm p-6">
      {t('Case not found.', '找不到该案件。')}
    </div>
  );

  const ss = STATUS_STYLE[caseData.status] ?? STATUS_STYLE.open;
  const dueDiff = diffDays(caseData.due_date);
  const daysLabel = formatDaysLabel(dueDiff, t);
  const isOverdue = dueDiff !== null && dueDiff < 0;
  const caseTypeLabel = getCaseTypeLabel(caseData.case_type, language);
  const isOpen = caseData.status === 'open';

  return (
    <div>
      {/* ── Back + Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-xin-blue transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-xl font-bold text-xin-blue">
              {t('Case', '案件')} {caseData.case_number}
            </h1>
            <span className={`${ss.bg} ${ss.text} text-xs font-semibold px-2.5 py-1 rounded-full`}>
              {t(ss.label, ss.labelZh)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-sm text-slate-500 flex-wrap">
            <span>{caseTypeLabel}</span>
            <span className="text-slate-300">·</span>
            <span>{caseData.clients?.full_name}</span>
            {daysLabel && (
              <>
                <span className="text-slate-300">·</span>
                <span className={isOverdue ? 'text-rose-500' : 'text-slate-400'}>
                  {t('Due', '到期')}: {daysLabel}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── LEFT: Checklist ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-xin-blue text-sm uppercase tracking-wide">
              {t('Checklist', '检查清单')}
            </h2>
          </div>

          <div className="px-5 py-3 space-y-1">
            {caseData.case_checklist_items.length === 0 && (
              <p className="text-slate-400 text-sm py-3">
                {t('No checklist items.', '暂无检查清单。')}
              </p>
            )}
            {caseData.case_checklist_items.map(item => (
              <button
                key={item.id}
                onClick={() => toggleChecklist(item)}
                disabled={!isOpen}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
                  isOpen ? 'hover:bg-slate-50' : ''
                } ${item.completed_at ? 'opacity-70' : ''}`}
              >
                {/* Checkbox */}
                <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  item.completed_at
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-slate-300 bg-white'
                }`}>
                  {item.completed_at && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${item.completed_at ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {language === 'zh' ? item.label_zh : item.label_en}
                  </span>
                  {item.completed_at && (
                    <span className="ml-2 text-xs text-slate-400">{fmtTime(item.completed_at)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Action buttons */}
          {isOpen && (
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowLostModal(true)}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {t('Mark as Lost', '标记为流失')}
              </button>
              <button
                onClick={openCompleteModal}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {t('Mark Completed', '标记完成')}
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Case Info ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-xin-blue text-sm uppercase tracking-wide">
              {t('Case Info', '案件信息')}
            </h2>
          </div>

          <div className="px-5 py-4 space-y-4">

            {/* Client */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                {t('Client', '客户')}
              </label>
              <Link
                to={`/advisor/clients/${caseData.clients?.id}`}
                className="text-sm font-semibold text-xin-blue hover:underline"
              >
                {caseData.clients?.full_name} →
              </Link>
            </div>

            {/* Case Type */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                {t('Case Type', '案件类型')}
              </label>
              <p className="text-sm text-slate-700">{caseTypeLabel}</p>
            </div>

            {/* Due Date — inline editable */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                {t('Due Date', '截止日期')}
              </label>
              <input
                type="date"
                value={dueDate}
                disabled={!isOpen}
                onChange={e => setDueDate(e.target.value)}
                onBlur={e => saveDueDate(e.target.value)}
                className="text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-xin-gold disabled:bg-transparent disabled:border-transparent disabled:cursor-default"
              />
            </div>

            {/* Renewal source */}
            {caseData.renewed_policy && (
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  {t('Renewal From', '续保来源')}
                </label>
                <p className="text-sm text-slate-700">
                  {caseData.renewed_policy.provider} — {caseData.renewed_policy.policy_number}
                </p>
              </div>
            )}

            {/* Notes — inline textarea */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                {t('Notes', '备注')}
              </label>
              <textarea
                ref={notesRef}
                value={notes}
                disabled={!isOpen}
                onChange={e => setNotes(e.target.value)}
                onBlur={e => saveNotes(e.target.value)}
                rows={4}
                placeholder={isOpen ? t('Add notes…', '添加备注…') : ''}
                className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-xin-gold resize-none disabled:bg-transparent disabled:border-transparent disabled:cursor-default"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODAL: Mark as Lost
         ══════════════════════════════════════════════════════════ */}
      {showLostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-xin-blue">
                  {t('Mark Case as Lost', '标记案件流失')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('Please select a reason', '请选择流失原因')}
                </p>
              </div>
              <button
                onClick={() => setShowLostModal(false)}
                className="text-slate-300 hover:text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Reasons */}
            <div className="px-5 py-4 space-y-2">
              {LOST_REASONS.map(r => (
                <button
                  key={r.key}
                  onClick={() => setLostCategory(r.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all ${
                    lostCategory === r.key
                      ? 'bg-rose-50 border-rose-300 text-rose-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    lostCategory === r.key ? 'border-rose-500' : 'border-slate-300'
                  }`}>
                    {lostCategory === r.key && (
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                    )}
                  </div>
                  {language === 'zh' ? r.zh : r.en}
                </button>
              ))}

              <div className="pt-1">
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  {t('Notes (optional)', '备注（选填）')}
                </label>
                <textarea
                  value={lostNotes}
                  onChange={e => setLostNotes(e.target.value)}
                  rows={2}
                  placeholder={t('Any additional details…', '其他说明…')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={handleMarkLost}
                disabled={!lostCategory || lostSaving}
                className="flex-1 py-3 bg-rose-500 text-white font-semibold rounded-xl text-sm hover:bg-rose-600 disabled:opacity-40 transition-colors"
              >
                {lostSaving ? t('Saving…', '保存中…') : t('Confirm Lost', '确认流失')}
              </button>
              <button
                onClick={() => { setShowLostModal(false); setLostCategory(null); setLostNotes(''); }}
                className="px-5 py-3 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl text-sm hover:bg-slate-50"
              >
                {t('Cancel', '取消')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL: Mark Completed (+ new policy)
         ══════════════════════════════════════════════════════════ */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-semibold text-xin-blue">
                  {t('Complete Case & Record Policy', '完成案件并记录保单')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('All fields are required', '所有字段必填')}
                </p>
              </div>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="text-slate-300 hover:text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-3 overflow-y-auto">

              {/* Policy Type */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">
                  {t('Policy Type', '保单类型')}
                </label>
                <select
                  value={policyType}
                  onChange={e => setPolicyType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
                >
                  {POLICY_TYPES.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Provider */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">
                  {t('Provider', '保险公司')}
                </label>
                <input
                  type="text"
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                  placeholder="e.g. AXA, Allianz, Great Eastern"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
                />
              </div>

              {/* Policy Number */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">
                  {t('Policy Number', '保单号码')}
                </label>
                <input
                  type="text"
                  value={policyNumber}
                  onChange={e => setPolicyNumber(e.target.value)}
                  placeholder="e.g. AKL1234567"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
                />
              </div>

              {/* Premium + Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">
                    {t('Premium (RM)', '保费 (RM)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={premium}
                    onChange={e => setPremium(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">
                    {t('Frequency', '缴费频率')}
                  </label>
                  <select
                    value={premiumFreq}
                    onChange={e => setPremiumFreq(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
                  >
                    {FREQ_OPTIONS.map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start Date + End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">
                    {t('Start Date', '生效日期')}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">
                    {t('End Date', '到期日期')}
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 pb-5 shrink-0 border-t border-slate-100 pt-4">
              <button
                onClick={handleMarkCompleted}
                disabled={!provider || !policyNumber || !premium || !startDate || !endDate || completeSaving}
                className="flex-1 py-3 bg-emerald-500 text-white font-semibold rounded-xl text-sm hover:bg-emerald-600 disabled:opacity-40 transition-colors"
              >
                {completeSaving ? t('Saving…', '保存中…') : t('Confirm & Complete', '确认并完成')}
              </button>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="px-5 py-3 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl text-sm hover:bg-slate-50"
              >
                {t('Cancel', '取消')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
