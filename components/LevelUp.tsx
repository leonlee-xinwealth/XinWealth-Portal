import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchRawHealthData, fetchReviewPrefill, submitQuarterlyReview,
} from '../services/apiService';
import { getAccessToken } from '../lib/supabase';
import {
  Loader2, AlertCircle, Check, Save, Plus, Trash2,
  Wallet, Receipt,
  Building2, Umbrella, ClipboardCheck, Clock, RotateCcw,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { DebouncedNumberInput, DebouncedTextInput } from './kyc/FormInputs';
import type { ReviewPrefillAsset, ReviewPrefillData, ReviewPrefillLiability } from '../services/apiService';

const MONTH_NAMES = [
  { value: '0', en: 'January', zh: '1月' },
  { value: '1', en: 'February', zh: '2月' },
  { value: '2', en: 'March', zh: '3月' },
  { value: '3', en: 'April', zh: '4月' },
  { value: '4', en: 'May', zh: '5月' },
  { value: '5', en: 'June', zh: '6月' },
  { value: '6', en: 'July', zh: '7月' },
  { value: '7', en: 'August', zh: '8月' },
  { value: '8', en: 'September', zh: '9月' },
  { value: '9', en: 'October', zh: '10月' },
  { value: '10', en: 'November', zh: '11月' },
  { value: '11', en: 'December', zh: '12月' }
];

const CATEGORY_OPTIONS = {
  inflow: [
    { value: 'Salary', en: 'Salary', zh: '薪水' },
    { value: 'Bonus / One-off Incentives', en: 'Bonus / Incentives', zh: '奖金/一次性激励' },
    { value: 'Director Fee', en: 'Director Fee', zh: '董事费' },
    { value: 'Commission / Referral Fee', en: 'Commission', zh: '佣金/推荐费' },
    { value: 'Dividend from Own Company', en: 'Dividend (Own Co)', zh: '自有公司分红' },
    { value: 'Investment Dividends / Interest', en: 'Investment Income', zh: '投资股息/利息' },
    { value: 'Rental Income', en: 'Rental Income', zh: '租金收入' },
    { value: 'Other', en: 'Other', zh: '其他' }
  ],
  outflow: [
    { value: 'Household', en: 'Household', zh: '家庭' },
    { value: 'Transportation', en: 'Transportation', zh: '交通' },
    { value: 'Dependants', en: 'Dependants', zh: '瞻养/抚养' },
    { value: 'Personal', en: 'Personal', zh: '个人' },
    { value: 'Miscellaneous', en: 'Miscellaneous', zh: '杂项' },
    { value: 'Other Expenses', en: 'Other Expenses', zh: '其他支出' }
  ]
};

// ── CFP P4 Task C — quarterly review (client-portal). ──
// spec docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md
// 决策 1, 2, 5, section C: the client's part is ONLY submitting balances —
// approval (which is what actually updates assets/liabilities and writes a
// health snapshot) happens on the advisor side (D5). Editing the values here
// therefore never touches `assets`/`liabilities` directly; it only stages a
// `reviews` row for the advisor to review.

interface AssetDraft { value: string; }
interface LiabilityDraft { balance: string; rate: string; payment: string; }

const toEditableNumber = (n: number | null | undefined): string => (n == null ? '' : String(n));

const LevelUp: React.FC = () => {
  const { t, language } = useLanguage();
  const isZh = language === 'zh';

  // ---- Step 1: quarterly review (required) ----
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewLoadError, setReviewLoadError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<ReviewPrefillData | null>(null);
  const [assetDrafts, setAssetDrafts] = useState<Record<string, AssetDraft>>({});
  const [liabilityDrafts, setLiabilityDrafts] = useState<Record<string, LiabilityDraft>>({});
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const loadReviewPrefill = async () => {
    try {
      setReviewLoading(true);
      setReviewLoadError(null);
      const data = await fetchReviewPrefill();
      setPrefill(data);
      const nextAssetDrafts: Record<string, AssetDraft> = {};
      (data.assets || []).forEach((a: ReviewPrefillAsset) => {
        nextAssetDrafts[a.id] = { value: toEditableNumber(a.current_value) };
      });
      setAssetDrafts(nextAssetDrafts);
      const nextLiabDrafts: Record<string, LiabilityDraft> = {};
      (data.liabilities || []).forEach((l: ReviewPrefillLiability) => {
        nextLiabDrafts[l.id] = {
          balance: toEditableNumber(l.outstanding_balance),
          rate: toEditableNumber(l.interest_rate),
          payment: toEditableNumber(l.monthly_payment),
        };
      });
      setLiabilityDrafts(nextLiabDrafts);
    } catch (err: any) {
      setReviewLoadError(err.message || 'Failed to load review data');
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    loadReviewPrefill();
  }, []);

  const resetAssetToPrefill = (assetId: string) => {
    const a = (prefill?.assets || []).find((x) => x.id === assetId);
    if (!a) return;
    setAssetDrafts((prev) => ({ ...prev, [assetId]: { value: toEditableNumber(a.current_value) } }));
  };
  const resetLiabilityToPrefill = (liabilityId: string) => {
    const l = (prefill?.liabilities || []).find((x) => x.id === liabilityId);
    if (!l) return;
    setLiabilityDrafts((prev) => ({
      ...prev,
      [liabilityId]: {
        balance: toEditableNumber(l.outstanding_balance),
        rate: toEditableNumber(l.interest_rate),
        payment: toEditableNumber(l.monthly_payment),
      },
    }));
  };
  const confirmAllUnchanged = () => {
    (prefill?.assets || []).forEach((a) => resetAssetToPrefill(a.id));
    (prefill?.liabilities || []).forEach((l) => resetLiabilityToPrefill(l.id));
  };

  const handleSubmitReview = async () => {
    if (!prefill) return;
    setReviewSubmitting(true);
    setReviewSubmitError(null);
    try {
      const assetsPayload = (prefill.assets || []).map((a) => ({
        asset_id: a.id,
        value: parseFloat(assetDrafts[a.id]?.value || '0') || 0,
      }));
      const liabilitiesPayload = (prefill.liabilities || []).map((l) => {
        const draft = liabilityDrafts[l.id];
        return {
          liability_id: l.id,
          balance: parseFloat(draft?.balance || '0') || 0,
          interest_rate: draft?.rate ? parseFloat(draft.rate) : null,
          monthly_payment: draft?.payment ? parseFloat(draft.payment) : null,
        };
      });
      await submitQuarterlyReview({
        assets: assetsPayload,
        liabilities: liabilitiesPayload,
        notes: reviewNotes.trim() || null,
      });
      setReviewSubmitted(true);
    } catch (err: any) {
      if (err.message === 'REVIEW_UNAVAILABLE') {
        setReviewSubmitError(isZh ? '复检功能即将开放，暂时无法提交，请稍后再试。' : 'Review submission isn’t available yet — please try again later.');
      } else if (err.message === 'REVIEW_ALREADY_PENDING') {
        setReviewSubmitError(isZh ? '已有一份复检等待审核。' : 'A review is already awaiting approval.');
        loadReviewPrefill();
      } else {
        setReviewSubmitError(err.message || (isZh ? '提交失败' : 'Submission failed'));
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  // ---- Step 2: last month's actual spending (optional, existing flow) ----
  const [showActuals, setShowActuals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [targetMonth, setTargetMonth] = useState(new Date().getMonth().toString());
  const [targetYear, setTargetYear] = useState(new Date().getFullYear().toString());

  const [rawHealthData, setRawHealthData] = useState<any>(null);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const [inflowMode, setInflowMode] = useState<'detailed' | 'simple'>('detailed');
  const [outflowMode, setOutflowMode] = useState<'detailed' | 'simple'>('detailed');

  useEffect(() => {
    loadLatestData();
  }, []);

  const loadLatestData = async () => {
    try {
      setLoading(true);
      const data = await fetchRawHealthData();
      setRawHealthData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (index: number) => {
    return MONTH_NAMES[index]?.en || "";
  };

  useEffect(() => {
    if (!rawHealthData) return;

    // Calculate Last Month
    let pMonth = parseInt(targetMonth) - 1;
    let pYear = parseInt(targetYear);
    if (pMonth < 0) {
        pMonth = 11;
        pYear -= 1;
    }
    const lastMonthName = getMonthName(pMonth);
    const lastYearStr = pYear.toString();

    const isLastMonth = (record: any) => {
      const rMonth = record.fields?.Month || record.fields?.month;
      const rYear = record.fields?.Year || record.fields?.year;
      return String(rMonth) === lastMonthName && String(rYear) === lastYearStr;
    };

    const mapRecord = (r: any) => ({
      id: r.id || Math.random().toString(),
      category: r.fields.Category || r.fields.Type || 'Other',
      description: r.fields.Description || r.fields.Type || '',
      amount: String(r.fields.Value || r.fields.Amount || r.fields["Outstanding Amount"] || '0'),
    });

    const lastIncomes = (rawHealthData.incomes || []).filter(isLastMonth).map((r: any) => mapRecord(r));
    const lastExpenses = (rawHealthData.expenses || []).filter(isLastMonth).map((r: any) => mapRecord(r));

    setIncomes(lastIncomes);
    setExpenses(lastExpenses);

    // Auto-detect simple vs detailed mode from existing data
    const isInflowLumpSum = lastIncomes.length === 1 && lastIncomes[0].category === 'Lump Sum';
    const isOutflowLumpSum = lastExpenses.length === 1 && lastExpenses[0].category === 'Lump Sum';
    setInflowMode(isInflowLumpSum ? 'simple' : 'detailed');
    setOutflowMode(isOutflowLumpSum ? 'simple' : 'detailed');

  }, [targetMonth, targetYear, rawHealthData]);

  const addItem = (setter: React.Dispatch<React.SetStateAction<any[]>>, defaultCategory: string) => {
    const newItem = {
      id: Date.now().toString() + Math.random().toString(),
      category: defaultCategory,
      description: '',
      amount: ''
    };
    setter(prev => [...prev, newItem]);
  };

  const removeItem = (setter: React.Dispatch<React.SetStateAction<any[]>>, id: string) => {
    setter(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (setter: React.Dispatch<React.SetStateAction<any[]>>, id: string, field: string, value: any) => {
    setter(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleInflowModeChange = (newMode: 'detailed' | 'simple') => {
    if (newMode === inflowMode) return;
    const hasRealData = incomes.length > 0 && !(incomes.length === 1 && incomes[0].category === 'Lump Sum');
    if (newMode === 'simple' && hasRealData) {
      const confirmed = window.confirm(
        isZh ? '切换到总额模式将清除现有明细记录，是否继续？' : 'Switching to Simple mode will clear your detailed records. Continue?'
      );
      if (!confirmed) return;
    }
    setInflowMode(newMode);
    if (newMode === 'simple') {
      setIncomes([{ id: 'lumpsum-' + Date.now(), category: 'Lump Sum', description: 'Total', amount: '' }]);
    } else {
      setIncomes([]);
    }
  };

  const handleOutflowModeChange = (newMode: 'detailed' | 'simple') => {
    if (newMode === outflowMode) return;
    const hasRealData = expenses.length > 0 && !(expenses.length === 1 && expenses[0].category === 'Lump Sum');
    if (newMode === 'simple' && hasRealData) {
      const confirmed = window.confirm(
        isZh ? '切换到总额模式将清除现有明细记录，是否继续？' : 'Switching to Simple mode will clear your detailed records. Continue?'
      );
      if (!confirmed) return;
    }
    setOutflowMode(newMode);
    if (newMode === 'simple') {
      setExpenses([{ id: 'lumpsum-' + Date.now(), category: 'Lump Sum', description: 'Total', amount: '' }]);
    } else {
      setExpenses([]);
    }
  };

  const handleSubmitActuals = async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError('Session expired. Please log in again.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch('/api/levelUp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          targetMonth,
          targetYear,
          incomes: incomes.map(i => ({ category: i.category, description: i.description, amount: i.amount })),
          expenses: expenses.map(e => ({ type: e.category, description: e.description, amount: e.amount })),
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Submission failed');

      setSuccessMsg(isZh ? `已成功记录 ${targetYear} 年支出！` : `Successfully recorded spending for ${targetYear}!`);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = useMemo(() => ({
    inflow: incomes.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
    outflow: expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
  }), [incomes, expenses]);

  const reviewTotals = useMemo(() => {
    const assetsTotal = Object.values(assetDrafts).reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
    const liabilitiesTotal = Object.values(liabilityDrafts).reduce((sum, d) => sum + (parseFloat(d.balance) || 0), 0);
    return { assetsTotal, liabilitiesTotal };
  }, [assetDrafts, liabilityDrafts]);

  const ItemSection = ({ title, icon: Icon, items, setter, options, total, type, showModeToggle, mode, onModeChange }: any) => {
    const isSimple = showModeToggle && mode === 'simple';

    return (
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-md hover:shadow-lg transition-all mb-8">
        <div className="p-6 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 text-xin-blue shadow-sm">
              <Icon size={28} />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <h4 className="text-xl font-black text-slate-800 tracking-tight">{isZh ? t(`levelUp.${title.toLowerCase().replace(/\s+/g, '')}`) || title : title}</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{isZh ? '总计' : 'Total'}:</span>
                <span className={`text-2xl font-black ${type === 'outflow' ? 'text-rose-500' : 'text-emerald-500'}`}>
                  RM {total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          {showModeToggle && (
            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => onModeChange('detailed')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'detailed' ? 'bg-white text-xin-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {isZh ? '明细' : 'Detailed'}
              </button>
              <button
                onClick={() => onModeChange('simple')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'simple' ? 'bg-white text-xin-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {isZh ? '总额' : 'Simple'}
              </button>
            </div>
          )}
        </div>

        <div className="p-6 space-y-5">
          {isSimple ? (
            <div className="flex flex-col items-center py-4">
              <div className="w-full max-w-xs">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">
                  {isZh ? '总金额 (RM)' : 'Total Amount (RM)'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-xs font-black text-slate-400">RM</div>
                  <DebouncedNumberInput
                    className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-lg font-black text-slate-800 shadow-sm focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none transition-all"
                    value={items[0]?.amount || ''}
                    onChange={(val: string) => updateItem(setter, items[0]?.id, 'amount', val)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              {items.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm italic font-medium bg-slate-50/20 rounded-2xl border border-dashed border-slate-200">
                  {isZh ? '目前无记录。点击下方按钮添加。' : 'No records yet. Click the button below to add.'}
                </div>
              )}
              {items.map((item: any) => (
                <div key={item.id} className="relative bg-slate-50/20 p-5 rounded-2xl border border-slate-100 space-y-4 group hover:bg-white hover:border-xin-blue/10 transition-all">
                  <button
                    onClick={() => removeItem(setter, item.id)}
                    className="absolute -top-2 -right-2 bg-white text-red-400 p-2 rounded-full border border-slate-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white z-10"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-left">
                    <div className="md:col-span-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">{isZh ? '类别' : 'Category'}</label>
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none transition-all cursor-pointer"
                        value={item.category}
                        onChange={(e) => updateItem(setter, item.id, 'category', e.target.value)}
                      >
                        {options.map((opt: any) => <option key={opt.value} value={opt.value}>{isZh ? opt.zh : opt.en}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">{isZh ? '备注' : 'Description'}</label>
                      <DebouncedTextInput
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none transition-all"
                        value={item.description}
                        onChange={(val) => updateItem(setter, item.id, 'description', val)}
                        placeholder={isZh ? '输入备注...' : 'Enter description...'}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">{isZh ? '金额 (RM)' : 'Amount (RM)'}</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-xs font-black text-slate-400">RM</div>
                        <DebouncedNumberInput
                          className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-2.5 text-sm font-black text-slate-800 shadow-sm focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none transition-all"
                          value={item.amount}
                          onChange={(val) => updateItem(setter, item.id, 'amount', val)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-center pt-2">
                <button
                  onClick={() => addItem(setter, options[0].value)}
                  className="flex items-center gap-2 bg-white text-xin-blue border-2 border-dashed border-slate-200 px-8 py-3.5 rounded-2xl font-black text-sm hover:border-xin-blue/30 hover:bg-xin-blue/5 hover:text-xin-cyan transition-all w-full md:w-auto"
                >
                  <Plus size={18} /> {isZh ? '添加一个项目' : 'Add item'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (reviewLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="w-10 h-10 text-xin-blue animate-spin" />
        <p className="text-slate-500 font-medium">{isZh ? '正在加载...' : 'Loading...'}</p>
      </div>
    );
  }

  if (reviewLoadError) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <p className="text-slate-600 font-medium">{reviewLoadError}</p>
      </div>
    );
  }

  // A submitted review (from this session, or already on file) replaces the
  // whole form with a waiting state — spec: "if a submitted review exists
  // show that state instead of the form".
  const pendingReview = reviewSubmitted || prefill?.review?.status === 'submitted';
  if (pendingReview) {
    const periodEnd = prefill?.review?.period_end;
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-12">
          <div className="w-20 h-20 bg-xin-blue/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="text-xin-blue w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-3">
            {isZh ? '已提交，等待顾问审核' : 'Submitted — awaiting advisor review'}
          </h2>
          <p className="text-slate-500">
            {isZh
              ? '您的季度复检已提交，顾问审核通过后会更新到您的账户。'
              : 'Your quarterly review has been submitted. It will take effect once your advisor approves it.'}
            {periodEnd ? ` (${isZh ? '截止' : 'as of'} ${periodEnd})` : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Header Container */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl mb-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-xin-blue to-xin-cyan" />

        <div className="flex items-center gap-3 mb-2">
          <div className="bg-xin-blue/10 p-2.5 rounded-2xl text-xin-blue">
            <ClipboardCheck size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">{isZh ? '季度复检' : 'Quarterly Review'}</h1>
        </div>
        <p className="text-slate-500 font-medium max-w-lg">
          {isZh
            ? '确认您的资产与负债现值。没有变化的话，一键确认即可。'
            : 'Confirm your current asset and liability balances. If nothing changed, one click confirms them as-is.'}
        </p>
        {prefill?.review_unavailable && (
          <div className="mt-4 p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-sm font-semibold">
            {isZh ? '复检功能即将开放，暂时仅供预览。' : 'Review submission is coming soon — preview only for now.'}
          </div>
        )}
      </div>

      {/* Step 1: assets */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-md mb-8">
        <div className="p-6 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 text-xin-blue shadow-sm">
              <Building2 size={28} />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <h4 className="text-xl font-black text-slate-800 tracking-tight">{isZh ? '资产' : 'Assets'}</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{isZh ? '总计' : 'Total'}:</span>
                <span className="text-2xl font-black text-emerald-500">RM {reviewTotals.assetsTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => (prefill?.assets || []).forEach((a) => resetAssetToPrefill(a.id))}
            className="flex items-center gap-1.5 text-xs font-bold text-xin-blue bg-xin-blue/10 px-4 py-2 rounded-xl hover:bg-xin-blue/20 transition-colors"
          >
            <RotateCcw size={14} /> {isZh ? '没有变化，一键确认' : 'No changes — confirm all'}
          </button>
        </div>
        <div className="p-6 space-y-3">
          {(prefill?.assets || []).length === 0 && (
            <p className="text-center py-8 text-slate-400 text-sm italic">{isZh ? '暂无资产记录' : 'No assets on file'}</p>
          )}
          {(prefill?.assets || []).map((a) => (
            <div key={a.id} className="grid grid-cols-1 sm:grid-cols-[1fr_180px] items-center gap-3 bg-slate-50/40 p-4 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-700">{a.name}</p>
                <p className="text-xs text-slate-400">{a.type}</p>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-xs font-black text-slate-400">RM</div>
                <DebouncedNumberInput
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-sm font-black text-slate-800 shadow-sm focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none transition-all"
                  value={assetDrafts[a.id]?.value || ''}
                  onChange={(val: string) => setAssetDrafts((prev) => ({ ...prev, [a.id]: { value: val } }))}
                  placeholder="0"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: liabilities */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-md mb-8">
        <div className="p-6 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 text-xin-blue shadow-sm">
              <Umbrella size={28} />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <h4 className="text-xl font-black text-slate-800 tracking-tight">{isZh ? '负债' : 'Liabilities'}</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{isZh ? '总计' : 'Total'}:</span>
                <span className="text-2xl font-black text-rose-500">RM {reviewTotals.liabilitiesTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => (prefill?.liabilities || []).forEach((l) => resetLiabilityToPrefill(l.id))}
            className="flex items-center gap-1.5 text-xs font-bold text-xin-blue bg-xin-blue/10 px-4 py-2 rounded-xl hover:bg-xin-blue/20 transition-colors"
          >
            <RotateCcw size={14} /> {isZh ? '没有变化，一键确认' : 'No changes — confirm all'}
          </button>
        </div>
        <div className="p-6 space-y-3">
          {(prefill?.liabilities || []).length === 0 && (
            <p className="text-center py-8 text-slate-400 text-sm italic">{isZh ? '暂无负债记录' : 'No liabilities on file'}</p>
          )}
          {(prefill?.liabilities || []).map((l) => (
            <div key={l.id} className="bg-slate-50/40 p-4 rounded-2xl border border-slate-100 space-y-3">
              <div>
                <p className="text-sm font-bold text-slate-700">{l.name}</p>
                <p className="text-xs text-slate-400">{l.type}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block tracking-widest">{isZh ? '余额 (RM)' : 'Balance (RM)'}</label>
                  <DebouncedNumberInput
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800 shadow-sm focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none"
                    value={liabilityDrafts[l.id]?.balance || ''}
                    onChange={(val: string) => setLiabilityDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], balance: val, rate: prev[l.id]?.rate || '', payment: prev[l.id]?.payment || '' } }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block tracking-widest">{isZh ? '利率 (%)' : 'Interest rate (%)'}</label>
                  <DebouncedTextInput
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none"
                    value={liabilityDrafts[l.id]?.rate || ''}
                    onChange={(val: string) => setLiabilityDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], rate: val, balance: prev[l.id]?.balance || '', payment: prev[l.id]?.payment || '' } }))}
                    placeholder="—"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block tracking-widest">{isZh ? '月供 (RM)' : 'Monthly payment (RM)'}</label>
                  <DebouncedNumberInput
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none"
                    value={liabilityDrafts[l.id]?.payment || ''}
                    onChange={(val: string) => setLiabilityDrafts((prev) => ({ ...prev, [l.id]: { ...prev[l.id], payment: val, balance: prev[l.id]?.balance || '', rate: prev[l.id]?.rate || '' } }))}
                    placeholder="—"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md mb-8 p-6">
        <label className="text-xs font-black text-slate-400 uppercase mb-2 block tracking-widest">{isZh ? '备注（选填）' : 'Notes (optional)'}</label>
        <textarea
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          rows={3}
          className="w-full bg-slate-50/40 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none transition-all"
          placeholder={isZh ? '有什么想让顾问知道的吗？' : 'Anything you want your advisor to know?'}
        />
      </div>

      {/* Step 2: optional last month's actual spending */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md mb-8 overflow-hidden">
        <button
          onClick={() => setShowActuals((v) => !v)}
          className="w-full p-6 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-4">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 text-xin-blue shadow-sm">
              <Wallet size={28} />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-800 tracking-tight">
                {isZh ? '上月实际收支（选填）' : "Last Month's Actual Spending (optional)"}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {isZh ? '与季度复检分开提交，随时可以补充' : 'Submitted separately from the quarterly review — add it any time'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-xin-blue">{showActuals ? (isZh ? '收起' : 'Hide') : (isZh ? '展开' : 'Show')}</span>
        </button>

        {showActuals && (
          <div className="p-6 pt-0 space-y-6 border-t border-slate-100">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-8 h-8 text-xin-blue animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <select
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-black text-slate-700 focus:ring-2 focus:ring-xin-blue/10 outline-none cursor-pointer"
                  >
                    {MONTH_NAMES.map(m => <option key={m.value} value={m.value}>{isZh ? m.zh : m.en}</option>)}
                  </select>
                  <select
                    value={targetYear}
                    onChange={(e) => setTargetYear(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-black text-slate-700 focus:ring-2 focus:ring-xin-blue/10 outline-none cursor-pointer"
                  >
                    {[0, -1, -2].map(offset => {
                      const y = (new Date().getFullYear() + offset).toString();
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-center gap-3">
                    <AlertCircle size={20} className="shrink-0" />
                    <span className="font-bold text-sm">{error}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 flex items-center gap-3">
                    <Check size={20} className="shrink-0" />
                    <span className="font-bold text-sm">{successMsg}</span>
                  </div>
                )}

                <ItemSection
                  title="Cash Inflow"
                  icon={Wallet}
                  items={incomes}
                  setter={setIncomes}
                  options={CATEGORY_OPTIONS.inflow}
                  total={totals.inflow}
                  type="inflow"
                  showModeToggle
                  mode={inflowMode}
                  onModeChange={handleInflowModeChange}
                />
                <ItemSection
                  title="Cash Outflow"
                  icon={Receipt}
                  items={expenses}
                  setter={setExpenses}
                  options={CATEGORY_OPTIONS.outflow}
                  total={totals.outflow}
                  type="outflow"
                  showModeToggle
                  mode={outflowMode}
                  onModeChange={handleOutflowModeChange}
                />

                <button
                  onClick={handleSubmitActuals}
                  disabled={submitting}
                  className="w-full bg-slate-800 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-slate-700 transition-all shadow-md flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {submitting ? (isZh ? '正在提交...' : 'Submitting...') : (isZh ? '提交上月收支' : "Submit Last Month's Spending")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Submit review footer */}
      <div className="bg-slate-900 text-white rounded-3xl p-10 shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-xin-blue/5 rounded-full blur-3xl -mr-48 -mt-48" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div>
            <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">{isZh ? '净资产变化' : 'Net Position'}</div>
            <div className="text-2xl font-black text-xin-gold">
              RM {(reviewTotals.assetsTotal - reviewTotals.liabilitiesTotal).toLocaleString()}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {reviewSubmitError && (
              <div className="text-sm font-bold text-rose-300 text-right max-w-sm">{reviewSubmitError}</div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={confirmAllUnchanged}
                className="flex items-center justify-center gap-2 bg-white/10 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-white/20 transition-all"
              >
                <RotateCcw size={18} /> {isZh ? '全部没有变化' : 'Nothing changed'}
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={reviewSubmitting}
                className="bg-gradient-to-r from-xin-blue to-xin-cyan text-white px-10 py-4 rounded-2xl font-black text-lg hover:scale-[1.03] active:scale-[0.98] transition-all shadow-2xl shadow-xin-blue/30 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {reviewSubmitting ? <Loader2 size={22} className="animate-spin" /> : <Save size={22} />}
                {reviewSubmitting ? (isZh ? '正在提交...' : 'Submitting...') : (isZh ? '提交复检' : 'Submit Review')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LevelUp;
