import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Briefcase, Search, Plus, X } from 'lucide-react';
import { getCaseTypeLabel, getCaseTemplate, CASE_TYPE_LABELS } from '../cases/caseTemplates';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistItemRaw {
  id: string;
  completed_at: string | null;
}

interface CaseRow {
  id: string;
  case_number: string;
  client_id: string;
  advisor_id: string;
  case_type: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
  clients: { full_name: string } | null;
  case_checklist_items: ChecklistItemRaw[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDueDateColor(dueDate: string | null): string {
  if (!dueDate) return 'text-slate-300';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'text-red-600';
  if (diffDays === 0) return 'text-orange-500';
  if (diffDays <= 7) return 'text-amber-500';
  return 'text-slate-400';
}

function getDueDateLabel(dueDate: string | null, t: (en: string, zh: string) => string): string {
  if (!dueDate) return '—';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return t(`${Math.abs(diffDays)}d overdue`, `逾期 ${Math.abs(diffDays)} 天`);
  if (diffDays === 0) return t('Today', '今天');
  return t(`${diffDays}d left`, `还剩 ${diffDays} 天`);
}

function getStatusBadge(status: string, t: (en: string, zh: string) => string) {
  const map: Record<string, { bg: string; text: string; en: string; zh: string }> = {
    open:      { bg: 'bg-blue-50',    text: 'text-blue-700',    en: 'Open',      zh: '进行中' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', en: 'Completed', zh: '已完成' },
    cancelled: { bg: 'bg-slate-100',  text: 'text-slate-500',   en: 'Cancelled', zh: '已取消' },
    lost:      { bg: 'bg-red-50',     text: 'text-red-700',     en: 'Lost',      zh: '已流失' },
  };
  const s = map[status] || map.open;
  return (
    <span className={`${s.bg} ${s.text} text-xs font-semibold px-2.5 py-1 rounded-full`}>
      {t(s.en, s.zh)}
    </span>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ items }: { items: ChecklistItemRaw[] }) {
  // Use actual stored items as the denominator so historical cases stay accurate
  // even if a future template gains/loses steps.
  const total = items.length;
  const completed = items.filter(i => i.completed_at !== null).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  let barColor = 'bg-slate-300';
  if (pct === 100) barColor = 'bg-emerald-500';
  else if (pct >= 50) barColor = 'bg-amber-400';
  else if (pct > 0) barColor = 'bg-blue-400';

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 shrink-0">{completed}/{total}</span>
    </div>
  );
}

// ─── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['all', 'open', 'completed', 'cancelled', 'lost'] as const;
type StatusFilter = typeof STATUS_OPTIONS[number];

const CASE_TYPE_OPTIONS = ['all', 'car_insurance'] as const;
type CaseTypeFilter = typeof CASE_TYPE_OPTIONS[number];

// ─── Main component ────────────────────────────────────────────────────────────

interface ClientOption {
  id: string;
  full_name: string;
}

export default function CaseList() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [caseTypeFilter, setCaseTypeFilter] = useState<CaseTypeFilter>('all');

  // New Case modal state
  const [showNewCase, setShowNewCase] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newCaseType, setNewCaseType] = useState('car_insurance');
  const [newCaseDueDate, setNewCaseDueDate] = useState('');
  const [creatingCase, setCreatingCase] = useState(false);
  const [caseError, setCaseError] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv) return;

      const [{ data }, { data: cls }] = await Promise.all([
        supabase
          .from('cases')
          .select(`*, clients(full_name), case_checklist_items(id, completed_at)`)
          .eq('advisor_id', adv.id),
        supabase
          .from('clients')
          .select('id, full_name')
          .eq('advisor_id', adv.id)
          .eq('status', 'active')
          .order('full_name'),
      ]);

      if (data) {
        // Sort: due_date ascending, nulls last
        const sorted = [...data].sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
        });
        setCases(sorted as CaseRow[]);
      }
      setClients((cls as ClientOption[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  async function openNewCaseModal() {
    setSelectedClientId('');
    setNewCaseType('car_insurance');
    setNewCaseDueDate('');
    setCaseError('');
    setShowNewCase(true);
  }

  async function handleCreateCase() {
    if (!selectedClientId) return;
    setCreatingCase(true);
    setCaseError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv) throw new Error('Advisor not found');

      const { data: newCase, error: caseErr } = await supabase
        .from('cases')
        .insert({
          client_id: selectedClientId,
          advisor_id: adv.id,
          case_type: newCaseType,
          due_date: newCaseDueDate || null,
        })
        .select()
        .single();

      if (caseErr) throw new Error(caseErr.message);

      const template = getCaseTemplate(newCaseType);
      if (template.length > 0) {
        await supabase.from('case_checklist_items').insert(
          template.map((item, idx) => ({
            case_id: newCase.id,
            item_key: item.key,
            label_en: item.en,
            label_zh: item.zh,
            sort_order: idx,
            completed_at: null,
          }))
        );
      }

      setShowNewCase(false);
      navigate(`/advisor/cases/${newCase.id}`);
    } catch (err: any) {
      setCaseError(err.message || 'Failed to create case');
    } finally {
      setCreatingCase(false);
    }
  }

  // Apply filters
  const filtered = cases.filter(c => {
    const clientName = c.clients?.full_name ?? '';
    if (search && !clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (caseTypeFilter !== 'all' && c.case_type !== caseTypeFilter) return false;
    return true;
  });

  const statusLabels: Record<StatusFilter, { en: string; zh: string }> = {
    all:       { en: 'All',       zh: '全部' },
    open:      { en: 'Open',      zh: '进行中' },
    completed: { en: 'Completed', zh: '已完成' },
    cancelled: { en: 'Cancelled', zh: '已取消' },
    lost:      { en: 'Lost',      zh: '已流失' },
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Briefcase size={22} className="text-xin-blue" />
          <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('Cases', '案件')}</h1>
        </div>
        <button
          onClick={openNewCaseModal}
          className="flex items-center gap-2 bg-xin-blue text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-xin-blueLight transition-colors"
        >
          <Plus size={16} />
          {t('New Case', '新建案件')}
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Search by client name...', '按客户姓名搜索...')}
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold w-56"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s
                  ? 'bg-xin-blue text-white'
                  : 'text-slate-500 hover:text-xin-blue'
              }`}
            >
              {t(statusLabels[s].en, statusLabels[s].zh)}
            </button>
          ))}
        </div>

        {/* Case type filter */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          <button
            onClick={() => setCaseTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              caseTypeFilter === 'all' ? 'bg-xin-blue text-white' : 'text-slate-500 hover:text-xin-blue'
            }`}
          >
            {t('All Types', '全部类型')}
          </button>
          <button
            onClick={() => setCaseTypeFilter('car_insurance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              caseTypeFilter === 'car_insurance' ? 'bg-xin-blue text-white' : 'text-slate-500 hover:text-xin-blue'
            }`}
          >
            {t('Car Insurance', '车险')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[2fr_1.2fr_1.5fr_1.5fr_1.2fr_90px] px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          <div>{t('Client', '客户')}</div>
          <div>{t('Type', '类型')}</div>
          <div>{t('Progress', '进度')}</div>
          <div>{t('Due Date', '截止日期')}</div>
          <div>{t('Case No.', '案件号')}</div>
          <div></div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            {t('No cases found.', '没有案件。')}
          </div>
        ) : (
          filtered.map(c => {
            const clientName = c.clients?.full_name ?? '—';
            const dueDateColor = getDueDateColor(c.due_date);
            const dueDateLabel = getDueDateLabel(c.due_date, t);

            return (
              <div
                key={c.id}
                className="grid grid-cols-[2fr_1.2fr_1.5fr_1.5fr_1.2fr_90px] px-6 py-3.5 border-b border-slate-50 last:border-0 items-center hover:bg-slate-50 transition-colors"
              >
                {/* Client name */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-xin-blue/10 text-xin-blue font-bold text-sm flex items-center justify-center shrink-0">
                    {clientName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-xin-blue">{clientName}</div>
                    <div className="mt-0.5">{getStatusBadge(c.status, t)}</div>
                  </div>
                </div>

                {/* Case type tag */}
                <div>
                  <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {getCaseTypeLabel(c.case_type, language)}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <ProgressBar items={c.case_checklist_items} />
                </div>

                {/* Due date */}
                <div>
                  {c.due_date ? (
                    <div>
                      <div className={`text-sm font-semibold ${dueDateColor}`}>{dueDateLabel}</div>
                      <div className="text-xs text-slate-400">{c.due_date}</div>
                    </div>
                  ) : (
                    <span className={`text-sm ${dueDateColor}`}>—</span>
                  )}
                </div>

                {/* Case number */}
                <div className="text-xs text-slate-500 font-mono">{c.case_number}</div>

                {/* View button */}
                <div>
                  <Link
                    to={`/advisor/cases/${c.id}`}
                    className="text-xs font-semibold text-xin-gold hover:text-xin-goldDark border border-xin-gold/30 px-3 py-1.5 rounded-lg hover:bg-xin-gold/5 transition-colors"
                  >
                    {t('View', '查看')}
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 mt-3">
          {filtered.length} {t('cases', '个案件')}
        </p>
      )}

      {/* New Case Modal */}
      {showNewCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-lg font-bold text-xin-blue">
                {t('New Case', '新建案件')}
              </h2>
              <button onClick={() => setShowNewCase(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Client */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t('Client', '客户')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
                >
                  <option value="">{t('— Select client —', '— 选择客户 —')}</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Case Type */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t('Case Type', '案件类型')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={newCaseType}
                  onChange={e => setNewCaseType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
                >
                  {Object.entries(CASE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label.en} / {label.zh}</option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t('Due Date', '到期日')}
                </label>
                <input
                  type="date"
                  value={newCaseDueDate}
                  onChange={e => setNewCaseDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1">{t('Policy expiry date (optional)', '保单到期日（可选）')}</p>
              </div>

              {caseError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{caseError}</div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateCase}
                disabled={!selectedClientId || creatingCase}
                className="flex-1 px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-50 text-sm"
              >
                {creatingCase ? t('Creating...', '创建中...') : t('Create Case', '创建案件')}
              </button>
              <button
                onClick={() => setShowNewCase(false)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors text-sm"
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
