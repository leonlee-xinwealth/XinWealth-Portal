// components/prs/PrsPublicPage.tsx
// Public client-facing PRS application form, accessed via a token link.
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import PrsForm from '../advisor/prs/PrsForm';
import { initialPrsFormData, type PrsFormData } from '../../types/prs';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'invalid' | 'expired' | 'error';

export default function PrsPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { language, setLanguage } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<PrsFormData>(initialPrsFormData);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch(`/api/prs-application?token=${token}`)
      .then(async res => {
        if (res.ok) {
          const body = await res.json();
          setData({ ...initialPrsFormData, ...(body.form_data ?? {}) });
          setState('ready');
        } else if (res.status === 410) {
          setState('expired');
        } else {
          setState('invalid');
        }
      })
      .catch(() => setState('error'));
  }, [token]);

  async function submit() {
    if (!data.full_name.trim()) {
      setSubmitError(t('Please fill in your full name.', '请填写您的全名。'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setState('submitting');
    setSubmitError('');
    try {
      const res = await fetch('/api/prs-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, form_data: data }),
      });
      if (res.ok) {
        setState('success');
        window.scrollTo({ top: 0 });
      } else {
        const body = await res.json().catch(() => ({}));
        setSubmitError(
          (body as { error?: string }).error ||
            t('Submission failed, please try again.', '提交失败，请重试。')
        );
        setState('ready');
      }
    } catch {
      setSubmitError(t('Network error, please try again.', '网络错误，请重试。'));
      setState('ready');
    }
  }

  // ── Header (logo + language toggle) ────────────────────────────────────────
  const Header = (
    <header className="bg-white shadow-sm border-b border-gray-100 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-xin-blue to-xin-blueLight rounded-xl flex items-center justify-center shadow-sm border border-xin-blueLight/30">
          <span className="text-xin-gold font-bold font-serif text-lg tracking-wider">X</span>
        </div>
        <div className="flex flex-col">
          <span className="font-serif font-bold text-xin-blue leading-none text-xl tracking-tight">
            Xin<span className="text-xin-gold">Wealth</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-400 hidden sm:block">
          {t('PRS Account Opening', 'PRS 开户申请')}
        </span>
        {/* Language Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              language === 'en' ? 'bg-white text-xin-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('zh')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              language === 'zh' ? 'bg-white text-xin-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            中文
          </button>
        </div>
      </div>
    </header>
  );

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#f4f7f9] flex flex-col">
        {Header}
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-xin-blue animate-spin" />
        </div>
      </div>
    );
  }

  // ── Invalid / Error ─────────────────────────────────────────────────────────
  if (state === 'invalid' || state === 'error') {
    return (
      <div className="min-h-screen bg-[#f4f7f9] flex flex-col">
        {Header}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
            <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {t('Invalid Link', '无效链接')}
            </h2>
            <p className="text-sm text-gray-500">
              {t(
                'This link is not valid. Please contact your advisor for a new link.',
                '此链接无效，请联系您的理财顾问以获取新的链接。'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Expired ─────────────────────────────────────────────────────────────────
  if (state === 'expired') {
    return (
      <div className="min-h-screen bg-[#f4f7f9] flex flex-col">
        {Header}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
            <AlertCircle className="w-14 h-14 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {t('Link Expired', '链接已过期')}
            </h2>
            <p className="text-sm text-gray-500">
              {t(
                'This link has expired. Please contact your advisor for a new link.',
                '此链接已过期，请联系您的理财顾问以获取新的链接。'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-[#f4f7f9] flex flex-col">
        {Header}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {t('Submitted!', '已提交！')}
            </h2>
            <p className="text-sm text-gray-500">
              {t(
                'Thank you. Your advisor will follow up on the next steps.',
                '感谢您的填写，您的理财顾问将跟进后续步骤。'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Ready / Submitting ──────────────────────────────────────────────────────
  const isSubmitting = state === 'submitting';

  return (
    <div className="min-h-screen bg-[#f4f7f9] font-sans selection:bg-xin-gold selection:text-white pb-28">
      {Header}

      <main className="max-w-3xl mx-auto pt-6 px-4 md:px-6">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6 text-sm text-blue-700">
          {t(
            'Please complete this form at your earliest convenience. Your information is securely transmitted to your advisor.',
            '请尽快完成此表格。您的资料将安全地传送给您的理财顾问。'
          )}
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* PRS Form */}
        <PrsForm
          data={data}
          onChange={patch => setData(prev => ({ ...prev, ...patch }))}
          mode="client"
          language={language}
        />
      </main>

      {/* Sticky submit button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={submit}
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-xin-blue text-white font-bold text-base tracking-wide hover:bg-xin-blueLight transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting
              ? t('Submitting…', '提交中…')
              : t('Submit Application', '提交申请')}
          </button>
        </div>
      </div>
    </div>
  );
}
