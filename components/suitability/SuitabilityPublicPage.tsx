// components/suitability/SuitabilityPublicPage.tsx
// Public Investor Suitability Assessment, accessed via a one-time token link the
// advisor sends before the first in-person meeting.
//
// The success screen deliberately shows ONLY the profile name and its
// description. Return ranges, dimension scores, the expectation gap, red flags
// and the suggested allocation are advisor-facing — they reach the client
// through the adviser, in the meeting, with context.
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import QuizRunner from './QuizRunner';
import type { SuitabilityAnswers } from '../../lib/suitability/types';

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'invalid' | 'expired' | 'error';

interface SimpleResult {
  profile: string;
  name: { en: string; zh: string };
  description: { en: string; zh: string };
}

export default function SuitabilityPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { language, setLanguage } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  const [state, setState] = useState<PageState>('loading');
  const [prospectName, setProspectName] = useState<string | null>(null);
  const [result, setResult] = useState<SimpleResult | null>(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch(`/api/suitability?token=${token}`)
      .then(async (res) => {
        if (res.ok) {
          const body = await res.json();
          setProspectName(body.prospectName ?? null);
          if (body.locale === 'zh' || body.locale === 'en') setLanguage(body.locale);
          setState('ready');
        } else if (res.status === 410) {
          setState('expired');
        } else {
          setState('invalid');
        }
      })
      .catch(() => setState('error'));
    // setLanguage is stable from context; token is the only real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submit(answers: SuitabilityAnswers) {
    setState('submitting');
    setSubmitError('');
    try {
      const res = await fetch('/api/suitability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', token, answers, locale: language }),
      });
      if (res.ok) {
        setResult(await res.json());
        setState('success');
        window.scrollTo({ top: 0 });
        return;
      }
      if (res.status === 410 || res.status === 404) {
        setState('expired');
        return;
      }
      const body = await res.json().catch(() => ({}));
      setSubmitError(
        (body as { error?: string }).error === 'INVALID_ANSWERS'
          ? t('Some answers were missing. Please try again.', '有题目尚未作答，请重试。')
          : t('Submission failed, please try again.', '提交失败，请重试。'),
      );
      setState('ready');
    } catch {
      setSubmitError(t('Network error, please try again.', '网络错误，请重试。'));
      setState('ready');
    }
  }

  // ── Header ────────────────────────────────────────────────────────────────
  const Header = (
    <header className="bg-white shadow-sm border-b border-gray-100 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-xin-blue to-xin-blueLight rounded-xl flex items-center justify-center shadow-sm border border-xin-blueLight/30">
          <span className="text-xin-gold font-bold font-serif text-lg tracking-wider">X</span>
        </div>
        <span className="font-serif font-bold text-xin-blue leading-none text-xl tracking-tight">
          Xin<span className="text-xin-gold">Wealth</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-400 hidden sm:block">
          {t('Investor Suitability Assessment', '投资适当性评估')}
        </span>
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

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#f4f7f9] flex flex-col">
      {Header}
      <div className="flex-1 flex items-start justify-center">{children}</div>
    </div>
  );

  const Notice = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="inline-flex mb-4">{icon}</div>
      <h1 className="font-serif text-2xl text-xin-blue mb-2">{title}</h1>
      <p className="text-gray-500 leading-relaxed">{body}</p>
    </div>
  );

  if (state === 'loading') {
    return (
      <Shell>
        <div className="py-32">
          <Loader2 className="w-10 h-10 text-xin-blue animate-spin" />
        </div>
      </Shell>
    );
  }

  if (state === 'invalid' || state === 'error') {
    return (
      <Shell>
        <Notice
          icon={<AlertCircle className="w-12 h-12 text-red-400" />}
          title={t('Link not valid', '链接无效')}
          body={t(
            'This assessment link could not be found. Please check with your financial planner for a new one.',
            '找不到这个评估链接。请联系你的理财规划师重新发送。',
          )}
        />
      </Shell>
    );
  }

  if (state === 'expired') {
    return (
      <Shell>
        <Notice
          icon={<AlertCircle className="w-12 h-12 text-amber-400" />}
          title={t('Link no longer active', '链接已失效')}
          body={t(
            'This assessment has already been completed or the link has expired. Please contact your financial planner if you need to complete it again.',
            '这份评估已经完成，或链接已过期。如需重新填写，请联系你的理财规划师。',
          )}
        />
      </Shell>
    );
  }

  if (state === 'success' && result) {
    return (
      <Shell>
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex mb-5">
            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
          </div>
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-xin-gold mb-3">
            {t('Your investor profile', '你的投资者类型')}
          </p>
          <h1 className="font-serif text-3xl md:text-4xl text-xin-blue mb-6">
            {language === 'zh' ? result.name.zh : result.name.en}
          </h1>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 text-left">
            <p className="text-[15px] leading-loose text-gray-700">
              {language === 'zh' ? result.description.zh : result.description.en}
            </p>
          </div>
          <p className="mt-8 text-sm text-gray-500 leading-relaxed">
            {t(
              'Thank you. Your financial planner will review your full results and walk you through them at your meeting.',
              '感谢你的填写。你的理财规划师会审阅完整结果，并在会面时与你详细讲解。',
            )}
          </p>
        </div>
      </Shell>
    );
  }

  // ── ready / submitting ────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="w-full">
        {prospectName && (
          <p className="max-w-2xl mx-auto px-5 pt-8 -mb-4 text-sm text-gray-500">
            {t('Prepared for', '致')} <span className="font-semibold text-xin-blue">{prospectName}</span>
          </p>
        )}
        <QuizRunner
          language={language === 'zh' ? 'zh' : 'en'}
          submitting={state === 'submitting'}
          error={submitError}
          onSubmit={submit}
        />
      </div>
    </Shell>
  );
}
