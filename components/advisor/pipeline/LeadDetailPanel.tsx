import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X, Calendar, ChevronRight, CheckCircle, Plus, Phone, Mail, Users, Bell, ClipboardList } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { STAGES, LEAD_SOURCES, getStage, getLeadSource } from './stages';
import type { Lead } from './types';
import type { StageKey, LeadSourceKey } from './stages';

interface Props {
  lead: Lead;
  onClose: () => void;
  onMoveStage: (leadId: string, stage: StageKey) => void;
  onUpdateLead: (leadId: string, fields: Partial<Lead>) => void;
  onRefresh: () => void;
  language: string;
}

// ── Note types (same as ActivityTab) ─────────────────────────
const NOTE_TYPES = [
  { type: 'meeting',  label: 'Meeting',  labelZh: '面谈', icon: Users,        color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { type: 'call',     label: 'Call',     labelZh: '电话', icon: Phone,        color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { type: 'email',    label: 'Email',    labelZh: '邮件', icon: Mail,         color: 'text-purple-600',  bg: 'bg-purple-50'  },
  { type: 'task',     label: 'Task',     labelZh: '任务', icon: ClipboardList,color: 'text-amber-600',   bg: 'bg-amber-50'   },
  { type: 'reminder', label: 'Reminder', labelZh: '提醒', icon: Bell,         color: 'text-red-500',     bg: 'bg-red-50'     },
] as const;

type NoteTypeKey = typeof NOTE_TYPES[number]['type'];

interface Note {
  id: string;
  note_type: NoteTypeKey;
  content: string;
  follow_up_date: string | null;
  follow_up_done: boolean;
  created_at: string;
}

const EMPTY_NOTE = { note_type: 'meeting' as NoteTypeKey, content: '', follow_up_date: '' };

export default function LeadDetailPanel({ lead, onClose, onMoveStage, onUpdateLead, onRefresh, language }: Props) {
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  // ── local editable state (text fields are debounced via onBlur; stage is read directly from lead prop) ──
  const stage = lead.pipeline_stage;
  const [leadSource, setLeadSource]   = useState<LeadSourceKey | null>(lead.lead_source);
  const [nextAction, setNextAction]   = useState(lead.next_action ?? '');
  const [nextDate, setNextDate]       = useState(lead.next_action_date ?? '');
  const [savingMeta, setSavingMeta]   = useState(false);

  // ── notes ─────────────────────────────────────────────────
  const [notes, setNotes]             = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm]       = useState(EMPTY_NOTE);
  const [savingNote, setSavingNote]   = useState(false);
  const [advisorId, setAdvisorId]     = useState<string | null>(null);

  // ── "Mark done & plan next" mini-form ────────────────────
  const [showNextForm, setShowNextForm] = useState(false);
  const [nextActionDraft, setNextActionDraft] = useState('');
  const [nextDateDraft, setNextDateDraft]     = useState('');

  const loadNotes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
    if (adv) setAdvisorId(adv.id);
    const { data } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', lead.id)
      .order('created_at', { ascending: false });
    setNotes((data as Note[]) || []);
    setLoadingNotes(false);
  }, [lead.id]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Keep local form fields in sync when parent passes a different lead
  useEffect(() => {
    setLeadSource(lead.lead_source);
    setNextAction(lead.next_action ?? '');
    setNextDate(lead.next_action_date ?? '');
  }, [lead.id]);

  // ── save metadata ─────────────────────────────────────────
  async function saveMeta() {
    setSavingMeta(true);
    const fields: Partial<Lead> = {
      lead_source: leadSource,
      next_action: nextAction || null,
      next_action_date: nextDate || null,
    };
    await onUpdateLead(lead.id, fields);
    setSavingMeta(false);
  }

  // ── stage change (parent owns state, we just notify) ────
  async function handleStageChange(newStage: StageKey) {
    if (newStage === stage) return;
    await onMoveStage(lead.id, newStage);
  }

  // ── mark next action done → archive note + set new ───────
  async function markDoneAndPlanNext() {
    if (!advisorId || !nextAction.trim()) return;
    if (!nextActionDraft.trim()) {
      alert(language === 'zh' ? '请填写下一步行动' : 'Please enter the next action');
      return;
    }
    // Archive current next_action as a completed task note
    await supabase.from('client_notes').insert({
      client_id: lead.id,
      advisor_id: advisorId,
      note_type: 'task',
      content: nextAction.trim(),
      follow_up_date: nextDate || null,
      follow_up_done: true,
    });
    // Set new next action
    const fields: Partial<Lead> = {
      next_action: nextActionDraft.trim() || null,
      next_action_date: nextDateDraft || null,
    };
    setNextAction(nextActionDraft.trim());
    setNextDate(nextDateDraft);
    setShowNextForm(false);
    setNextActionDraft('');
    setNextDateDraft('');
    await onUpdateLead(lead.id, fields);
    await loadNotes();
    onRefresh();
  }

  // ── add note ──────────────────────────────────────────────
  async function handleAddNote() {
    if (!noteForm.content.trim() || !advisorId) return;
    setSavingNote(true);
    await supabase.from('client_notes').insert({
      client_id: lead.id,
      advisor_id: advisorId,
      note_type: noteForm.note_type,
      content: noteForm.content.trim(),
      follow_up_date: noteForm.follow_up_date || null,
      follow_up_done: false,
    });
    setSavingNote(false);
    setShowNoteForm(false);
    setNoteForm(EMPTY_NOTE);
    await loadNotes();
  }

  const stageMeta = getStage(stage);
  const sourceMeta = getLeadSource(leadSource);
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = nextDate && nextDate < today;
  const isToday   = nextDate && nextDate === today;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-[480px] bg-white shadow-2xl h-full flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-xin-blue/10 text-xin-blue font-bold text-sm flex items-center justify-center shrink-0">
                {lead.full_name.charAt(0).toUpperCase()}
              </div>
              <h2 className="font-semibold text-xin-blue text-base truncate">{lead.full_name}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1 ml-10">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stageMeta.bg} ${stageMeta.text}`}>
                {language === 'zh' ? STAGES.find(s => s.key === stage)?.zh : STAGES.find(s => s.key === stage)?.en}
              </span>
              {sourceMeta && (
                <span className="text-[10px] text-slate-400">
                  {language === 'zh' ? sourceMeta.zh : sourceMeta.en}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 shrink-0 ml-2">
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Pipeline Stage ── */}
          <Section title={t('Pipeline Stage', '销售阶段')}>
            <div className="flex flex-wrap gap-2">
              {STAGES.filter(s => s.key !== 'closed_lost').map(s => (
                <button
                  key={s.key}
                  onClick={() => handleStageChange(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    stage === s.key
                      ? `${s.bg} ${s.text} ${s.border}`
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {language === 'zh' ? s.zh : s.en}
                </button>
              ))}
              {/* Closed lost as separate danger button */}
              <button
                onClick={() => handleStageChange('closed_lost')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  stage === 'closed_lost'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-white text-slate-300 border-slate-200 hover:border-rose-200 hover:text-rose-400'
                }`}
              >
                {t('Closed Lost', '已流失')}
              </button>
            </div>
          </Section>

          {/* ── Lead Source ── */}
          <Section title={t('Lead Source', '来源渠道')}>
            <select
              value={leadSource ?? ''}
              onChange={e => setLeadSource((e.target.value as LeadSourceKey) || null)}
              onBlur={saveMeta}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold focus:bg-white"
            >
              <option value="">{t('— Not set —', '— 未设置 —')}</option>
              {LEAD_SOURCES.map(s => (
                <option key={s.key} value={s.key}>{language === 'zh' ? s.zh : s.en}</option>
              ))}
            </select>
          </Section>

          {/* ── Website Quiz Background ── */}
          {lead.metadata?.source === 'invest_check' && (
            <Section title={t('Website Quiz Background', '网站测评背景')}>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-1">
                <div className="text-xs font-semibold text-blue-800">
                  {t('Investment Power Index', '投资力指数')}：<span className="font-bold">{lead.metadata.score}</span>
                  {lead.metadata.weakest_label_zh && (
                    <span className="font-normal"> · {t('Weakest', '最弱')}：{lead.metadata.weakest_label_zh}</span>
                  )}
                </div>
                {(lead.metadata.investable_range || lead.metadata.preferred_date) && (
                  <div className="text-xs text-blue-900">
                    {lead.metadata.investable_range && (
                      <span>{t('Investable Range', '可投资区间')}：{lead.metadata.investable_range}</span>
                    )}
                    {lead.metadata.preferred_date && (
                      <span className="ml-2">· {t('Preferred', '偏好')}：{lead.metadata.preferred_date}{lead.metadata.preferred_time_slot ? ` ${lead.metadata.preferred_time_slot}` : ''}</span>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ── Next Action ── */}
          <Section title={t('Next Action', '下一步行动')}>
            {showNextForm ? (
              // Mini form for new next action after marking done
              <div className="space-y-3 bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                <p className="text-xs font-semibold text-emerald-700">{t('Plan your next action', '设定下一步行动')}</p>
                <input
                  autoFocus
                  type="text"
                  value={nextActionDraft}
                  onChange={e => setNextActionDraft(e.target.value)}
                  placeholder={t('What will you do next?', '下一步要做什么？')}
                  className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
                />
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={nextDateDraft}
                    onChange={e => setNextDateDraft(e.target.value)}
                    min={today}
                    className="flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={markDoneAndPlanNext}
                    className="flex-1 py-2 bg-xin-blue text-white text-xs font-semibold rounded-xl hover:bg-xin-blueLight"
                  >
                    {t('Save', '保存')}
                  </button>
                  <button
                    onClick={() => setShowNextForm(false)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-500 text-xs font-medium rounded-xl"
                  >
                    {t('Cancel', '取消')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={nextAction}
                  onChange={e => setNextAction(e.target.value)}
                  onBlur={saveMeta}
                  rows={2}
                  placeholder={t('What needs to happen next with this lead?', '跟这个潜在客户的下一步是什么？')}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold focus:bg-white resize-none"
                />
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={nextDate}
                    onChange={e => setNextDate(e.target.value)}
                    onBlur={saveMeta}
                    className={`flex-1 px-3 py-1.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:border-xin-gold focus:bg-white ${
                      isOverdue ? 'border-red-300 bg-red-50 text-red-600' :
                      isToday   ? 'border-orange-300 bg-orange-50 text-orange-600' :
                      'border-slate-200'
                    }`}
                  />
                </div>
                {nextAction.trim() && (
                  <button
                    onClick={() => setShowNextForm(true)}
                    className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
                  >
                    <CheckCircle size={13} />
                    {t('Mark Done & Plan Next', '完成并设定下一步')}
                  </button>
                )}
                {savingMeta && <span className="text-[10px] text-slate-300">{t('Saving…', '保存中…')}</span>}
              </div>
            )}
          </Section>

          {/* ── Interaction History ── */}
          <Section
            title={t('Interaction History', '互动记录')}
            action={
              <button
                onClick={() => setShowNoteForm(true)}
                className="flex items-center gap-1 text-xs text-xin-gold font-semibold hover:text-xin-goldDark"
              >
                <Plus size={13} />
                {t('Add', '添加')}
              </button>
            }
          >
            {/* Add note form */}
            {showNoteForm && (
              <div className="mb-3 bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-3">
                {/* Type selector */}
                <div className="flex gap-1.5 flex-wrap">
                  {NOTE_TYPES.map(nt => {
                    const Icon = nt.icon;
                    const active = noteForm.note_type === nt.type;
                    return (
                      <button
                        key={nt.type}
                        onClick={() => setNoteForm(p => ({ ...p, note_type: nt.type }))}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                          active ? `${nt.bg} ${nt.color} border-transparent` : 'bg-white text-slate-400 border-slate-200'
                        }`}
                      >
                        <Icon size={11} />
                        {language === 'zh' ? nt.labelZh : nt.label}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  autoFocus
                  value={noteForm.content}
                  onChange={e => setNoteForm(p => ({ ...p, content: e.target.value }))}
                  rows={3}
                  placeholder={t('What did you discuss or do?', '谈了什么？做了什么？')}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold resize-none"
                />
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={noteForm.follow_up_date}
                    onChange={e => setNoteForm(p => ({ ...p, follow_up_date: e.target.value }))}
                    min={today}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold"
                  />
                  <span className="text-[10px] text-slate-300">{t('follow-up date', '跟进日期（选填）')}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNote}
                    disabled={savingNote || !noteForm.content.trim()}
                    className="flex-1 py-2 bg-xin-blue text-white text-xs font-semibold rounded-xl hover:bg-xin-blueLight disabled:opacity-40"
                  >
                    {savingNote ? '...' : t('Save Note', '保存')}
                  </button>
                  <button
                    onClick={() => { setShowNoteForm(false); setNoteForm(EMPTY_NOTE); }}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-500 text-xs font-medium rounded-xl"
                  >
                    {t('Cancel', '取消')}
                  </button>
                </div>
              </div>
            )}

            {/* Notes list */}
            {loadingNotes ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-xin-blue" />
              </div>
            ) : notes.length === 0 ? (
              <p className="text-xs text-slate-300 py-4 text-center">
                {t('No interactions recorded yet.', '还没有互动记录。')}
              </p>
            ) : (
              <div className="space-y-2">
                {notes.map(note => {
                  const info = NOTE_TYPES.find(n => n.type === note.note_type) ?? NOTE_TYPES[0];
                  const Icon = info.icon;
                  return (
                    <div key={note.id} className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${
                      note.follow_up_done ? 'border-slate-100 opacity-60' : 'border-slate-100'
                    }`}>
                      <div className={`${info.bg} ${info.color} p-1.5 rounded-lg shrink-0 mt-0.5`}>
                        <Icon size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs text-xin-blue ${note.follow_up_done ? 'line-through' : ''}`}>
                          {note.content}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[10px] font-medium ${info.color}`}>
                            {language === 'zh' ? info.labelZh : info.label}
                          </span>
                          <span className="text-[10px] text-slate-300">·</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(note.created_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-MY', { day: 'numeric', month: 'short' })}
                          </span>
                          {note.follow_up_date && (
                            <>
                              <span className="text-[10px] text-slate-300">·</span>
                              <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                                note.follow_up_done ? 'text-emerald-500' :
                                note.follow_up_date < today ? 'text-red-500' : 'text-amber-600'
                              }`}>
                                <Calendar size={9} />
                                {note.follow_up_done ? t('Done', '已完成') : note.follow_up_date}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ── Quick links ── */}
          <Section title={t('Quick Links', '快捷链接')}>
            <div className="space-y-1.5">
              <Link
                to={`/advisor/clients/${lead.id}`}
                onClick={onClose}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <span className="text-sm text-xin-blue font-medium">{t('Full Profile', '完整档案')}</span>
                <ChevronRight size={14} className="text-slate-400" />
              </Link>
              <Link
                to={`/advisor/clients/${lead.id}?tab=activity`}
                onClick={onClose}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <span className="text-sm text-xin-blue font-medium">{t('Activity Tab', '活动记录')}</span>
                <ChevronRight size={14} className="text-slate-400" />
              </Link>
            </div>
          </Section>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}

// ── Reusable section wrapper ──────────────────────────────────
function Section({ title, action, children }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-slate-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
