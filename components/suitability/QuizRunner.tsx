// One-question-per-screen runner for the Investor Suitability Assessment.
// Single-select auto-advances; the one multi-select question needs an explicit
// Continue so the client can tick several products (including none at all).
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { SUITABILITY_QUESTIONS } from '../../lib/suitability/questions';
import type { SuitabilityAnswers } from '../../lib/suitability/types';

const LETTERS = 'ABCDEFGHIJ';

interface Props {
  language: 'en' | 'zh';
  submitting: boolean;
  error: string;
  onSubmit: (answers: SuitabilityAnswers) => void;
}

export default function QuizRunner({ language, submitting, error, onSubmit }: Props) {
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<SuitabilityAnswers>({ investment_products: [] });

  const total = SUITABILITY_QUESTIONS.length;
  const q = SUITABILITY_QUESTIONS[step];
  const isLast = step === total - 1;

  const selected = answers[q.id];
  const multiSelected = useMemo(
    () => (Array.isArray(selected) ? selected : []),
    [selected],
  );

  function commit(next: SuitabilityAnswers) {
    setAnswers(next);
    if (isLast) onSubmit(next);
    else setStep((s) => s + 1);
  }

  function pickSingle(value: string) {
    if (submitting) return;
    commit({ ...answers, [q.id]: value });
  }

  function toggleMulti(value: string) {
    if (submitting) return;
    const has = multiSelected.includes(value);
    setAnswers({
      ...answers,
      [q.id]: has ? multiSelected.filter((v) => v !== value) : [...multiSelected, value],
    });
  }

  const progress = Math.round(((step + (submitting ? 1 : 0)) / total) * 100);

  return (
    <div className="w-full max-w-2xl mx-auto px-5 py-8">
      {/* progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-xin-blue disabled:opacity-0 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('Back', '上一题')}
          </button>
          <span className="text-xs font-medium text-gray-400 tabular-nums">
            {step + 1} / {total}
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-xin-gold rounded-full transition-all duration-300"
            style={{ width: `${Math.max(progress, 4)}%` }}
          />
        </div>
      </div>

      {/* question */}
      <h2 className="font-serif text-2xl md:text-3xl text-xin-blue leading-snug mb-2">
        {language === 'zh' ? q.titleZh : q.titleEn}
      </h2>
      {(q.helpEn || q.helpZh) && (
        <p className="text-sm text-gray-500 mb-6">{language === 'zh' ? q.helpZh : q.helpEn}</p>
      )}
      {!q.helpEn && !q.helpZh && <div className="mb-6" />}

      {/* options */}
      <div className="space-y-3">
        {q.options.map((o, i) => {
          const active =
            q.control === 'multi' ? multiSelected.includes(o.value) : selected === o.value;
          return (
            <button
              key={o.value}
              onClick={() => (q.control === 'multi' ? toggleMulti(o.value) : pickSingle(o.value))}
              disabled={submitting}
              className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-all disabled:opacity-60 ${
                active
                  ? 'border-xin-blue bg-xin-blue/5 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-xin-gold hover:bg-xin-gold/5'
              }`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-xs font-bold transition-colors ${
                  active ? 'bg-xin-blue text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {active && q.control === 'multi' ? <Check className="w-4 h-4" /> : LETTERS[i]}
              </span>
              <span className="text-[15px] leading-relaxed text-gray-800 pt-0.5">
                {language === 'zh' ? o.zh : o.en}
              </span>
            </button>
          );
        })}
      </div>

      {/* multi-select needs an explicit continue; none-selected is a valid answer */}
      {q.control === 'multi' && (
        <button
          onClick={() => commit({ ...answers, [q.id]: multiSelected })}
          disabled={submitting}
          className="mt-6 w-full py-3.5 rounded-xl bg-xin-blue text-white font-semibold hover:bg-xin-blueLight transition-colors disabled:opacity-60"
        >
          {multiSelected.length === 0
            ? t('None of these', '以上都没有')
            : t('Continue', '继续')}
        </button>
      )}

      {submitting && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('Submitting your answers…', '正在提交你的答案…')}
        </div>
      )}

      {error && (
        <p className="mt-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
          {error}
        </p>
      )}
    </div>
  );
}
