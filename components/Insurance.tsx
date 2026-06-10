import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth } from '../services/apiService';
import { Loader2, Shield, AlertTriangle } from 'lucide-react';
import { FinancialHealthData } from '../types';

type TabType = 'overview' | 'policies';

// Helpers
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

const formatRM = (value: number) => {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// 颜色阈值（Overview 横幅 + 拨盘共用）
const getCoverageColor = (pct: number): string => {
  if (pct >= 100) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
};

// 整体保障评分（充足类别数 / 总类别数 * 100）
const getBannerScore = (reqs: Array<{ current: number; required: number }>) => {
  const total = reqs.length;
  const sufficient = reqs.filter(r => r.current >= r.required).length;
  const atRisk = reqs.filter(r => {
    const pct = r.required > 0 ? r.current / r.required : 1;
    return pct >= 0.5 && pct < 1;
  }).length;
  const critical = reqs.filter(r => {
    const pct = r.required > 0 ? r.current / r.required : 1;
    return pct < 0.5;
  }).length;
  const scorePct = total > 0 ? Math.round((sufficient / total) * 100) : 0;
  const label = scorePct >= 80 ? 'Protected' : scorePct >= 50 ? 'Partial' : 'At Risk';
  const color = getCoverageColor(scorePct);
  return { scorePct, label, color, sufficient, atRisk, critical };
};

// 拨盘每格配置
const getDialConfig = (req: { current: number; required: number }) => {
  const pct = req.required > 0 ? Math.min(100, (req.current / req.required) * 100) : 100;
  const color = getCoverageColor(pct);
  const shortfall = req.required - req.current;
  return { pct: Math.round(pct), color, shortfall };
};

const COVERAGE_TAGS = [
  { key: 'dd',  label: 'Death & Disability', bg: '#eff6ff', color: '#1d4ed8', fields: ['Death', 'death', 'TPD', 'tpd'] },
  { key: 'med', label: 'Medical',             bg: '#f0fdf4', color: '#166534', fields: ['Medical Annual limit', 'medical annual limit'] },
  { key: 'ci',  label: 'Critical Illness',   bg: '#fdf4ff', color: '#7e22ce', fields: ['Advance Critical Illness', 'advance critical illness', 'Early Critical Illness', 'early critical illness'] },
  { key: 'acc', label: 'Accident',            bg: '#fff7ed', color: '#c2410c', fields: ['Personal Accident', 'personal accident'] },
] as const;

const getPolicyCoverageTags = (record: any) => {
  return COVERAGE_TAGS.filter(tag =>
    tag.fields.some((field: string) => extractValue(record, [field]) > 0)
  );
};

const Insurance: React.FC = () => {
  const [data, setData] = useState<FinancialHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

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
        <p className="text-xin-blue text-sm font-medium tracking-widest uppercase">Calculating Coverage...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 animate-fade-in">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="text-red-500 w-10 h-10" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Failed to load data</h3>
        <p className="text-slate-500 max-w-md">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const annualIncome = data.raw.annualIncome || 0;
  const insuranceRecords = data.raw.insurance || [];

  // Calculate total coverage for a specific column field across all insurance records
  const getCoverage = (fieldNames: string[]) => {
    return insuranceRecords.reduce((sum: number, record: any) => {
      return sum + extractValue(record, fieldNames);
    }, 0);
  };

  // Extract policy URL
  const getPolicyUrl = (item: any): string | null => {
    // PDF download is disabled for this milestone.
    // It will be re-enabled in the advisor portal phase with Supabase Storage.
    return null;
  };

  // Parse policies for the table
  const policies = insuranceRecords.map((record, idx) => ({
    id: record.id || record.record_id || `policy-${idx}`,
    insurer: extractString(record, ['Insurer', 'insurer', 'Company', 'company']),
    planName: extractString(record, ['Plan Name', 'plan name', 'Plan', 'plan', 'Policy Name', 'policy name']),
    policyNumber: extractString(record, ['Policy Number', 'policy number', 'Policy No', 'policy no']),
    premium: extractValue(record, ['Premium', 'premium']),
    policyUrl: getPolicyUrl(record),
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

  // Requirements Map
  const requirements = [
    {
      id: 'accident',
      title: 'Accident',
      description: 'Standard: 10x Annual Income',
      current: getCoverage(['Personal Accident', 'personal accident']),
      required: annualIncome * 10,
    },
    {
      id: 'basicMedical',
      title: 'Basic Medical',
      description: 'Standard: At least RM 1,000,000',
      current: getCoverage(['Medical Annual limit', 'medical annual limit']),
      required: 1000000,
    },
    {
      id: 'criticalIllnessAdvance',
      title: 'Critical Illness (Advance)',
      description: 'Standard: 3x Annual Income',
      current: getCoverage(['Advance Critical Illness', 'advance critical illness']),
      required: annualIncome * 3,
    },
    {
      id: 'disability',
      title: 'Disability',
      description: 'Standard: 10x Annual Income',
      current: getCoverage(['TPD', 'tpd']),
      required: annualIncome * 10,
    },
    {
      id: 'earlyCriticalIllness',
      title: 'Early Critical Illness',
      description: 'Standard: 50% of Critical Illness (Advance)',
      current: getCoverage(['Early Critical Illness', 'early critical illness']),
      required: annualIncome * 3 * 0.5,
    },
    {
      id: 'familyProtection',
      title: 'Family Protection',
      description: 'Standard: 10x Annual Income',
      current: getCoverage(['Death', 'death']),
      required: annualIncome * 10,
    }
  ];

  const bannerData = getBannerScore(requirements);
  const RING_R = 30;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const ringDash = (bannerData.scorePct / 100) * RING_CIRC;

  return (
    <div className="space-y-8 animate-fade-in-up pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-xin-blue tracking-tight font-serif flex items-center gap-3">
            <Shield className="text-xin-gold w-8 h-8" />
            Insurance Protection
          </h1>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Overview of your risk tolerance and required coverage vs current coverage.
          </p>
        </div>
        <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-end">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Annual Income</p>
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
            Overview
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-8 py-3 rounded-full text-sm font-bold tracking-widest uppercase transition-all duration-300 ${
              activeTab === 'policies'
                ? 'bg-white text-xin-blue shadow-md shadow-slate-200/50 scale-100'
                : 'text-slate-500 hover:text-xin-blue hover:bg-white/50 scale-95'
            }`}
          >
            Policies
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
                  stroke={bannerData.color}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${ringDash} ${RING_CIRC - ringDash}`}
                  transform="rotate(-90 36 36)"
                />
                <text x="36" y="41" textAnchor="middle" fill="white" fontSize="14" fontWeight="800">
                  {bannerData.scorePct}%
                </text>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Protection Score</p>
              <p className="text-2xl font-extrabold text-white mb-2">{bannerData.label}</p>
              <div className="flex gap-1.5">
                {requirements.map(req => {
                  const pct = req.required > 0 ? req.current / req.required : 1;
                  const dotColor = pct >= 1 ? '#10b981' : pct >= 0.5 ? '#f59e0b' : '#ef4444';
                  return (
                    <div
                      key={req.id}
                      className="w-2 h-2 rounded-full"
                      style={{ background: dotColor }}
                      title={req.title}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          {/* Status Badges */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Protected', count: bannerData.sufficient, color: '#10b981', border: '#10b981' },
              { label: 'At Risk',   count: bannerData.atRisk,    color: '#f59e0b', border: '#f59e0b' },
              { label: 'Critical',  count: bannerData.critical,  color: '#ef4444', border: '#ef4444' },
            ].map(({ label, count, color, border }) => (
              <div
                key={label}
                className="rounded-2xl p-3 text-center bg-white shadow-sm border border-slate-100"
                style={{ borderTop: `3px solid ${border}` }}
              >
                <p className="text-2xl font-extrabold" style={{ color }}>{count}</p>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
          {/* Dial Grid */}
          <div className="grid grid-cols-3 gap-3">
            {requirements.map(req => {
              const DIAL_R = 22;
              const DIAL_CIRC = 2 * Math.PI * DIAL_R;
              const { pct, color, shortfall } = getDialConfig(req);
              const dash = (pct / 100) * DIAL_CIRC;
              const isSufficient = req.current >= req.required;

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100 flex flex-col items-center"
                >
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle
                      cx="28" cy="28" r={DIAL_R}
                      fill="none"
                      stroke={`${color}22`}
                      strokeWidth="5"
                    />
                    <circle
                      cx="28" cy="28" r={DIAL_R}
                      fill="none"
                      stroke={color}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${DIAL_CIRC - dash}`}
                      transform="rotate(-90 28 28)"
                    />
                    {isSufficient ? (
                      <text x="28" y="33" textAnchor="middle" fill={color} fontSize="14" fontWeight="800">✓</text>
                    ) : (
                      <text x="28" y="33" textAnchor="middle" fill={color} fontSize="10" fontWeight="800">{pct}%</text>
                    )}
                  </svg>
                  <p className="text-xs font-bold text-slate-600 mt-2 leading-tight">{req.title}</p>
                  {isSufficient ? (
                    <p className="text-xs font-semibold mt-1" style={{ color: '#10b981' }}>Sufficient</p>
                  ) : (
                    <p className="text-xs font-semibold mt-1" style={{ color: '#ef4444' }}>-{formatRM(shortfall)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-xin-blue">Your Policies</h3>
            <span className="bg-xin-blue/10 text-xin-blue px-3 py-1 rounded-full text-xs font-bold">
              {policies.length} Active
            </span>
          </div>

          {policies.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
              <p className="text-slate-500 font-medium">No policies found</p>
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex flex-wrap gap-x-5 gap-y-2 shadow-sm">
                {COVERAGE_TAGS.map(tag => (
                  <div key={tag.key} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: tag.color }} />
                    <span className="text-xs font-semibold text-slate-600">{tag.label}</span>
                  </div>
                ))}
              </div>

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
                      {group.policies.length} {group.policies.length === 1 ? 'policy' : 'policies'}
                    </span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  {/* Policy cards grid */}
                  <div className={`grid gap-3 ${group.policies.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {group.policies.map(policy => {
                      const tags = getPolicyCoverageTags(policy.rawRecord);
                      return (
                        <div
                          key={policy.id}
                          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
                          style={{ borderLeft: `3px solid ${group.color}` }}
                        >
                          <p className="text-sm font-bold text-slate-800 mb-0.5 leading-tight">{policy.planName}</p>
                          <p className="font-mono text-xs text-slate-400 mb-3">{policy.policyNumber}</p>

                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {tags.map(tag => (
                                <span
                                  key={tag.key}
                                  className="text-xs font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: tag.bg, color: tag.color }}
                                >
                                  {tag.label}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="border-t border-slate-50 pt-3">
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-0.5">Premium</p>
                            <p className="text-base font-extrabold" style={{ color: group.color }}>{formatRM(policy.premium)}</p>
                            <p className="text-xs text-slate-400">per year</p>
                          </div>
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
