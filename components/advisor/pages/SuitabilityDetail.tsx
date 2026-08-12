// components/advisor/pages/SuitabilityDetail.tsx
// The advisor's full view of a submitted assessment: every answer, the three
// dimension scores that produced the profile, behaviour confidence, the
// expectation gap, red flags, and the suggested strategic allocation.
//
// This is the "you already know how to talk to them" screen. Everything here is
// advisor-facing — the client only ever saw their profile name and description.
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { AlertTriangle, ArrowLeft, Check, Download, RefreshCw, Send } from 'lucide-react';
import { QUESTION_BY_ID, SUITABILITY_QUESTIONS, optionOf } from '../../../lib/suitability/questions';
import { formatReturnRange } from '../../../lib/suitability/rules';
import type { ConfigSnapshot, QuestionId, RedFlag } from '../../../lib/suitability/types';

const BAND_LABEL: Record<number, { en: string; zh: string }> = {
  1: { en: 'Stable', zh: '稳健型' },
  2: { en: 'Balanced', zh: '平衡型' },
  3: { en: 'Growth', zh: '成长型' },
  4: { en: 'Aggressive Growth', zh: '积极成长型' },
};

const CONFIDENCE_CLS: Record<string, string> = {
  LOW: 'bg-rose-50 text-rose-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-emerald-50 text-emerald-700',
};

const GAP_CLS: Record<string, string> = {
  ALIGNED: 'bg-emerald-50 text-emerald-700',
  MODERATE_GAP: 'bg-amber-50 text-amber-700',
  SIGNIFICANT_GAP: 'bg-rose-50 text-rose-700',
};

const GAP_LABEL: Record<string, { en: string; zh: string }> = {
  ALIGNED: { en: 'Aligned', zh: '一致' },
  MODERATE_GAP: { en: 'Moderate gap', zh: '中度落差' },
  SIGNIFICANT_GAP: { en: 'Significant gap', zh: '显著落差' },
};

const PRODUCT_LEVEL_LABEL: Record<string, { en: string; zh: string }> = {
  NONE: { en: 'None', zh: '无' },
  BASIC: { en: 'Basic', zh: '基础' },
  INTERMEDIATE: { en: 'Intermediate', zh: '中级' },
  ADVANCED: { en: 'Advanced', zh: '进阶' },
};

const YEARS_LABEL: Record<number, { en: string; zh: string }> = {
  0: { en: 'No experience', zh: '没有经验' },
  1: { en: '<3 years', zh: '少于3年' },
  2: { en: '3–5 years', zh: '3–5年' },
  3: { en: '5–10 years', zh: '5–10年' },
  4: { en: '10+ years', zh: '10年以上' },
};

export default function SuitabilityDetail() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);
  const navigate = useNavigate();

  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const { data } = await supabase
      .from('suitability_assessments')
      .select('*, suitability_results(*)')
      .eq('id', id)
      .maybeSingle();
    setRow(data);
    setLoading(false);
  }

  async function callApi(action: string, extra: Record<string, unknown> = {}) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await fetch('/api/suitability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...extra }),
    });
    return { ok: res.ok, body: await res.json().catch(() => ({})) };
  }

  async function download() {
    setBusy('download');
    setNote('');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const res = await fetch(`/api/suitability?action=download&id=${result.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) window.open(body.url, '_blank');
      else setNote(t('The PDF is not available yet.', 'PDF 尚未生成。'));
    }
    setBusy('');
  }

  async function redeliver() {
    setBusy('redeliver');
    setNote('');
    const r = await callApi('redeliver', { id: result.id });
    setNote(
      r?.ok
        ? t('Sent to Telegram.', '已发送到 Telegram。')
        : t('Delivery failed. Check the Telegram settings.', '投递失败，请检查 Telegram 设置。'),
    );
    await load();
    setBusy('');
  }

  async function markReviewed() {
    setBusy('review');
    await supabase.from('suitability_assessments').update({ status: 'reviewed' }).eq('id', id);
    await load();
    setBusy('');
  }

  if (loading) {
    return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue mx-auto mt-16" />;
  }
  if (!row) {
    return <p className="text-slate-400 text-sm">{t('Not found.', '找不到记录。')}</p>;
  }

  const result = row.suitability_results?.[0];
  if (!result) {
    return (
      <div>
        <BackLink />
        <p className="text-slate-400 text-sm mt-6">
          {t('This assessment has not been submitted yet.', '这份评估尚未提交。')}
        </p>
      </div>
    );
  }

  const cs: ConfigSnapshot = result.config_snapshot ?? {};
  const flags: RedFlag[] = result.red_flags ?? [];
  const answers = row.answers ?? {};

  function BackLink() {
    return (
      <button
        onClick={() => navigate('/advisor/suitability')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-xin-blue transition-colors"
      >
        <ArrowLeft size={15} /> {t('All assessments', '返回列表')}
      </button>
    );
  }

  const Stat = ({
    label,
    value,
    sub,
    cls,
  }: {
    label: string;
    value: string;
    sub?: string;
    cls?: string;
  }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1.5 text-lg font-semibold ${cls ?? 'text-xin-blue'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <BackLink />
          <h1 className="font-serif text-2xl font-bold text-xin-blue mt-2">
            {row.prospect_name || t('(Unnamed prospect)', '（未命名）')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('Submitted', '提交于')}{' '}
            {new Date(row.submitted_at ?? row.created_at).toLocaleString(
              language === 'zh' ? 'zh-MY' : 'en-MY',
            )}{' '}
            · {t('Rules', '规则版本')} v{result.rule_version}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={download}
            disabled={busy !== ''}
            className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl border border-slate-200 text-xin-blue hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            <Download size={15} /> {t('PDF', 'PDF')}
          </button>
          <button
            onClick={redeliver}
            disabled={busy !== ''}
            className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl border border-slate-200 text-xin-blue hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            {busy === 'redeliver' ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
            {t('Resend', '重新发送')}
          </button>
          {row.status !== 'reviewed' && (
            <button
              onClick={markReviewed}
              disabled={busy !== ''}
              className="flex items-center gap-1.5 bg-xin-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-60"
            >
              <Check size={15} /> {t('Mark reviewed', '标记已审阅')}
            </button>
          )}
        </div>
      </div>

      {note && (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3">
          {note}
        </p>
      )}

      {result.delivery_status === 'failed' && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3">
          {t('PDF delivery to Telegram failed.', 'PDF 投递到 Telegram 失败。')}{' '}
          {result.delivery_error}
        </p>
      )}

      {/* headline */}
      <div className="bg-gradient-to-br from-xin-blue to-xin-blueLight rounded-2xl p-6 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-xin-goldLight">
          {t('Final profile', '最终风险档位')}
        </p>
        <div className="flex items-baseline gap-3 flex-wrap mt-1">
          <h2 className="font-serif text-3xl">
            {language === 'zh' ? cs.profileNameZh : cs.profileNameEn}
          </h2>
          {result.requires_advisor_review && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-400 text-amber-950 px-2.5 py-1 rounded-full">
              <AlertTriangle size={12} /> {t('Review required', '需人工审阅')}
            </span>
          )}
        </div>
        <p className="text-sm text-white/70 mt-3">
          {t('Bound by', '受限于')}{' '}
          <span className="font-semibold text-white">
            {(() => {
              const mins: string[] = [];
              if (result.capacity_band === result.final_band) mins.push(t('capacity', '承受能力'));
              if (result.tolerance_band === result.final_band) mins.push(t('tolerance', '承受意愿'));
              if (result.horizon_ceiling_band === result.final_band)
                mins.push(t('time horizon', '投资期限'));
              return mins.join(t(' + ', ' + '));
            })()}
          </span>
        </p>
      </div>

      {/* the three dimensions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label={t('Risk capacity', '风险承受能力')}
          value={`${result.capacity_score}/9`}
          sub={
            language === 'zh'
              ? BAND_LABEL[result.capacity_band].zh
              : BAND_LABEL[result.capacity_band].en
          }
        />
        <Stat
          label={t('Risk tolerance', '风险承受意愿')}
          value={`${result.tolerance_score}/9`}
          sub={
            language === 'zh'
              ? BAND_LABEL[result.tolerance_band].zh
              : BAND_LABEL[result.tolerance_band].en
          }
        />
        <Stat
          label={t('Time horizon ceiling', '投资期限上限')}
          value={
            language === 'zh'
              ? BAND_LABEL[result.horizon_ceiling_band].zh
              : BAND_LABEL[result.horizon_ceiling_band].en
          }
          sub={language === 'zh' ? cs.horizonZh : cs.horizonEn}
        />
        <Stat
          label={t('Experience', '投资经验')}
          value={
            language === 'zh'
              ? YEARS_LABEL[result.experience_years_band].zh
              : YEARS_LABEL[result.experience_years_band].en
          }
          sub={`${t('Products', '产品层级')}: ${
            language === 'zh'
              ? PRODUCT_LEVEL_LABEL[result.product_level].zh
              : PRODUCT_LEVEL_LABEL[result.product_level].en
          }`}
        />
      </div>

      {/* expectation + confidence */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
            {t('Return expectation', '回报期望')}
          </p>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-500">{language === 'zh' ? cs.returnLabelZh : cs.returnLabelEn}</span>
            <span className="font-semibold text-xin-blue">
              {cs.returnRange ? formatReturnRange(cs.returnRange) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">{t('Client target', '客户目标')}</span>
            <span className="font-semibold text-xin-blue">
              {result.target_return_pct ? `~${result.target_return_pct}% p.a.` : '—'}
            </span>
          </div>
          <span
            className={`${
              GAP_CLS[result.expectation_gap]
            } inline-block mt-3 text-xs font-semibold px-2.5 py-1 rounded-full`}
          >
            {language === 'zh'
              ? GAP_LABEL[result.expectation_gap].zh
              : GAP_LABEL[result.expectation_gap].en}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
            {t('Behaviour confidence', '行为可信度')}
          </p>
          <span
            className={`${
              CONFIDENCE_CLS[result.behaviour_confidence]
            } inline-block text-sm font-semibold px-3 py-1.5 rounded-full`}
          >
            {result.behaviour_confidence}
          </span>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            {t(
              'How much weight to put on their stated risk appetite, based on experience and how they behaved in a real decline.',
              '根据投资经验以及在真实下跌中的实际反应，判断其自述风险偏好的可信程度。',
            )}
          </p>
        </div>
      </div>

      {/* red flags */}
      {flags.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
            {t('Red flags', '风险提示')}
          </p>
          <div className="space-y-2.5">
            {flags.map((f) => (
              <div key={f.code} className="flex items-start gap-2.5">
                <span
                  className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                    f.severity === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {f.severity}
                </span>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {language === 'zh' ? f.messageZh : f.messageEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* allocation */}
      {cs.allocation && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-4">
            {t('Suggested strategic allocation', '建议策略性资产配置')}
          </p>
          <div className="space-y-3">
            {(
              [
                ['defensive', t('Defensive', '防御型')],
                ['growth', t('Growth', '成长型')],
                ['diversifier', t('Diversifier', '分散型')],
              ] as const
            ).map(([key, label]) => {
              const r = (cs.allocation as any)[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-semibold text-xin-blue tabular-nums">
                      {r.min}–{r.max}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-xin-gold rounded-full"
                      style={{ marginLeft: `${r.min}%`, width: `${Math.max(r.max - r.min, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {cs.allocation.capApplied && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 mt-4">
              {t(
                `Growth capped at ${cs.allocation.equityCapPct}% by the client's time horizon.`,
                `受投资期限限制，成长型资产上限已调整为 ${cs.allocation.equityCapPct}%。`,
              )}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
            {t(
              'Strategic ranges only — not a product recommendation. Return ranges are historical long-term references, not guarantees or forecasts.',
              '仅为策略性配置区间，非产品建议。回报区间为历史长期参考，并非保证或预测。',
            )}
          </p>
        </div>
      )}

      {/* every answer */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 p-5 pb-3">
          {t('All answers', '全部作答')}
        </p>
        {SUITABILITY_QUESTIONS.map((q) => {
          const a = answers[q.id as QuestionId];
          const text = Array.isArray(a)
            ? a
                .map((v) => {
                  const o = optionOf(q.id, v);
                  return o ? (language === 'zh' ? o.zh : o.en) : v;
                })
                .join(language === 'zh' ? '、' : ', ') || t('None', '无')
            : (() => {
                const o = a ? optionOf(q.id, a as string) : undefined;
                return o ? (language === 'zh' ? o.zh : o.en) : '—';
              })();
          return (
            <div key={q.id} className="px-5 py-3">
              <p className="text-xs text-slate-400 mb-0.5">
                {q.order}. {language === 'zh' ? QUESTION_BY_ID[q.id].titleZh : QUESTION_BY_ID[q.id].titleEn}
              </p>
              <p className="text-sm text-slate-800">{text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
