import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { supabase } from '../../../lib/supabaseClient';
import { Send, Clock, Eye, X } from 'lucide-react';

type BroadcastTab = 'compose' | 'history';
type RecipientFilter = 'all' | 'has_insurance' | 'has_investment';

interface ComposeForm {
  title: string;
  content: string;
  filter: RecipientFilter;
  scheduledAt: string;
}

const EMPTY_FORM: ComposeForm = { title: '', content: '', filter: 'all', scheduledAt: '' };

export default function Broadcast() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [tab, setTab] = useState<BroadcastTab>('compose');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-2xl font-bold text-xin-blue">
          {t('Broadcast', '群发邮件')}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {t('Send emails to your clients', '向客户发送群发邮件')}
        </p>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['compose', 'history'] as BroadcastTab[]).map(tb => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === tb ? 'bg-white text-xin-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tb === 'compose' ? t('Compose', '写邮件') : t('History', '发送记录')}
          </button>
        ))}
      </div>

      {tab === 'compose' ? <ComposeTab t={t} language={language} /> : <HistoryTab t={t} language={language} />}
    </div>
  );
}

function ComposeTab({ t, language }: { t: (en: string, zh: string) => string; language: string }) {
  const [form, setForm] = useState<ComposeForm>(EMPTY_FORM);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const FILTER_LABELS: Record<RecipientFilter, { en: string; zh: string }> = {
    all:            { en: 'All active clients',       zh: '所有活跃客户' },
    has_insurance:  { en: 'Clients with insurance',   zh: '有保单的客户' },
    has_investment: { en: 'Clients with investments', zh: '有投资的客户' },
  };

  useEffect(() => {
    let cancelled = false;
    async function countRecipients() {
      setRecipientCount(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv || cancelled) return;

      if (form.filter === 'has_insurance') {
        const { data: policyClients } = await supabase
          .from('insurance_policies').select('client_id').eq('advisor_id', adv.id);
        const ids = [...new Set((policyClients || []).map((r: any) => r.client_id))];
        if (cancelled) return;
        if (ids.length === 0) { setRecipientCount(0); return; }
        const { count } = await supabase
          .from('clients').select('id', { count: 'exact', head: true })
          .eq('advisor_id', adv.id).eq('status', 'active').not('email', 'is', null).in('id', ids);
        if (!cancelled) setRecipientCount(count ?? 0);
        return;
      }

      if (form.filter === 'has_investment') {
        const { data: allClients } = await supabase
          .from('clients').select('id').eq('advisor_id', adv.id).eq('status', 'active');
        const allIds = (allClients || []).map((c: any) => c.id);
        if (!allIds.length) { if (!cancelled) setRecipientCount(0); return; }
        const { data: assetClients } = await supabase
          .from('assets').select('client_id').in('client_id', allIds);
        const ids = [...new Set((assetClients || []).map((r: any) => r.client_id))];
        if (cancelled) return;
        if (!ids.length) { setRecipientCount(0); return; }
        const { count } = await supabase
          .from('clients').select('id', { count: 'exact', head: true })
          .eq('advisor_id', adv.id).eq('status', 'active').not('email', 'is', null).in('id', ids);
        if (!cancelled) setRecipientCount(count ?? 0);
        return;
      }

      const { count } = await supabase
        .from('clients').select('id', { count: 'exact', head: true })
        .eq('advisor_id', adv.id).eq('status', 'active').not('email', 'is', null);
      if (!cancelled) setRecipientCount(count ?? 0);
    }
    countRecipients();
    return () => { cancelled = true; };
  }, [form.filter]);

  async function handleSend(isScheduled: boolean) {
    if (!form.title.trim() || !form.content.trim()) return;
    setSending(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv) throw new Error('Advisor not found');

      const payload: any = {
        advisor_id: adv.id,
        title: form.title.trim(),
        content: form.content,
        recipient_filter: { type: form.filter },
        status: isScheduled ? 'scheduled' : 'draft',
      };
      if (isScheduled && form.scheduledAt) {
        payload.scheduled_at = new Date(form.scheduledAt).toISOString();
      }

      const { data: broadcast, error: insertErr } = await supabase
        .from('broadcasts').insert(payload).select().single();
      if (insertErr || !broadcast) throw insertErr || new Error('Insert failed');

      if (!isScheduled) {
        const { error: fnErr } = await supabase.functions.invoke('send-broadcast', {
          body: { broadcastId: broadcast.id },
        });
        if (fnErr) throw fnErr;
      }

      setSent(true);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setError(e.message || t('Send failed. Please try again.', '发送失败，请重试。'));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 p-10 text-center">
        <div className="text-4xl mb-3">✅</div>
        <div className="font-semibold text-xin-blue text-lg mb-2">
          {t('Broadcast sent!', '群发已发送！')}
        </div>
        <button onClick={() => setSent(false)}
          className="mt-4 px-6 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm hover:bg-xin-blueLight transition-colors">
          {t('Send another', '再发一封')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <label className="text-xs font-medium text-slate-400 mb-1.5 block">
          {t('Subject', '邮件标题')} <span className="text-red-400">*</span>
        </label>
        <input
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          placeholder={t('e.g. May Market Update', '例：五月市场动态')}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 pt-4 pb-2 border-b border-slate-100">
          <label className="text-xs font-medium text-slate-400">
            {t('Content', '内容')} <span className="text-red-400">*</span>
          </label>
        </div>
        <RichTextEditor value={form.content} onChange={v => setForm(p => ({ ...p, content: v }))} t={t} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <label className="text-xs font-medium text-slate-400 mb-3 block">
          {t('Recipients', '收件人')}
        </label>
        <div className="space-y-2">
          {(Object.keys(FILTER_LABELS) as RecipientFilter[]).map(f => (
            <label key={f} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="recipient-filter" checked={form.filter === f}
                onChange={() => setForm(p => ({ ...p, filter: f }))} className="accent-xin-blue" />
              <span className="text-sm text-xin-blue">
                {language === 'zh' ? FILTER_LABELS[f].zh : FILTER_LABELS[f].en}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 text-xs text-slate-400">
          {recipientCount === null
            ? t('Counting...', '计算中...')
            : `${recipientCount} ${t('recipients (with email address)', '位收件人（有邮箱地址）')}`}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <label className="text-xs font-medium text-slate-400 mb-1.5 block">
          {t('Schedule (leave blank to send now)', '排程发送（留空 = 立即发送）')}
        </label>
        <input type="datetime-local" value={form.scheduledAt}
          onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
          min={new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setShowPreview(true)}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-colors">
          <Eye size={15} />
          {t('Preview', '预览')}
        </button>

        {form.scheduledAt ? (
          <button onClick={() => handleSend(true)}
            disabled={sending || !form.title.trim() || !form.content.trim() || (recipientCount ?? 0) === 0}
            className="flex items-center gap-2 flex-1 justify-center py-3 bg-xin-blue text-white font-semibold rounded-xl text-sm hover:bg-xin-blueLight disabled:opacity-40 transition-colors">
            <Clock size={15} />
            {sending ? t('Scheduling...', '排程中...') : t('Schedule', '排程发送')}
          </button>
        ) : (
          <button onClick={() => handleSend(false)}
            disabled={sending || !form.title.trim() || !form.content.trim() || (recipientCount ?? 0) === 0}
            className="flex items-center gap-2 flex-1 justify-center py-3 bg-xin-gold text-xin-blue font-semibold rounded-xl text-sm hover:bg-xin-gold/90 disabled:opacity-40 transition-colors">
            <Send size={15} />
            {sending ? t('Sending...', '发送中...') : `${t('Send Now', '立即发送')}${recipientCount !== null ? ` (${recipientCount})` : ''}`}
          </button>
        )}
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-xin-blue">{t('Email Preview', '邮件预览')}</h3>
              <button onClick={() => setShowPreview(false)} className="text-slate-300 hover:text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="text-xs text-slate-400 mb-1">{t('Subject', '主题')}</div>
              <div className="font-semibold text-xin-blue mb-5 text-lg">
                {form.title || t('(No subject)', '（无标题）')}
              </div>
              <div className="border-t border-slate-100 pt-5">
                <div className="text-slate-700 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: form.content || `<p style="color:#94a3b8">${t('(No content)', '（无内容）')}</p>` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ t, language }: { t: (en: string, zh: string) => string; language: string }) {
  return <div className="text-slate-400 text-sm p-4">{t('Coming soon...', '即将上线...')}</div>;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  t: (en: string, zh: string) => string;
}

function RichTextEditor({ value, onChange, t }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (!initialised.current && editorRef.current) {
      editorRef.current.innerHTML = value;
      initialised.current = true;
    }
  }, []);

  function exec(command: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  const btn = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors';

  return (
    <div>
      <div className="flex items-center gap-0.5 px-4 py-2 border-b border-slate-100 bg-slate-50 flex-wrap">
        <button type="button" onClick={() => exec('bold')} className={`${btn} font-bold`}>B</button>
        <button type="button" onClick={() => exec('italic')} className={`${btn} italic`}>I</button>
        <button type="button" onClick={() => exec('underline')} className={`${btn} underline`}>U</button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className={btn}>
          ≡ {t('List', '列表')}
        </button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button type="button"
          onClick={() => { const url = window.prompt(t('Enter link URL', '输入链接地址')); if (url) exec('createLink', url); }}
          className={btn}>
          🔗
        </button>
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        className="min-h-[220px] px-5 py-4 text-sm text-slate-700 focus:outline-none"
        style={{ lineHeight: '1.7' }} />
    </div>
  );
}
