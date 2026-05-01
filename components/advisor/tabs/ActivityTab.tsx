import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, X, CheckCircle, Circle, Calendar, Phone, Mail, Users, Bell, ClipboardList } from 'lucide-react';

type NoteType = 'meeting' | 'call' | 'email' | 'task' | 'reminder';

const NOTE_TYPES: { type: NoteType; label: string; labelZh: string; icon: any; color: string; bg: string }[] = [
  { type: 'meeting', label: 'Meeting', labelZh: '面谈', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { type: 'call', label: 'Call', labelZh: '电话', icon: Phone, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { type: 'email', label: 'Email', labelZh: '邮件', icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50' },
  { type: 'task', label: 'Task', labelZh: '任务', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
  { type: 'reminder', label: 'Reminder', labelZh: '提醒', icon: Bell, color: 'text-red-500', bg: 'bg-red-50' },
];

const EMPTY_FORM = { note_type: 'meeting' as NoteType, content: '', follow_up_date: '', follow_up_done: false };

export default function ActivityTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [advisorId, setAdvisorId] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
    if (adv) setAdvisorId(adv.id);
    const { data } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setNotes(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [clientId]);

  async function handleAdd() {
    if (!form.content.trim() || !advisorId) return;
    setSaving(true);
    await supabase.from('client_notes').insert({
      client_id: clientId,
      advisor_id: advisorId,
      note_type: form.note_type,
      content: form.content.trim(),
      follow_up_date: form.follow_up_date || null,
      follow_up_done: false,
    });
    setSaving(false);
    setShowForm(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function toggleDone(id: string, current: boolean) {
    await supabase.from('client_notes').update({ follow_up_done: !current }).eq('id', id);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm(t('Delete this note?', '确定删除此备注？'))) return;
    await supabase.from('client_notes').delete().eq('id', id);
    load();
  }

  const pending = notes.filter(n => n.follow_up_date && !n.follow_up_done);
  const others = notes.filter(n => !n.follow_up_date || n.follow_up_done);

  const typeInfo = (type: NoteType) => NOTE_TYPES.find(t => t.type === type) || NOTE_TYPES[0];

  const formatDate = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: d, urgent: true };
    if (diff === 0) return { label: t('Today', '今天'), urgent: true };
    if (diff === 1) return { label: t('Tomorrow', '明天'), urgent: false };
    if (diff <= 7) return { label: `${diff}d`, urgent: false };
    return { label: d, urgent: false };
  };

  if (loading) return <Loader />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-xin-blue">{t('Activity & Notes', '活动记录')}</h3>
          {pending.length > 0 && (
            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {pending.length} {t('pending', '待跟进')}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-xin-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blueLight transition-colors"
        >
          <Plus size={14} />
          {t('Add Note', '添加记录')}
        </button>
      </div>

      {/* Pending follow-ups */}
      {pending.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
            {t('Pending Follow-ups', '待跟进')}
          </div>
          <div className="space-y-2">
            {pending.map(note => {
              const info = typeInfo(note.note_type);
              const Icon = info.icon;
              const dateInfo = formatDate(note.follow_up_date);
              return (
                <div key={note.id} className="bg-white border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <button onClick={() => toggleDone(note.id, note.follow_up_done)} className="mt-0.5 shrink-0 text-slate-300 hover:text-emerald-500 transition-colors">
                    <Circle size={18} />
                  </button>
                  <div className={`${info.bg} ${info.color} p-1.5 rounded-lg shrink-0 mt-0.5`}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-xin-blue">{note.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-semibold flex items-center gap-1 ${dateInfo.urgent ? 'text-red-500' : 'text-amber-600'}`}>
                        <Calendar size={10} />
                        {t('Follow up', '跟进')}: {dateInfo.label}
                      </span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(note.id)} className="text-slate-200 hover:text-red-400 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All notes */}
      {notes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="text-3xl mb-3">📝</div>
          <div className="text-slate-400 text-sm">{t('No notes yet. Add your first note after meeting this client.', '还没有记录。和客户见面后在这里添加备注。')}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {others.length > 0 && pending.length > 0 && (
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 mt-4">
              {t('All Notes', '所有记录')}
            </div>
          )}
          {others.map(note => {
            const info = typeInfo(note.note_type);
            const Icon = info.icon;
            return (
              <div key={note.id} className={`bg-white border border-slate-100 rounded-xl p-4 flex items-start gap-3 ${note.follow_up_done ? 'opacity-60' : ''}`}>
                {note.follow_up_date ? (
                  <button onClick={() => toggleDone(note.id, note.follow_up_done)} className="mt-0.5 shrink-0 text-emerald-400 hover:text-emerald-600 transition-colors">
                    <CheckCircle size={18} />
                  </button>
                ) : <div className="w-[18px] shrink-0" />}
                <div className={`${info.bg} ${info.color} p-1.5 rounded-lg shrink-0 mt-0.5`}>
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm text-xin-blue ${note.follow_up_done ? 'line-through' : ''}`}>{note.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-medium ${info.color}`}>
                      {language === 'zh' ? info.labelZh : info.label}
                    </span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400">{new Date(note.created_at).toLocaleDateString()}</span>
                    {note.follow_up_done && (
                      <>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-emerald-500">{t('Done', '已完成')}</span>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(note.id)} className="text-slate-200 hover:text-red-400 transition-colors shrink-0">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Note Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-xin-blue">{t('Add Note', '添加记录')}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-300 hover:text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Type selector */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-2 block">{t('Type', '类型')}</label>
                <div className="flex gap-2 flex-wrap">
                  {NOTE_TYPES.map(nt => {
                    const Icon = nt.icon;
                    const active = form.note_type === nt.type;
                    return (
                      <button key={nt.type} onClick={() => setForm(p => ({ ...p, note_type: nt.type }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          active ? `${nt.bg} ${nt.color} border-transparent` : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon size={12} />
                        {language === 'zh' ? nt.labelZh : nt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  {t('Notes', '备注')} <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  rows={4}
                  placeholder={t(
                    'What did you discuss? What needs to be followed up?',
                    '谈了什么？需要跟进什么？'
                  )}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold focus:bg-white resize-none transition-colors"
                />
              </div>

              {/* Follow-up date */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  {t('Follow-up Date (optional)', '跟进日期（选填）')}
                </label>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={form.follow_up_date}
                    onChange={e => setForm(p => ({ ...p, follow_up_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-5 pt-0">
              <button onClick={handleAdd} disabled={saving || !form.content.trim()}
                className="flex-1 py-3 bg-xin-blue text-white font-semibold rounded-xl text-sm hover:bg-xin-blueLight disabled:opacity-40 transition-colors"
              >
                {saving ? '...' : t('Save Note', '保存记录')}
              </button>
              <button onClick={() => setShowForm(false)}
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

const Loader = () => (
  <div className="flex items-center justify-center h-40">
    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" />
  </div>
);
