import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth } from '../services/apiService';
import { Loader2, Shield, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { CnaLineItem, CnaMedicalItem, CnaProtectionSet, CnaResult, FinancialHealthData } from '../types';
import { useLanguage } from '../context/LanguageContext';

type TabType = 'overview' | 'policies';
type CategoryKey = keyof CnaProtectionSet;

// P5 (2026-09-26-cfp-p5-insurance-design.md 决策 1/4): this page no longer
// owns any gap formula (it used to hard-code 10x/3x/5x-income multiples and a
// flat RM1,000,000 medical target that never matched the advisor panel or the
// CFP report). It renders `insurance_gap` — the SAME computeCna() output the
// advisor's InsuranceGapPanel.tsx and both PDF exporters render — verbatim.

const CATEGORY_ROWS: Array<{ key: CategoryKey; en: string; zh: string; needBased: boolean }> = [
  { key: 'death', en: 'Death', zh: '身故', needBased: true },
  { key: 'tpd', en: 'TPD', zh: '全残（TPD）', needBased: true },
  { key: 'ci', en: 'Critical Illness', zh: '重大疾病', needBased: true },
  { key: 'ci_early_cover', en: 'Early-stage CI (cover only)', zh: '早期重疾（只显示保障）', needBased: false },
  { key: 'medical', en: 'Medical', zh: '医药', needBased: false },
  { key: 'pa', en: 'Personal Accident (cover only)', zh: '意外（只显示保障）', needBased: false },
];

const STATUS_LABELS: Record<string, [string, string]> = {
  in_force: ['In Force', '有效'],
  lapsed: ['Lapsed', '已失效'],
  paid_up: ['Paid-up', '已缴清'],
  surrendered: ['Surrendered', '已退保'],
  matured: ['Matured', '已满期'],
};
const STATUS_COLORS: Record<string, string> = {
  in_force: 'bg-emerald-50 text-emerald-700',
  lapsed: 'bg-red-50 text-red-600',
  paid_up: 'bg-blue-50 text-blue-700',
  surrendered: 'bg-slate-100 text-slate-500',
  matured: 'bg-slate-100 text-slate-500',
};

// Helpers for reading the { id, fields: {...} } shape api/health.js returns.
const extractValue = (item: any, fields: string[]): number => {
  if (!item || !item.fields) return 0;
  for (const field of fields) {
    if (item.fields[field] !== undefined && item.fields[field] !== null) {
      let val = item.fields[field];
      if (Array.isArray(val) && val.length > 0) {
        val = val[0];
        if (val && typeof val === 'object' && val.text) val = val.text;
      } else if (val && typeof val === 'object' && val !== null && val.text) {
        val = val.text;
      }
      if (typeof val === 'string') {
        val = parseFloat(val.replace(/RM/g, '').replace(/,/g, '').trim());
      }
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
  }
  return 0;
};

const extractString = (item: any, fields: string[], defaultValue: string = 'Unknown'): string => {
  if (!item || !item.fields) return defaultValue;
  for (const field of fields) {
    if (item.fields[field] !== undefined && item.fields[field] !== null) {
      let val = item.fields[field];
      if (Array.isArray(val) && val.length > 0) {
        if (val[0] && typeof val[0] === 'object' && val[0].text) return val[0].text;
        return String(val[0]);
      }
      if (val && typeof val === 'object' && val.text) return val.text;
      return String(val);
    }
  }
  return defaultValue;
};

const extractBool = (item: any, field: string): boolean => !!item?.fields?.[field];

const formatRM = (value: number) => {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const toneClasses: Record<string, string> = {
  good: 'text-emerald-600 bg-emerald-50',
  warn: 'text-amber-600 bg-amber-50',
  bad: 'text-red-500 bg-red-50',
  na: 'text-slate-400 bg-slate-50',
};

const Insurance: React.FC = () => {
  const { language } = useLanguage();
  const isZh = language === 'zh';
  const t = (en: string, zh: string) => (isZh ? zh : en);

  const [data, setData] = useState<FinancialHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [excludeGroup, setExcludeGroup] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const healthData = await fetchFinancialHealth();
        setData(healthData);
      } catch (err: any) {
        console.error("Insurance data load error:", err);
        setError(err.message || 'Failed to load insurance data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 animate-fade-in">
        <Loader2 className="w-10 h-10 text-xin-blue animate-spin" />
        <p className="text-xin-blue text-sm font-medium tracking-widest uppercase">{t('Loading Coverage...', '正在加载保障信息...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 animate-fade-in">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="text-red-500 w-10 h-10" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('Failed to load data', '加载失败')}</h3>
        <p className="text-slate-500 max-w-md">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const annualIncome = data.raw.annualIncome || 0;
  const insuranceRecords: any[] = data.raw.insurance || [];
  const gapResult: CnaResult | null = data.insuranceGap;
  const activeSet: CnaProtectionSet | null = gapResult ? (excludeGroup ? gapResult.excluding_group : gapResult) : null;

  // Protection score — same "how many need-based categories are fully
  // covered" idea the old banner used, now driven off the shared gap output
  // instead of a page-local requirements list.
  const needBasedRows = CATEGORY_ROWS.filter((r) => r.needBased);
  const sufficientCount = activeSet
    ? needBasedRows.filter((r) => {
        const item = activeSet[r.key] as CnaLineItem;
        return item.gap != null && item.gap <= 0;
      }).length
    : 0;
  const scorePct = needBasedRows.length > 0 ? Math.round((sufficientCount / needBasedRows.length) * 100) : 0;
  const scoreLabel = gapResult?.insufficient
    ? t('Add income', '待补充收入')
    : scorePct >= 80 ? t('Protected', '保障充足') : scorePct >= 50 ? t('Partial', '部分保障') : t('At Risk', '保障不足');
  const scoreColor = scorePct >= 80 ? '#10b981' : scorePct >= 50 ? '#f59e0b' : '#ef4444';
  const RING_R = 30;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const ringDash = (scorePct / 100) * RING_CIRC;

  // Parse policies for the list — Sum Assured/Premium stay for backward
  // compatibility; Status/Is Group Employer/Cash Value are P5's additions.
  const policies = insuranceRecords.map((record, idx) => ({
    id: record.id || record.record_id || `policy-${idx}`,
    insurer: extractString(record, ['Insurer', 'insurer', 'Company', 'company']),
    planName: extractString(record, ['Plan Name', 'plan name', 'Plan', 'plan', 'Policy Name', 'policy name']),
    policyNumber: extractString(record, ['Policy Number', 'policy number', 'Policy No', 'policy no']),
    premium: extractValue(record, ['Premium', 'premium']),
    sumAssured: extractValue(record, ['Sum Assured', 'sum assured']),
    status: extractString(record, ['Status'], 'in_force'),
    isGroupEmployer: extractBool(record, 'Is Group Employer'),
    cashValue: record.fields?.['Cash Value'] ?? null,
    rawRecord: record,
  })).filter(p => p.planName !== 'Unknown' || p.policyNumber !== 'Unknown');

  const INSURER_PALETTE = ['#c2410c', '#b91c1c', '#1d4ed8', '#166534', '#7e22ce', '#0369a1', '#b45309', '#0f766e'];

  const policyGroups = (() => {
    const map = new Map<string, { color: string; policies: typeof policies }>();
    let colorIdx = 0;
    policies.forEach(p => {
      if (!map.has(p.insurer)) {
        map.set(p.insurer, { color: INSURER_PALETTE[colorIdx % INSURER_PALETTE.length], policies: [] });
        colorIdx++;
      }
      map.get(p.insurer)!.policies.push(p);
    });
    return Array.from(map.entries()).map(([insurer, val]) => ({ insurer, ...val }));
  })();

  const renderGapRow = (row: typeof CATEGORY_ROWS[number]) => {
    if (!activeSet) return null;
    const item = activeSet[row.key];
    const isInsufficient = row.needBased && gapResult?.insufficient;
    const need = item.need;
    const gap = item.gap;
    const tone: 'good' | 'warn' | 'bad' | 'na' = (() => {
      if (row.key === 'medical') {
        const m = item as CnaMedicalItem;
        if (!m.has_cover) return 'bad';
        if (m.low_limit) return 'warn';
        if (m.limit_unknown) return 'warn';
        return 'good';
      }
      if (!row.needBased || isInsufficient || need == null) return 'na';
      return (gap ?? 0) > 0 ? 'bad' : 'good';
    })();
    const ToneIcon = tone === 'good' ? CheckCircle2 : tone === 'bad' ? XCircle : null;

    return (
      <div key={row.key} className="px-5 py-4 border-t border-slate-50 first:border-t-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {ToneIcon ? <ToneIcon size={16} className={tone === 'good' ? 'text-emerald-500' : 'text-red-500'} /> : <span className="w-4" />}
            <span className="font-bold text-xin-blue">{t(row.en, row.zh)}</span>
          </div>
          <div className={`text-xs font-bold px-2 py-1 rounded-full ${toneClasses[tone]}`}>
            {row.key === 'medical'
              ? (item as CnaMedicalItem).has_cover
                ? `${t('Has cover', '已投保')}${(item as CnaMedicalItem).annual_limit > 0 ? ` · RM ${formatRM((item as CnaMedicalItem).annual_limit)}/${t('yr', '年')}` : ''}${(item as CnaMedicalItem).low_limit ? ` · ${t('Low limit', '限额偏低')}` : ''}${(item as CnaMedicalItem).limit_unknown ? ` · ${t('Limit unrecorded', '未记录')}` : ''}`
                : t('No cover', '未投保')
              : (!row.needBased || isInsufficient || need == null)
                ? `RM ${formatRM(item.cover)} ${t('cover', '保障')}`
                : `${t('Gap', '缺口')} RM ${formatRM(gap ?? 0)}`}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-slate-400 uppercase tracking-wider font-semibold mb-0.5">{t('Need', '需求')}</p>
            <p className="font-bold text-slate-700">{row.needBased && !isInsufficient && need != null ? `RM ${formatRM(need)}` : '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 uppercase tracking-wider font-semibold mb-0.5">{t('Cover', '现有保障')}</p>
            <p className="font-bold text-slate-700">
              {row.key === 'medical' ? ((item as CnaMedicalItem).has_cover ? `RM ${formatRM((item as CnaMedicalItem).annual_limit)}` : t('None', '无')) : `RM ${formatRM(item.cover)}`}
            </p>
          </div>
          <div>
            <p className="text-slate-400 uppercase tracking-wider font-semibold mb-0.5">{t('Gap', '缺口')}</p>
            <p className={`font-bold ${(gap ?? 0) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {row.needBased && !isInsufficient && gap != null ? `RM ${formatRM(gap)}` : '—'}
            </p>
          </div>
        </div>
        {item.notes.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {item.notes.map((n, i) => (
              <p key={i} className="text-[11px] text-slate-400">{n}</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in-up pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-xin-blue tracking-tight font-serif flex items-center gap-3">
            <Shield className="text-xin-gold w-8 h-8" />
            {t('Insurance Protection', '保险保障')}
          </h1>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            {t('Coverage need vs what you actually hold, from the same calculation your advisor sees.', '保障需求与实际持有保障的对比，与顾问端使用同一套计算。')}
          </p>
        </div>
        <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-end">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{t('Annual Income', '年收入')}</p>
          <p className="text-2xl font-bold text-xin-blue">{formatRM(annualIncome)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-100/80 backdrop-blur-sm p-1 rounded-full inline-flex border border-slate-200/50 shadow-inner">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-8 py-3 rounded-full text-sm font-bold tracking-widest uppercase transition-all duration-300 ${
              activeTab === 'overview'
                ? 'bg-white text-xin-blue shadow-md shadow-slate-200/50 scale-100'
                : 'text-slate-500 hover:text-xin-blue hover:bg-white/50 scale-95'
            }`}
          >
            {t('Overview', '总览')}
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-8 py-3 rounded-full text-sm font-bold tracking-widest uppercase transition-all duration-300 ${
              activeTab === 'policies'
                ? 'bg-white text-xin-blue shadow-md shadow-slate-200/50 scale-100'
                : 'text-slate-500 hover:text-xin-blue hover:bg-white/50 scale-95'
            }`}
          >
            {t('Policies', '保单')}
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-4 animate-fade-in">
          {/* Score Banner */}
          <div
            className="rounded-3xl p-5 flex items-center gap-5"
            style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #1e4a8a 100%)' }}
          >
            <div className="flex-shrink-0">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r={RING_R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
                <circle
                  cx="36" cy="36" r={RING_R}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${ringDash} ${RING_CIRC - ringDash}`}
                  transform="rotate(-90 36 36)"
                />
                <text x="36" y="41" textAnchor="middle" fill="white" fontSize="14" fontWeight="800">
                  {scorePct}%
                </text>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">{t('Protection Score', '保障评分')}</p>
              <p className="text-2xl font-extrabold text-white mb-2">{scoreLabel}</p>
              <label className="flex items-center gap-1.5 text-xs text-white/70 select-none cursor-pointer">
                <input type="checkbox" checked={excludeGroup} onChange={(e) => setExcludeGroup(e.target.checked)} className="rounded border-white/40" />
                {t('Exclude group cover', '不含团保')}
              </label>
            </div>
          </div>

          {gapResult?.assumptions?.length ? (
            <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('Assumptions', '计算假设')}</p>
              <ul className="space-y-0.5">
                {gapResult.assumptions.map((a, i) => (
                  <li key={i} className="text-[11px] text-slate-400">{a}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Category rows */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {CATEGORY_ROWS.map(renderGapRow)}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-xin-blue">{t('Your Policies', '我的保单')}</h3>
            <span className="bg-xin-blue/10 text-xin-blue px-3 py-1 rounded-full text-xs font-bold">
              {policies.length} {t('Policies', '份保单')}
            </span>
          </div>

          {policies.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
              <p className="text-slate-500 font-medium">{t('No policies found', '暂无保单记录')}</p>
            </div>
          ) : (
            <>
              {/* Grouped by insurer */}
              {policyGroups.map(group => (
                <div key={group.insurer}>
                  {/* Insurer header row */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: group.color }} />
                    <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: group.color }}>
                      {group.insurer}
                    </span>
                    <span className="text-xs text-slate-400">
                      {group.policies.length} {group.policies.length === 1 ? t('policy', '份') : t('policies', '份')}
                    </span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  {/* Policy cards grid */}
                  <div className={`grid gap-3 ${group.policies.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {group.policies.map(policy => {
                      const statusLabel = STATUS_LABELS[policy.status] || STATUS_LABELS.in_force;
                      const statusColor = STATUS_COLORS[policy.status] || STATUS_COLORS.in_force;
                      return (
                        <div
                          key={policy.id}
                          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
                          style={{ borderLeft: `3px solid ${group.color}` }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p className="text-sm font-bold text-slate-800 leading-tight">{policy.planName}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>
                              {isZh ? statusLabel[1] : statusLabel[0]}
                            </span>
                          </div>
                          <p className="font-mono text-xs text-slate-400 mb-3">{policy.policyNumber}</p>

                          <div className="flex flex-wrap gap-1 mb-3">
                            {policy.isGroupEmployer && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                                {t('Group · lapses at exit', '团保 · 离职即失效')}
                              </span>
                            )}
                          </div>

                          <div className="border-t border-slate-50 pt-3 flex items-end justify-between gap-3">
                            <div>
                              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-0.5">{t('Sum Assured', '保额')}</p>
                              <p className="text-sm font-bold text-slate-700">{formatRM(policy.sumAssured)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-0.5">{t('Premium', '保费')}</p>
                              <p className="text-base font-extrabold" style={{ color: group.color }}>{formatRM(policy.premium)}</p>
                              <p className="text-xs text-slate-400">{t('per year', '每年')}</p>
                            </div>
                          </div>
                          {policy.cashValue != null && Number(policy.cashValue) > 0 && (
                            <p className="text-[11px] text-slate-400 mt-2">
                              {t('Cash value', '现金价值')}: {formatRM(Number(policy.cashValue))} · {t('reference only — not counted in net worth', '仅供参考 · 未计入净资产')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Insurance;
