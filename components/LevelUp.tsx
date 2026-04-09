import React, { useState, useEffect, useMemo } from 'react';
import { fetchRawHealthData, getLatestRecords, getSession } from '../services/larkService';
import { 
  Loader2, AlertCircle, Edit2, Check, ArrowRight, Save, Plus, Trash2, 
  HelpCircle, Wallet, Receipt, Home, Car, Baby, Package, FolderPlus, 
  Info, User, ChevronDown, ChevronUp, TrendingUp, Umbrella, Briefcase,
  Building2, PiggyBank, CreditCard, ArrowBigUpDash
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { DebouncedNumberInput, DebouncedTextInput } from './kyc/FormInputs';

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
  ],
  assets: [
    { value: 'Cash/Savings', en: 'Cash/Savings', zh: '现金/储蓄' },
    { value: 'Fixed Deposit', en: 'Fixed Deposit', zh: '定期存款' },
    { value: 'EPF', en: 'EPF', zh: '公积金 (EPF)' },
    { value: 'Properties', en: 'Properties', zh: '房产' },
    { value: 'Vehicles', en: 'Vehicles', zh: '车辆' },
    { value: 'Other Assets', en: 'Other Assets', zh: '其他资产' }
  ],
  investments: [
    { value: 'ETF', en: 'ETF', zh: '交易所交易基金 (ETF)' },
    { value: 'Stocks', en: 'Stocks', zh: '股票' },
    { value: 'Unit Trusts', en: 'Unit Trusts', zh: '信托基金' },
    { value: 'Bonds', en: 'Bonds', zh: '债券' },
    { value: 'Forex', en: 'Forex', zh: '外汇' },
    { value: 'Gold/Precious Metals', en: 'Gold/Precious Metals', zh: '黄金/贵金属' },
    { value: 'Crypto', en: 'Crypto', zh: '加密货币' },
    { value: 'Other Investments', en: 'Other Investments', zh: '其他投资' }
  ],
  liabilities: [
    { value: 'Mortgage / Property Loan', en: 'Mortgage', zh: '房贷' },
    { value: 'Vehicle Loan', en: 'Vehicle Loan', zh: '车贷' },
    { value: 'Study Loan', en: 'Study Loan', zh: '助学贷款' },
    { value: 'Personal Loan', en: 'Personal Loan', zh: '个人贷款' },
    { value: 'Renovation Loan', en: 'Renovation Loan', zh: '装修贷款' },
    { value: 'Other Loans', en: 'Other Loans', zh: '其他贷款' }
  ]
};

const LevelUp: React.FC = () => {
  const { t, language } = useLanguage();
  const isZh = language === 'zh';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [targetMonth, setTargetMonth] = useState(new Date().getMonth().toString());
  const [targetYear, setTargetYear] = useState(new Date().getFullYear().toString());

  const [rawHealthData, setRawHealthData] = useState<any>(null);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);

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

    const mapRecord = (r: any, type: string) => ({
      id: r.id || Math.random().toString(),
      category: r.fields.Category || r.fields.Type || 'Other',
      description: r.fields.Description || r.fields.Type || '',
      amount: String(r.fields.Value || r.fields.Amount || r.fields["Outstanding Amount"] || '0'),
      // Keep extra fields for liabilities/assets
      outstandingBalance: r.fields["Outstanding Balance"] || r.fields["Outstanding Amount"] || '0',
      monthlyInstallment: r.fields["Monthly Installment"] || '0'
    });

    const lastIncomes = (rawHealthData.incomes || []).filter(isLastMonth).map((r: any) => mapRecord(r, 'inflow'));
    const lastExpenses = (rawHealthData.expenses || []).filter(isLastMonth).map((r: any) => mapRecord(r, 'outflow'));
    
    // For Assets and Investments, we usually want the most recent MARKET VALUE, not necessarily just "last month" 
    // but the request says "capture last month's data", so we follow that if available, otherwise latest.
    const getItems = (records: any[]) => {
      const match = records.filter(isLastMonth);
      if (match.length > 0) return match.map(r => mapRecord(r, ''));
      // Fallback to latest available
      return getLatestRecords(records || []).map(r => mapRecord(r, ''));
    };

    setIncomes(lastIncomes);
    setExpenses(lastExpenses);
    setAssets(getItems(rawHealthData.assets || []));
    setInvestments(getItems(rawHealthData.investments || []));
    setLiabilities(getItems(rawHealthData.liabilities || []));

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

  const handleSubmit = async () => {
    const session = getSession();
    if (!session?.token) {
      setError("Session expired. Please log in again.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch('/api/levelUp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify({
          targetMonth,
          targetYear,
          incomes: incomes.map(i => ({ category: i.category, description: i.description, amount: i.amount })),
          expenses: expenses.map(e => ({ type: e.category, description: e.description, amount: e.amount })),
          assets: assets.map(a => ({ category: a.category, description: a.description, amount: a.amount })),
          investments: investments.map(i => ({ category: i.category, description: i.description, amount: i.amount })),
          liabilities: liabilities.map(l => ({ category: l.category, description: l.description, amount: l.amount }))
        })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Submission failed');
      
      setSuccessMsg(`Successfully leveled up for ${targetYear}!`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = useMemo(() => ({
    inflow: incomes.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
    outflow: expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
    assets: assets.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0),
    investments: investments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
    liabilities: liabilities.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)
  }), [incomes, expenses, assets, investments, liabilities]);

  const ItemSection = ({ title, icon: Icon, items, setter, options, total, type }: any) => (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all mb-6">
      <div className="p-5 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xin-blue shadow-sm">
            <Icon size={24} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">{isZh ? t(`levelUp.${title.toLowerCase()}`) || title : title}</h4>
            <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">{isZh ? '总计' : 'Total'}: RM {total.toLocaleString()}</div>
          </div>
        </div>
        <button 
          onClick={() => addItem(setter, options[0].value)}
          className="bg-xin-blue text-white p-2 rounded-lg hover:bg-xin-cyan transition-colors shadow-sm"
        >
          <Plus size={20} />
        </button>
      </div>
      
      <div className="p-5 space-y-4">
        {items.length === 0 && (
          <div className="text-center py-6 text-slate-400 text-sm italic font-medium">
            {isZh ? '无记录。点击 + 添加。' : 'No items. Click + to add.'}
          </div>
        )}
        {items.map((item: any) => (
          <div key={item.id} className="relative bg-slate-50/30 p-4 rounded-xl border border-slate-100 space-y-3 group">
            <button 
              onClick={() => removeItem(setter, item.id)}
              className="absolute -top-2 -right-2 bg-red-50 text-red-500 p-1.5 rounded-full border border-red-100 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
            >
              <Trash2 size={14} />
            </button>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-wider">{isZh ? '类别' : 'Category'}</label>
                <select 
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none transition-all"
                  value={item.category}
                  onChange={(e) => updateItem(setter, item.id, 'category', e.target.value)}
                >
                  {options.map((opt: any) => <option key={opt.value} value={opt.value}>{isZh ? opt.zh : opt.en}</option>)}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-wider">{isZh ? '备注' : 'Description'}</label>
                <DebouncedTextInput 
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none transition-all"
                  value={item.description}
                  onChange={(val) => updateItem(setter, item.id, 'description', val)}
                  placeholder={isZh ? '输入备注...' : 'Enter description...'}
                />
              </div>
              <div className="md:col-span-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-wider">{isZh ? '金额' : 'Amount'}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[10px] font-bold text-slate-400">RM</div>
                  <DebouncedNumberInput 
                    className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-xin-blue/10 focus:border-xin-blue outline-none transition-all"
                    value={item.amount}
                    onChange={(val) => updateItem(setter, item.id, 'amount', val)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="w-10 h-10 text-xin-blue animate-spin" />
        <p className="text-slate-500 font-medium">Synchronizing with Lark Base...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Header Container */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl mb-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-xin-blue to-xin-cyan" />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-xin-blue/10 p-2.5 rounded-2xl text-xin-blue">
                <ArrowBigUpDash size={32} />
              </div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">Level Up Portal</h1>
            </div>
            <p className="text-slate-500 font-medium max-w-md">Update your monthly financial snapshot and track your progress towards financial freedom.</p>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-inner">
            <div className="flex flex-col">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">{isZh ? '报告月份' : 'Report Period'}</label>
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
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-8 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-center gap-3 animate-shake">
            <AlertCircle size={20} className="shrink-0" />
            <span className="font-bold text-sm tracking-tight">{error}</span>
          </div>
        )}
        
        {successMsg && (
          <div className="mt-8 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 flex items-center gap-3 animate-bounce-in">
            <Check size={20} className="shrink-0" />
            <span className="font-bold text-sm tracking-tight">{successMsg}</span>
          </div>
        )}
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <ItemSection title="Cash Inflow" icon={Wallet} items={incomes} setter={setIncomes} options={CATEGORY_OPTIONS.inflow} total={totals.inflow} type="inflow" />
        <ItemSection title="Cash Outflow" icon={Receipt} items={expenses} setter={setExpenses} options={CATEGORY_OPTIONS.outflow} total={totals.outflow} type="outflow" />
        <ItemSection title="Assets" icon={Building2} items={assets} setter={setAssets} options={CATEGORY_OPTIONS.assets} total={totals.assets} type="assets" />
        <ItemSection title="Investments" icon={TrendingUp} items={investments} setter={setInvestments} options={CATEGORY_OPTIONS.investments} total={totals.investments} type="investments" />
        <div className="lg:col-span-2">
            <ItemSection title="Liabilities" icon={Umbrella} items={liabilities} setter={setLiabilities} options={CATEGORY_OPTIONS.liabilities} total={totals.liabilities} type="liabilities" />
        </div>
      </div>

      {/* Summary Footer */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-xin-blue/10 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full md:w-auto">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{isZh ? '总流入' : 'Total Inflow'}</div>
              <div className="text-xl font-black text-emerald-400">RM {totals.inflow.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{isZh ? '总流出' : 'Total Outflow'}</div>
              <div className="text-xl font-black text-rose-400">RM {totals.outflow.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{isZh ? '净现金流' : 'Net Cashflow'}</div>
              <div className={`text-xl font-black ${totals.inflow - totals.outflow >= 0 ? 'text-xin-cyan' : 'text-rose-500'}`}>
                RM {(totals.inflow - totals.outflow).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{isZh ? '净资产' : 'Net Worth'}</div>
              <div className="text-xl font-black text-xin-blue">RM {(totals.assets + totals.investments - totals.liabilities).toLocaleString()}</div>
            </div>
          </div>
          
          <button 
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full md:w-auto bg-gradient-to-r from-xin-blue to-xin-cyan text-white px-12 py-4 rounded-2xl font-black text-lg hover:scale-[1.05] active:scale-[0.98] transition-all shadow-xl shadow-xin-blue/20 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
            {submitting ? (isZh ? '正在保存...' : 'Saving Changes...') : (isZh ? '确认并上传' : 'Confirm & Upload')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LevelUp;
