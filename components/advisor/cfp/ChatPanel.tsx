import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import type { T } from './primitives';

// Advisor ↔ agent chat for one section: ask the persona why it planned things
// this way, or instruct it to revise the draft narrative. The edge function
// redacts NRIC/account patterns server-side; deterministic numbers never move
// through chat (revise regenerates prose only).

interface ChatMsg {
  id?: string;
  role: 'advisor' | 'agent';
  message: string;
  created_at?: string;
}

export default function ChatPanel({
  sectionId, reportId, sectionType, personaZh, t, language, canRevise, onSectionChanged,
}: {
  sectionId: string;
  reportId: string;
  sectionType: string;
  personaZh: string;
  t: T;
  language: 'en' | 'zh';
  /** revise overwrites narrative — disabled on approved sections */
  canRevise: boolean;
  onSectionChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'chat' | 'revise' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const { data } = await supabase
      .from('cfp_chat_messages')
      .select('id, role, message, created_at')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMsgs((data as ChatMsg[]) || []);
  }

  useEffect(() => { if (open) load(); }, [open, sectionId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  async function send(mode: 'chat' | 'revise') {
    const text = input.trim();
    if (!text || busy) return;
    if (mode === 'revise' && !confirm(t(
      'The agent will rewrite this section\'s narrative per your instruction (numbers stay locked). Continue?',
      '智能体将按你的指示重写本节叙述（数字保持锁定）。继续？',
    ))) return;
    setBusy(mode);
    setErr(null);
    // optimistic append
    setMsgs(m => [...m, { role: 'advisor', message: mode === 'revise' ? `[修改指示] ${text}` : text }]);
    setInput('');
    const { data, error } = await supabase.functions.invoke('cfp-brain', {
      body: mode === 'chat'
        ? { mode: 'chat', report_id: reportId, section_type: sectionType, message: text }
        : { mode: 'revise', report_id: reportId, section_type: sectionType, instruction: text },
    });
    setBusy(null);
    if (error) {
      setErr(error.message);
      await load();
      return;
    }
    if (mode === 'chat') {
      setMsgs(m => [...m, { role: 'agent', message: (data as any)?.reply ?? '' }]);
    } else {
      await load();
      onSectionChanged();
    }
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-sm font-bold text-xin-blue">
          💬 {t(`Ask ${personaZh}`, `问一问${personaZh}`)}
        </span>
        <span className="text-slate-300 text-xs">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {msgs.map((m, i) => (
              <div key={m.id ?? `tmp-${i}`} className={`flex ${m.role === 'advisor' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'advisor'
                    ? 'bg-xin-blue text-white'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}>
                  {m.role === 'agent' && (
                    <div className="text-[11px] font-semibold text-xin-gold mb-0.5">{personaZh}</div>
                  )}
                  {m.message}
                </div>
              </div>
            ))}
            {!msgs.length && (
              <p className="text-xs text-slate-400 py-2">
                {t(
                  'Ask why the analysis is arranged this way, what an assumption means, or give instructions to revise the draft.',
                  '可以问「为什么这么安排」、某个假设的含义，或直接给出修改草稿的指示。',
                )}
              </p>
            )}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-xin-blue" />
                {busy === 'chat' ? t('Thinking…', '思考中…') : t('Revising draft…', '正在按指示重写草稿…')}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {err && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{err}</div>}

          <div className="space-y-1.5">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send('chat'); }
              }}
              rows={2}
              placeholder={t('Message the agent… (Enter to send)', '给智能体留言…（Enter 发送）')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-xin-blue bg-white"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => send('chat')}
                disabled={!!busy || !input.trim()}
                className="bg-xin-blue text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-xin-blueLight transition-colors disabled:opacity-50"
              >
                {t('Send', '发送')}
              </button>
              {canRevise && (
                <button
                  onClick={() => send('revise')}
                  disabled={!!busy || !input.trim()}
                  className="bg-white border border-xin-blue/30 text-xin-blue text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-xin-blue/5 transition-colors disabled:opacity-50"
                  title={t('The agent rewrites the narrative per this instruction', '智能体按此指示重写叙述')}
                >
                  ✍️ {t('Revise draft with this', '按此修改草稿')}
                </button>
              )}
              <span className="text-[11px] text-slate-400 ml-auto">
                {t('Do not enter names or ID numbers.', '请勿输入姓名/证件号等个人信息。')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
