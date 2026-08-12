// components/advisor/pages/SuitabilityList.tsx
// Advisor view of Investor Suitability Assessments: create one, copy the link to
// send the prospect before the meeting, and see which have come back.
//
// Reads go directly through supabase-js under RLS (house pattern); only the
// mutations that need the service role — creating a token, cancelling — go to
// /api/suitability.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { AlertTriangle, Check, ClipboardCheck, Copy, Plus, X } from 'lucide-react';

const STATUS_BADGES: Record<string, { en: string; zh: string; cls: string }> = {
  awaiting_client: { en: 'Awaiting Client', zh: '待客户填写', cls: 'bg-blue-50 text-blue-700' },
  submitted: { en: 'To Review', zh: '待审阅', cls: 'bg-amber-50 text-amber-700' },
  reviewed: { en: 'Reviewed', zh: '已审阅', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { en: 'Cancelled', zh: '已取消', cls: 'bg-rose-50 text-rose-600' },
};

const PROFILE_LABEL: Record<string, { en: string; zh: string }> = {
  STABLE: { en: 'Stable', zh: '稳健型' },
  BALANCED: { en: 'Balanced', zh: '平衡型' },
  GROWTH: { en: 'Growth', zh: '成长型' },
  AGGRESSIVE_GROWTH: { en: 'Aggressive Growth', zh: '积极成长型' },
};

interface Row {
  id: string;
  prospect_name: string | null;
  status: string;
  token: string | null;
  locale: string;
  created_at: string;
  submitted_at: string | null;
  suitability_results: {
    final_profile: string;
    requires_advisor_review: boolean;
    delivery_status: string;
  }[];
}

export default function SuitabilityList() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newLocale, setNewLocale] = useState<'en' | 'zh'>(language === 'zh' ? 'zh' : 'en');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error: e } = await supabase
      .from('suitability_assessments')
      .select(
        'id, prospect_name, status, token, locale, created_at, submitted_at, suitability_results(final_profile, requires_advisor_review, delivery_status)',
      )
      .order('created_at', { ascending: false });
    if (e) setError(e.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  async function createNew() {
    setCreating(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const res = await fetch('/api/suitability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create',
          prospectName: newName.trim() || null,
          locale: newLocale,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to create');
      setNewName('');
      await load();
      if (body.token) copyLink(body.id, body.token);
    } catch (e: any) {
      setError(e?.message || t('Could not create the assessment.', '无法创建评估。'));
    } finally {
      setCreating(false);
    }
  }

  async function cancel(id: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await fetch('/api/suitability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'cancel', id }),
    });
    load();
  }

  function copyLink(id: string, token: string) {
    const url = `${window.location.origin}/suitability/${token}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-xin-blue">
            {t('Suitability Assessments', '投资适当性评估')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'Send a prospect the link before your first meeting.',
              '在首次会面前把链接发给潜在客户。',
            )}
          </p>
        </div>
      </div>

      {/* create */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('Prospect name (optional)', '潜在客户姓名（可选）')}
          className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue"
        />
        <div className="flex items-center bg-slate-100 rounded-xl p-1">
          {(['en', 'zh'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setNewLocale(l)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                newLocale === l ? 'bg-white text-xin-blue shadow-sm' : 'text-slate-500'
              }`}
            >
              {l === 'en' ? 'EN' : '中文'}
            </button>
          ))}
        </div>
        <button
          onClick={createNew}
          disabled={creating}
          className="flex items-center justify-center gap-1.5 bg-xin-blue text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-60"
        >
          <Plus size={15} /> {t('New & copy link', '新建并复制链接')}
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue mx-auto mt-16" />
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
          <ClipboardCheck size={32} className="mx-auto mb-3 text-slate-300" />
          {t(
            'No assessments yet. Create one and send the link to a prospect.',
            '还没有评估。新建一份并把链接发给潜在客户。',
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {rows.map((r) => {
            const b = STATUS_BADGES[r.status] ?? STATUS_BADGES.awaiting_client;
            const result = r.suitability_results?.[0];
            const done = r.status === 'submitted' || r.status === 'reviewed';
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <button
                  onClick={() => done && navigate(`/advisor/suitability/${r.id}`)}
                  disabled={!done}
                  className="flex-1 min-w-0 text-left disabled:cursor-default"
                >
                  <p className="text-sm font-semibold text-xin-blue truncate flex items-center gap-2">
                    {r.prospect_name || t('(Unnamed prospect)', '（未命名）')}
                    {result?.requires_advisor_review && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"
                        title={t('Requires your review', '需要你人工审阅')}
                      >
                        <AlertTriangle size={11} /> {t('Review', '需审阅')}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {result
                      ? `${
                          language === 'zh'
                            ? PROFILE_LABEL[result.final_profile]?.zh
                            : PROFILE_LABEL[result.final_profile]?.en
                        } · ${t('Submitted', '提交于')} ${new Date(
                          r.submitted_at ?? r.created_at,
                        ).toLocaleDateString(language === 'zh' ? 'zh-MY' : 'en-MY')}`
                      : `${t('Created', '创建于')} ${new Date(r.created_at).toLocaleDateString(
                          language === 'zh' ? 'zh-MY' : 'en-MY',
                        )}`}
                    {result && result.delivery_status === 'failed' && (
                      <span className="text-rose-500 ml-1.5">
                        · {t('PDF delivery failed', 'PDF 投递失败')}
                      </span>
                    )}
                  </p>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`${b.cls} text-xs font-semibold px-2.5 py-1 rounded-full`}>
                    {language === 'zh' ? b.zh : b.en}
                  </span>
                  {r.status === 'awaiting_client' && r.token && (
                    <>
                      <button
                        onClick={() => copyLink(r.id, r.token!)}
                        title={t('Copy link', '复制链接')}
                        className="p-2 rounded-lg text-slate-400 hover:text-xin-blue hover:bg-slate-100 transition-colors"
                      >
                        {copiedId === r.id ? (
                          <Check size={15} className="text-emerald-500" />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>
                      <button
                        onClick={() => cancel(r.id)}
                        title={t('Cancel', '取消')}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <X size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
