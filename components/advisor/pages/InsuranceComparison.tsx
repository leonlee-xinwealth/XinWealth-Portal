import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { getAccessToken } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';

type Clause = {
  clauseType: string;
  appliesTo: string | null;
  headlineValue: string | null;
  effectiveLimit: string | null;
  advisorAlert: string;
  severity: string;
};

type Rider = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  isRequired: boolean;
  dependsOnRiderId: string | null;
  clauses: Clause[];
};

type Plan = {
  id: string;
  insurerId: string;
  name: string;
  defaultTier: null | {
    id: string;
    tierName: string;
    annualLimit: number | null;
    lifetimeLimit: number | null;
    roomBoardDailyLimit: number | null;
  };
  deductible: number | null;
  features: Array<{ name: string; description: string | null }>;
  exclusions: string[];
  riders: Rider[];
};

type Insurer = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  plans: Plan[];
};

type CatalogResponse = {
  purpose: 'medical';
  insurers: Insurer[];
};

type SelectedComparison = {
  insurer: Insurer;
  plan: Plan;
  riders: Rider[];
};

const MIN_INSURERS = 2;

const InsuranceComparison: React.FC = () => {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');

  const [selectedInsurerIds, setSelectedInsurerIds] = useState<string[]>([]);
  const [selectedPlanIdsByInsurer, setSelectedPlanIdsByInsurer] = useState<Record<string, string>>({});
  const [selectedRidersByInsurer, setSelectedRidersByInsurer] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError('');

    (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (isMounted) setLoadError(t('Missing session. Please re-login.', '缺少登录状态，请重新登录。'));
        return;
      }
      const res = await fetch('/api/insurance-comparison-catalog?purpose=medical', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (!res.ok) {
        const txt = await res.text();
        if (isMounted) setLoadError(txt || 'Failed to load catalog');
        return;
      }
      const data = (await res.json()) as CatalogResponse;
      if (isMounted) setCatalog(data);
    })()
      .catch((e) => {
        if (isMounted) setLoadError(String(e?.message || e));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [language]);

  const insurers = useMemo(() => catalog?.insurers || [], [catalog]);

  const selectedInsurers = useMemo(() => {
    const map = new Map(insurers.map((i) => [i.id, i]));
    return selectedInsurerIds.map((id) => map.get(id)).filter((x): x is Insurer => Boolean(x));
  }, [insurers, selectedInsurerIds]);

  const toggleInsurer = (insurerId: string) => {
    setSelectedInsurerIds((prev) => {
      if (prev.includes(insurerId)) {
        const next = prev.filter((id) => id !== insurerId);
        setSelectedPlanIdsByInsurer((p) => {
          const { [insurerId]: _, ...rest } = p;
          return rest;
        });
        setSelectedRidersByInsurer((p) => {
          const { [insurerId]: _, ...rest } = p;
          return rest;
        });
        return next;
      }
      return [...prev, insurerId];
    });
  };

  const onPickPlan = (insurerId: string, planId: string) => {
    setSelectedPlanIdsByInsurer((prev) => ({ ...prev, [insurerId]: planId }));
    const insurer = insurers.find((i) => i.id === insurerId);
    const plan = insurer?.plans.find((p) => p.id === planId);
    const requiredRiders = (plan?.riders || []).filter((r) => r.isRequired).map((r) => r.id);
    setSelectedRidersByInsurer((prev) => ({ ...prev, [insurerId]: requiredRiders }));
  };

  const toggleRider = (insurerId: string, riderId: string) => {
    const insurer = insurers.find((i) => i.id === insurerId);
    const planId = selectedPlanIdsByInsurer[insurerId];
    const plan = insurer?.plans.find((p) => p.id === planId);
    const isRequired = !!plan?.riders.find((r) => r.id === riderId)?.isRequired;
    if (isRequired) return;

    setSelectedRidersByInsurer((prev) => {
      const current = prev[insurerId] || [];
      const next = current.includes(riderId) ? current.filter((id) => id !== riderId) : [...current, riderId];
      return { ...prev, [insurerId]: next };
    });
  };

  const canContinue = useMemo(() => {
    if (selectedInsurerIds.length < MIN_INSURERS) return false;
    return selectedInsurerIds.every((id) => !!selectedPlanIdsByInsurer[id]);
  }, [selectedInsurerIds, selectedPlanIdsByInsurer]);

  const selection: SelectedComparison[] = useMemo(() => {
    const insurerMap = new Map(insurers.map((i) => [i.id, i]));
    return selectedInsurerIds
      .map((insurerId) => {
        const insurer = insurerMap.get(insurerId);
        if (!insurer) return null;
        const planId = selectedPlanIdsByInsurer[insurerId];
        const plan = insurer.plans.find((p) => p.id === planId);
        if (!plan) return null;
        const riderIds = selectedRidersByInsurer[insurerId] || [];
        const riders = plan.riders.filter((r) => riderIds.includes(r.id));
        return { insurer, plan, riders };
      })
      .filter((x): x is SelectedComparison => Boolean(x));
  }, [insurers, selectedInsurerIds, selectedPlanIdsByInsurer, selectedRidersByInsurer]);

  const gotoReview = () => {
    if (!canContinue) return;
    setStep(2);
  };

  const gotoCompare = () => {
    setStep(3);
  };

  const backToSelect = () => setStep(1);
  const backToReview = () => setStep(2);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-xin-blue" />
          <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('Insurance Comparison', '保单对比')}</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {t('Medical-only MVP. Select plan and riders, then compare side-by-side.', 'Medical 版本：选择方案与 Riders，再进行对比。')}
        </p>
      </div>

      {isLoading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-sm text-slate-500">
          {t('Loading...', '加载中...')}
        </div>
      )}

      {!isLoading && loadError && (
        <div className="bg-red-50 rounded-2xl border border-red-200 shadow-sm p-5 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!isLoading && !loadError && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5 max-w-3xl mx-auto">
            <div className="flex items-center justify-center">
              <div className={`flex flex-col items-center ${step >= 1 ? 'text-xin-blue' : 'text-slate-400'}`}>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold mb-2 ${step >= 1 ? 'bg-xin-blue text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
                <span className="text-sm font-medium">{t('Select', '选择')}</span>
              </div>
              <div className={`flex-1 h-1 mx-4 rounded ${step >= 2 ? 'bg-xin-blue' : 'bg-slate-200'}`}></div>
              <div className={`flex flex-col items-center ${step >= 2 ? 'text-xin-blue' : 'text-slate-400'}`}>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold mb-2 ${step >= 2 ? 'bg-xin-blue text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
                <span className="text-sm font-medium">{t('Review', '确认')}</span>
              </div>
              <div className={`flex-1 h-1 mx-4 rounded ${step >= 3 ? 'bg-xin-blue' : 'bg-slate-200'}`}></div>
              <div className={`flex flex-col items-center ${step >= 3 ? 'text-xin-blue' : 'text-slate-400'}`}>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold mb-2 ${step >= 3 ? 'bg-xin-blue text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
                <span className="text-sm font-medium">{t('Compare', '对比')}</span>
              </div>
            </div>
          </div>

          {step === 1 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <div className="text-sm font-semibold text-xin-blue mb-2">
                    {t(`Insurers (min ${MIN_INSURERS})`, `保险公司（至少 ${MIN_INSURERS} 家）`)}
                  </div>
                  <div className="space-y-2">
                    {insurers.map((i) => (
                      <label
                        key={i.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                          selectedInsurerIds.includes(i.id) ? 'border-xin-gold/50 bg-xin-gold/10' : 'border-slate-100 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedInsurerIds.includes(i.id)}
                            onChange={() => toggleInsurer(i.id)}
                            className="h-4 w-4"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{i.shortName || i.name}</div>
                            <div className="text-xs text-slate-500 truncate">{i.name}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="text-sm font-semibold text-xin-blue mb-2">{t('Plans & Riders', '方案与 Riders')}</div>
                  {selectedInsurers.length === 0 ? (
                    <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-sm text-slate-500">
                      {t('Select insurers first.', '请先选择保险公司。')}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedInsurers.map((insurer) => {
                        const plans = insurer.plans;
                        const selectedPlanId = selectedPlanIdsByInsurer[insurer.id] || '';
                        const selectedPlan = plans.find((p) => p.id === selectedPlanId);
                        const ridersSelected = selectedRidersByInsurer[insurer.id] || [];

                        return (
                          <div key={insurer.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-100">
                              <div className="font-semibold text-slate-900">{insurer.name}</div>
                              <div className="text-xs text-slate-500">{t('Pick a plan and optional riders', '选择方案与可选 Riders')}</div>
                            </div>

                            <div className="p-4 space-y-4">
                              <div>
                                <div className="text-sm font-medium text-slate-700 mb-1">{t('Plan', '方案')}</div>
                                <select
                                  value={selectedPlanId}
                                  onChange={(e) => onPickPlan(insurer.id, e.target.value)}
                                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-xin-gold focus:border-xin-gold text-sm bg-white"
                                >
                                  <option value="">{t('-- Select a plan --', '-- 选择方案 --')}</option>
                                  {plans.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.defaultTier?.tierName ? `${p.name} (${p.defaultTier.tierName})` : p.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <div className="text-sm font-medium text-slate-700 mb-2">{t('Riders', 'Riders')}</div>
                                {!selectedPlan ? (
                                  <div className="text-xs text-slate-500">{t('Select a plan to view riders.', '请选择方案以查看 Riders。')}</div>
                                ) : selectedPlan.riders.length === 0 ? (
                                  <div className="text-xs text-slate-500">{t('No riders for this plan.', '该方案没有 Riders。')}</div>
                                ) : (
                                  <div className="space-y-2">
                                    {selectedPlan.riders.map((r) => (
                                      <label
                                        key={r.id}
                                        className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer ${
                                          ridersSelected.includes(r.id) ? 'border-xin-gold/40 bg-xin-gold/10' : 'border-slate-100 bg-white'
                                        }`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <input
                                            type="checkbox"
                                            checked={ridersSelected.includes(r.id)}
                                            onChange={() => toggleRider(insurer.id, r.id)}
                                            disabled={r.isRequired}
                                            className="h-4 w-4 mt-0.5"
                                          />
                                          <div className="min-w-0">
                                            <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                                            {r.description && <div className="text-xs text-slate-600 mt-0.5">{r.description}</div>}
                                          </div>
                                        </div>
                                        {r.isRequired && (
                                          <div className="text-[10px] font-semibold text-xin-blue whitespace-nowrap ml-4 bg-xin-gold/20 px-2 py-0.5 rounded">
                                            {t('Required', '必选')}
                                          </div>
                                        )}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {selectedInsurerIds.length < MIN_INSURERS ? (
                    <span className="text-amber-700 flex items-center gap-1">
                      <AlertCircle size={16} />
                      {t(`Need ${MIN_INSURERS - selectedInsurerIds.length} more insurer(s)`, `还需要 ${MIN_INSURERS - selectedInsurerIds.length} 家`)}
                    </span>
                  ) : (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle size={16} />
                      {t('Ready', '可以继续')}
                    </span>
                  )}
                </div>
                <button
                  onClick={gotoReview}
                  disabled={!canContinue}
                  className={`px-4 py-2 rounded-xl font-medium text-white transition-colors ${
                    !canContinue ? 'bg-slate-300 cursor-not-allowed' : 'bg-xin-blue hover:opacity-90'
                  }`}
                >
                  {t('Continue', '继续')}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-xin-blue">{t('Review Selection', '确认选择')}</div>
                  <div className="text-xs text-slate-500">{t('Confirm selected plans and riders.', '确认已选择的方案与 Riders。')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={backToSelect} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
                    {t('Back', '返回')}
                  </button>
                  <button onClick={gotoCompare} className="px-3 py-2 rounded-xl bg-xin-blue text-white text-sm hover:opacity-90">
                    {t('Compare', '开始对比')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {selection.map((s) => (
                  <div key={s.insurer.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100">
                      <div className="font-semibold text-slate-900">{s.insurer.shortName || s.insurer.name}</div>
                      <div className="text-xs text-slate-500">{s.plan.name}</div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="text-xs text-slate-500">
                        {t('Tier', 'Tier')}: {s.plan.defaultTier?.tierName || '-'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t('Riders', 'Riders')}: {s.riders.length}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-xin-blue">{t('Comparison', '对比')}</div>
                  <div className="text-xs text-slate-500">{t('Side-by-side medical coverage + riders/clauses.', '医疗保障 + Riders/条款 对比。')}</div>
                </div>
                <button onClick={backToReview} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-white">
                  {t('Back', '返回')}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-4 border-b border-r border-slate-100 bg-white w-1/4">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('Features', '项目')}</span>
                      </th>
                      {selection.map((s) => (
                        <th key={s.insurer.id} className="p-4 border-b border-slate-100 bg-white w-1/4">
                          <div className="font-semibold text-slate-900">{s.insurer.shortName || s.insurer.name}</div>
                          <div className="text-xs text-slate-500 mt-1">{s.plan.name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100">
                    <tr className="bg-slate-50/60">
                      <td colSpan={selection.length + 1} className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-100">
                        {t('Medical Coverage', '医疗保障')}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-4 border-r border-slate-100 font-medium text-slate-700">{t('Annual Limit', '年限额')}</td>
                      {selection.map((s) => (
                        <td key={s.insurer.id} className="p-4 text-slate-700">
                          {s.plan.defaultTier?.annualLimit ? `RM ${s.plan.defaultTier.annualLimit.toLocaleString()}` : '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 border-r border-slate-100 font-medium text-slate-700">{t('Lifetime Limit', '终身限额')}</td>
                      {selection.map((s) => (
                        <td key={s.insurer.id} className="p-4 text-slate-700">
                          {s.plan.defaultTier?.lifetimeLimit === null ? (
                            <span className="text-emerald-700 font-medium">{t('No Limit', '无限额')}</span>
                          ) : s.plan.defaultTier?.lifetimeLimit ? (
                            `RM ${s.plan.defaultTier.lifetimeLimit.toLocaleString()}`
                          ) : (
                            '-'
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 border-r border-slate-100 font-medium text-slate-700">{t('Room & Board', '房间与膳食')}</td>
                      {selection.map((s) => (
                        <td key={s.insurer.id} className="p-4 text-slate-700">
                          {s.plan.defaultTier?.roomBoardDailyLimit ? `RM ${s.plan.defaultTier.roomBoardDailyLimit.toLocaleString()} /day` : '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 border-r border-slate-100 font-medium text-slate-700">{t('Deductible (min)', '免赔额（最低）')}</td>
                      {selection.map((s) => (
                        <td key={s.insurer.id} className="p-4 text-slate-700">
                          {s.plan.deductible ? `RM ${s.plan.deductible.toLocaleString()}` : '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 border-r border-slate-100 font-medium text-slate-700">{t('Selling Points', '卖点')}</td>
                      {selection.map((s) => (
                        <td key={s.insurer.id} className="p-4 text-slate-700 align-top">
                          {s.plan.features.length === 0 ? (
                            <span className="text-slate-400 text-xs italic">-</span>
                          ) : (
                            <ul className="space-y-2">
                              {s.plan.features.map((f, i) => (
                                <li key={i} className="text-xs border border-slate-100 rounded-xl p-2 bg-white">
                                  <div className="font-semibold text-slate-900">{f.name}</div>
                                  {f.description && <div className="text-slate-600 mt-0.5">{f.description}</div>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      ))}
                    </tr>

                    <tr className="bg-slate-50/60">
                      <td colSpan={selection.length + 1} className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-100">
                        {t('Riders & Clauses', 'Riders 与条款')}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-4 border-r border-slate-100 font-medium text-slate-700">{t('Selected Riders', '已选 Riders')}</td>
                      {selection.map((s) => (
                        <td key={s.insurer.id} className="p-4 text-slate-700 align-top">
                          {s.riders.length === 0 ? (
                            <span className="text-slate-400 text-xs italic">-</span>
                          ) : (
                            <ul className="space-y-2">
                              {s.riders.map((r) => (
                                <li key={r.id} className="text-xs border border-slate-100 rounded-xl p-2 bg-white">
                                  <div className="font-semibold text-slate-900">
                                    {r.name}
                                    {r.isRequired && (
                                      <span className="ml-2 text-[10px] bg-xin-gold/20 text-xin-blue px-1.5 py-0.5 rounded">
                                        {t('Required', '必选')}
                                      </span>
                                    )}
                                  </div>
                                  {r.clauses.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {r.clauses.map((c, idx) => (
                                        <div key={idx} className="text-[11px] text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-2">
                                          <div className="font-semibold">{c.advisorAlert}</div>
                                          <div className="text-slate-500">
                                            {c.clauseType}
                                            {c.headlineValue ? ` · ${c.headlineValue}` : ''}
                                            {c.effectiveLimit ? ` · ${c.effectiveLimit}` : ''}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      ))}
                    </tr>

                    <tr className="bg-slate-50/60">
                      <td colSpan={selection.length + 1} className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-100">
                        {t('Exclusions', '除外条款')}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-4 border-r border-slate-100 font-medium text-slate-700">{t('Key Exclusions', '关键除外')}</td>
                      {selection.map((s) => (
                        <td key={s.insurer.id} className="p-4 text-slate-700 align-top">
                          {s.plan.exclusions.length === 0 ? (
                            <span className="text-slate-400 text-xs italic">-</span>
                          ) : (
                            <ul className="list-disc pl-4 space-y-1 text-xs">
                              {s.plan.exclusions.map((ex, i) => (
                                <li key={i}>{ex}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InsuranceComparison;

