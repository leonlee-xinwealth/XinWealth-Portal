import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';

type BroadcastTab = 'compose' | 'history';

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

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['compose', 'history'] as BroadcastTab[]).map(tb => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === tb
                ? 'bg-white text-xin-blue shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
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
  return <div className="text-slate-400 text-sm p-4">{t('Coming soon...', '即将上线...')}</div>;
}

function HistoryTab({ t, language }: { t: (en: string, zh: string) => string; language: string }) {
  return <div className="text-slate-400 text-sm p-4">{t('Coming soon...', '即将上线...')}</div>;
}
