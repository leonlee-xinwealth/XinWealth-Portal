import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth } from '../services/larkService';
import { Loader2, Shield, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { FinancialHealthData } from '../types';

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

const Insurance: React.FC = () => {
  const [data, setData] = useState<FinancialHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requirements.map((req) => {
          const isSufficient = req.current >= req.required;
          const percentage = req.required > 0 ? Math.min(100, (req.current / req.required) * 100) : 100;
          const shortfall = req.required - req.current;

          return (
            <div key={req.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow relative overflow-hidden">
              {/* Progress Bar Background */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                <div 
                  className={`h-full transition-all duration-1000 ${isSufficient ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-xin-blue mb-1">{req.title}</h3>
                  <p className="text-xs text-slate-500">{req.description}</p>
                </div>
                {isSufficient ? (
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-full">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="bg-rose-50 text-rose-600 p-2 rounded-full">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                )}
              </div>

              <div className="space-y-4 mt-auto pt-6">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">Current Coverage</p>
                  <p className="text-xl font-bold text-slate-800">{formatRM(req.current)}</p>
                </div>
                
                <div className="flex justify-between items-end pt-4 border-t border-slate-50">
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Required</p>
                    <p className="text-sm font-semibold text-slate-600">{formatRM(req.required)}</p>
                  </div>
                  {!isSufficient && shortfall > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-rose-400 font-medium mb-1">Shortfall</p>
                      <p className="text-sm font-bold text-rose-600">{formatRM(shortfall)}</p>
                    </div>
                  )}
                  {isSufficient && (
                    <div className="text-right">
                      <p className="text-xs text-emerald-400 font-medium mb-1">Status</p>
                      <p className="text-sm font-bold text-emerald-600">Sufficient</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Insurance;
