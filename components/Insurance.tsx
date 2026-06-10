import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth } from '../services/apiService';
import { Loader2, Shield, AlertTriangle, CheckCircle2, AlertCircle, FileText, ExternalLink } from 'lucide-react';
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
  const policies = insuranceRecords.map(record => ({
    id: record.id || record.record_id,
    insurer: extractString(record, ['Insurer', 'insurer', 'Company', 'company']),
    planName: extractString(record, ['Plan Name', 'plan name', 'Plan', 'plan', 'Policy Name', 'policy name']),
    policyNumber: extractString(record, ['Policy Number', 'policy number', 'Policy No', 'policy no']),
    premium: extractValue(record, ['Premium', 'premium']),
    policyUrl: getPolicyUrl(record)
  })).filter(p => p.planName !== 'Unknown' || p.policyNumber !== 'Unknown');

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
          {/* Dial grid will be added in Task 4 */}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-xin-blue">Your Policies</h3>
            <span className="bg-xin-blue/10 text-xin-blue px-3 py-1 rounded-full text-xs font-bold">
              {policies.length} Active
            </span>
          </div>

          {policies.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="text-slate-400 w-8 h-8" />
              </div>
              <p className="text-slate-500 font-medium">No policies found</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 pt-2 px-4 font-bold text-xs uppercase tracking-wider text-slate-400">Insurer</th>
                    <th className="pb-4 pt-2 px-4 font-bold text-xs uppercase tracking-wider text-slate-400">Plan Name</th>
                    <th className="pb-4 pt-2 px-4 font-bold text-xs uppercase tracking-wider text-slate-400">Policy Number</th>
                    <th className="pb-4 pt-2 px-4 font-bold text-xs uppercase tracking-wider text-slate-400 text-right">Premium</th>
                    <th className="pb-4 pt-2 px-4 font-bold text-xs uppercase tracking-wider text-slate-400 text-center">Policy</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {policies.map((policy) => (
                    <tr key={policy.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-semibold text-slate-800 whitespace-nowrap">{policy.insurer}</td>
                      <td className="py-4 px-4 text-slate-600">{policy.planName}</td>
                      <td className="py-4 px-4 font-mono text-xs text-slate-500">{policy.policyNumber}</td>
                      <td className="py-4 px-4 font-bold text-xin-blue text-right whitespace-nowrap">{formatRM(policy.premium)}</td>
                      <td className="py-4 px-4 text-center">
                        {policy.policyUrl ? (
                          <a 
                            href={policy.policyUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                            title="View E-Policy"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-300" title="No E-Policy available">
                            <FileText className="w-4 h-4" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Insurance;
