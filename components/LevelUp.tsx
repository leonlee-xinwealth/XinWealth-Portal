import React, { useState, useEffect } from 'react';
import { fetchRawHealthData, getLatestRecords, getSession } from '../services/larkService';
import { Loader2, AlertCircle, Edit2, Check, ArrowRight, Save, Plus, Trash2, HelpCircle, Wallet, Receipt, Home, Car, Baby, Package, FolderPlus, Info, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { DebouncedNumberInput } from './kyc/FormInputs';

const Tooltip = ({ text }: { text: string }) => (
  <div className="relative group flex items-center ml-2">
      <HelpCircle size={16} className="text-gray-400 hover:text-xin-blue cursor-pointer" />
      <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-10 text-center font-medium leading-relaxed scale-95 group-hover:scale-100">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
      </div>
  </div>
);

const StepUpIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    className={className}
  >
    <path d="M18 7c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-4.3 2.1c-.3-.5-.8-.8-1.4-.8H9.6c-.6 0-1.1.3-1.4.8l-2.6 4.3v6.6c0 .6.5 1 1.1 1h1.5c.6 0 1.1-.4 1.1-1v-5.2l1.6-2.5v7.7c0 .6.5 1 1.1 1h1.5c.6 0 1.1-.4 1.1-1V14l3.1 3v4c0 .6.5 1 1.1 1h1.5c.6 0 1.1-.4 1.1-1v-5c0-.3-.1-.6-.3-.8l-3.3-3.2.7-3.4 1.9 1.9c.2.2.5.3.8.3h2.6c.6 0 1.1-.4 1.1-1v-1.5c0-.6-.5-1-1.1-1h-1.9l-2.6-2.2z" />
    <path d="M2 22h4v-4h4v-4h4v-4h4v-4h4V2H2v20zm2-2V4h16v2h-4v4h-4v4H8v4H4z" fillOpacity="0.3" />
  </svg>
);

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

const INCOME_FIELDS = [
  { key: 'salary', label: '1. Salary', category: 'Salary', tooltip: 'Enter your fixed, recurring monthly base pay. Do not include one-time bonuses or variable commissions here.' },
  { key: 'bonus', label: '2. Bonus / One-off Incentives', category: 'Bonus / One-off Incentives', tooltip: 'Include annual bonuses, performance rewards, 13th-month salary, or any one-time cash gifts received this month.' },
  { key: 'directorFee', label: '3. Director / Advisory / Professional Fees', category: 'Director / Advisory / Professional Fees', tooltip: 'Fees received for serving on a board of directors, providing formal advisory roles, or specialized consulting services.' },
  { key: 'commission', label: '4. Commission / Referral Fee', category: 'Commission / Referral Fee', tooltip: 'Variable income earned from sales, successful business introductions, or lead referrals.' },
  { key: 'dividendCompany', label: '5. Dividend from Own Company', category: 'Dividend from Own Company', tooltip: 'Profit distributions or interim dividends declared and paid to you from your own private limited company (Sdn Bhd).' },
  { key: 'dividendInvestment', label: '6. Investment Dividends / Interest', category: 'Investment Dividends / Interest', tooltip: 'Passive income earned from public listed stocks, unit trusts, fixed deposits, or digital assets.' },
  { key: 'rentalIncome', label: '7. Rental Income', category: 'Rental Income', tooltip: 'Total monthly rent received from residential, commercial properties, or sub-letting arrangements.' },
];

const HOUSEHOLD_OPTIONS = [
  { value: 'All - Household', labelEn: 'All - Household', labelZh: '全部 - 家庭' },
  { value: 'Tel/ Mobile/ Internet', labelEn: 'Tel/ Mobile/ Internet', labelZh: '电话/手机/网络' },
  { value: 'Property Tax', labelEn: 'Property Tax', labelZh: '房产税' },
  { value: 'Home Maintenance', labelEn: 'Home Maintenance', labelZh: '房屋维护' },
  { value: 'Utilities Bills', labelEn: 'Utilities Bills', labelZh: '水电费' },
  { value: 'Groceries/Marketing', labelEn: 'Groceries/Marketing', labelZh: '杂货/买菜' },
  { value: "Maid's Levy/ Salary", labelEn: "Maid's Levy/ Salary", labelZh: '女佣税/薪水' },
  { value: 'Property Management / Sinking Fund', labelEn: 'Property Mgmt/Sinking Fund', labelZh: '物业管理/维修基金' },
  { value: 'Rental Expense', labelEn: 'Rental Expense', labelZh: '租金支出' }
];

const TRANSPORT_OPTIONS = [
  { value: 'All - Transport', labelEn: 'All - Transport', labelZh: '全部 - 交通' },
  { value: 'Road Tax', labelEn: 'Road Tax', labelZh: '路税' },
  { value: 'Parking Fee', labelEn: 'Parking Fee', labelZh: '停车费' },
  { value: 'Petrol', labelEn: 'Petrol', labelZh: '汽油' },
  { value: 'Servicing', labelEn: 'Servicing', labelZh: '保养/维修' },
  { value: 'Bus/ MRT/ Taxi/ Car Share', labelEn: 'Bus/ MRT/ Taxi/ Car Share', labelZh: '巴士/地铁/出租车/共享汽车' },
  { value: 'Car Insurance', labelEn: 'Car Insurance', labelZh: '汽车保险' }
];

const DEPENDANTS_OPTIONS = [
  { value: 'All - Dependants', labelEn: 'All - Dependants', labelZh: '全部 - 赡养/抚养' },
  { value: 'Child Care', labelEn: 'Child Care', labelZh: '儿童保育' },
  { value: "Children's School Fee", labelEn: "Children's School Fee", labelZh: '子女学费' },
  { value: 'Upgrading Class', labelEn: 'Upgrading Class', labelZh: '补习班/提升班' },
  { value: 'Dependant Allowances', labelEn: 'Dependant Allowances', labelZh: '家属津贴' },
  { value: 'Child Expenses', labelEn: 'Child Expenses', labelZh: '子女开销' },
  { value: 'Parent Allowance', labelEn: 'Parent Allowance', labelZh: '父母津贴' }
];

const PERSONAL_OPTIONS = [
  { value: 'All - Personal', labelEn: 'All - Personal', labelZh: '全部 - 个人' },
  { value: 'Entertainment', labelEn: 'Entertainment', labelZh: '娱乐' },
  { value: 'Dining Out', labelEn: 'Dining Out', labelZh: '外出就餐' },
  { value: 'Personal Care/ Clothing', labelEn: 'Personal Care/ Clothing', labelZh: '个人护理/服装' },
  { value: 'Vacation/ Travel', labelEn: 'Vacation/ Travel', labelZh: '度假/旅游' },
  { value: 'Donations/ Charity/ Gifts', labelEn: 'Donations/ Charity/ Gifts', labelZh: '捐款/慈善/礼物' },
  { value: 'Income Tax Expense', labelEn: 'Income Tax Expense', labelZh: '所得税支出' },
  { value: 'Insurance Premium', labelEn: 'Insurance Premium', labelZh: '保险费' },
  { value: 'School Fees', labelEn: 'School Fees', labelZh: '学费' }
];

const MISC_OPTIONS = [
  { value: 'All - Miscellaneous', labelEn: 'All - Miscellaneous', labelZh: '全部 - 杂项' },
  { value: 'Medical Cost', labelEn: 'Medical Cost', labelZh: '医疗费用' }
];

const OTHER_EXPENSES_OPTIONS = [
  { value: 'Loan Repayment', labelEn: 'Loan Repayment', labelZh: '贷款偿还' }
];

const YEARS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

const LevelUp: React.FC = () => {
  const { t, language } = useLanguage();
  const isZh = language === 'zh';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const [targetMonth, setTargetMonth] = useState(new Date().getMonth().toString());
  const [targetYear, setTargetYear] = useState(new Date().getFullYear().toString());

  const [rawHealthData, setRawHealthData] = useState<any>(null);
  const [incomes, setIncomes] = useState<{ id: string; key: string; category: string; description: string; amount: string }[]>([]);
  const [expenses, setExpenses] = useState<{ id: string; category: string; type: string; description?: string; amount: string }[]>([]);
  const [assets, setAssets] = useState<{ id: string; category: string; description: string; amount: number; isEditing?: boolean; tempAmount?: string }[]>([]);
  const [liabilities, setLiabilities] = useState<{ id: string; category: string; description: string; amount: number; monthlyInstallment: number; isEditing?: boolean; tempAmount?: string }[]>([]);

  useEffect(() => {
    loadLatestData();
  }, []);

  const loadLatestData = async () => {
    try {
      setLoading(true);
      const data = await fetchRawHealthData();
      const latestAssets = getLatestRecords(data.assets || []);
      const latestLiabilities = getLatestRecords(data.liabilities || []);
      
      const initAssets = latestAssets.map((r: any) => ({
        id: r.id || Math.random().toString(),
        category: r.fields['Category'] || 'Other',
        description: r.fields['Description'] || '',
        amount: parseFloat(r.fields['Value'] || r.fields['value'] || r.fields['Amount'] || 0)
      }));

      const initLiabilities = latestLiabilities.map((r: any) => {
        const oldAmount = parseFloat(r.fields['Value'] || r.fields['value'] || r.fields['Outstanding Amount'] || r.fields['Amount'] || 0);
        const monthly = parseFloat(r.fields['Monthly Installment'] || 0);
        // Auto-decrement logic!
        const newAmount = Math.max(0, oldAmount - monthly);
        return {
          id: r.id || Math.random().toString(),
          category: r.fields['Category'] || 'Other',
          description: r.fields['Description'] || '',
          amount: newAmount,
          monthlyInstallment: monthly
        };
      });

      setAssets(initAssets);
      setLiabilities(initLiabilities);
      setRawHealthData(data); // Save for pre-filling logic

    } catch (err: any) {
      setError(err.message || 'Failed to load latest data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!rawHealthData) return;
    
    let pMonth = parseInt(targetMonth) - 1;
    let pYear = parseInt(targetYear);
    if (pMonth < 0) {
        pMonth = 11;
        pYear -= 1;
    }
    const prevMonthString = MONTH_NAMES[pMonth].en;
    const prevMonthZh = MONTH_NAMES[pMonth].zh;
    const prevMonthValues = [prevMonthString, prevMonthZh, (pMonth + 1).toString().padStart(2, '0')];
    const prevYearString = pYear.toString();

    const isMatch = (item: any) => {
        if (!item || !item.fields) return false;
        
        let itemMonth = "";
        let rawMonth = item.fields["Month"] || item.fields["month"];
        if (Array.isArray(rawMonth) && rawMonth.length > 0) itemMonth = rawMonth[0]?.text || String(rawMonth[0] || "");
        else if (rawMonth && typeof rawMonth === 'object') itemMonth = rawMonth.text || "";
        else itemMonth = String(rawMonth || "");
        
        let itemYear = "";
        let rawYear = item.fields["Year"] || item.fields["year"];
        if (Array.isArray(rawYear) && rawYear.length > 0) itemYear = rawYear[0]?.text || String(rawYear[0] || "");
        else if (rawYear && typeof rawYear === 'object') itemYear = rawYear.text || "";
        else itemYear = String(rawYear || "");

        return String(itemYear) === prevYearString && prevMonthValues.some(v => String(itemMonth).toLowerCase().includes(v.toLowerCase()));
    };

    const extractAmt = (item: any) => {
        let val = item.fields["Amount"] || item.fields["amount"] || item.fields["Value"] || item.fields["value"];
        if (Array.isArray(val) && val.length > 0) val = val[0]?.text || String(val[0]);
        else if (val && typeof val === 'object') val = val.text;
        return String(val || "").replace(/[^0-9.]/g, '');
    };

    const getCat = (item: any) => {
        let val = item.fields["Category"] || item.fields["category"] || item.fields["Type"] || item.fields["type"];
        if (Array.isArray(val) && val.length > 0) val = val[0]?.text || String(val[0]);
        else if (val && typeof val === 'object') val = val.text;
        return String(val || "");
    };

    const prevIncomes = (rawHealthData.incomes || []).filter(isMatch);
    const prevExpenses = (rawHealthData.expenses || []).filter(isMatch);
    
    const FIXED_INCOME_KEYS = ['salary', 'directorFee', 'rentalIncome'];
    
    const newIncomes = INCOME_FIELDS.map(f => {
        let amount = '';
        if (FIXED_INCOME_KEYS.includes(f.key)) {
            const found = prevIncomes.find((i: any) => getCat(i) === f.category);
            if (found) amount = extractAmt(found);
        }
        return { 
            id: f.key, 
            key: f.key,
            category: f.category, 
            description: '', 
            amount
        };
    });
    setIncomes(newIncomes);

    const FIXED_EXPENSE_CATS = ['Property Management / Sinking Fund', 'Property Mgmt/Sinking Fund', '物业管理/维修基金', 'Insurance Premium', 'Loan Repayment'];
    const newExpenses: any[] = [];
    prevExpenses.forEach((exp: any) => {
        const cat = getCat(exp);
        if (FIXED_EXPENSE_CATS.some(fc => cat.includes(fc))) {
             newExpenses.push({
                 id: Math.random().toString(),
                 category: "Auto-Prefilled", 
                 type: cat,
                 amount: extractAmt(exp)
             });
        }
    });

    const mapSubCatToMain = (subCat: string) => {
         if (subCat.includes('Property Management') || subCat.includes('Sinking Fund') || subCat.includes('Property Mgmt') || subCat.includes('基金')) return t('expenses.household') || 'Household';
         if (subCat.includes('Insurance') || subCat.includes('保险')) return t('expenses.personal') || 'Personal';
         if (subCat.includes('Loan Repayment') || subCat.includes('贷款')) return t('expenses.others') || 'Other Expenses';
         return t('expenses.misc') || 'Miscellaneous';
    };
    newExpenses.forEach(exp => { exp.category = mapSubCatToMain(exp.type); });

    setExpenses(newExpenses);
  }, [targetMonth, targetYear, rawHealthData, t]);

  const addExpenseItem = (category: string, defaultType: string) => {
    const newItem = { 
      id: Date.now().toString() + Math.random().toString(), 
      category, 
      type: defaultType, 
      amount: ''
    };
    setExpenses(prev => [...prev, newItem]);
    setExpandedCard(category);
  };

  const removeExpenseItem = (id: string) => {
    setExpenses(prev => {
        const newItems = prev.filter(item => item.id !== id);
        return newItems;
    });
  };

  const updateExpenseItem = (id: string, field: string, value: string) => {
    setExpenses(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const updateIncomeItem = (key: string, field: string, value: string) => {
    setIncomes(prev => prev.map(item => item.key === key ? { ...item, [field]: value } : item));
  };

  const handleUpdateAmount = (setter: any, id: string, newAmount: number) => {
    setter((prev: any) => prev.map((item: any) => {
      if (item.id === id) {
        return { ...item, amount: newAmount, isEditing: false };
      }
      return item;
    }));
  };

  const selectClasses = "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm text-sm cursor-pointer";



  const handleSubmit = async () => {
    const session = getSession();
    if (!session || !session.token) {
      setError("Session expired. Please log in again.");
      return;
    }

    // Filter out zero amounts for income/expenses to keep database clean
    const payload = {
      targetMonth,
      targetYear,
      incomes: incomes.filter(i => parseFloat(String(i.amount).replace(/,/g, '')) > 0),
      expenses: expenses.filter(e => parseFloat(String(e.amount).replace(/,/g, '')) > 0),
      assets,
      liabilities
    };

    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch('/api/levelUp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Submission failed');
      
      const monthObj = MONTH_NAMES.find(m => m.value === targetMonth);
      setSuccessMsg(`Successfully leveled up for ${isZh ? monthObj?.zh : monthObj?.en} ${targetYear}!`);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission');
    } finally {
      setSubmitting(false);
    }
  };

  const renderExpandableExpenseCard = ( 
    title: string, 
    Icon: React.ElementType, 
    category: string,
    options: { value: string, labelEn: string, labelZh: string }[],
    defaultType: string 
  ) => {
    const items = expenses.filter(e => e.category === category);
    const hasItems = items.length > 0;
    const isOpen = expandedCard === category;

    return (
        <div className="border border-slate-200 rounded-2xl mb-4 bg-white shadow-sm overflow-hidden transition-all">
            {/* Header */}
            <div 
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedCard(isOpen ? null : category)}
            >
                <div className="flex items-center gap-4">
                    <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-full text-slate-600">
                        <Icon size={24} />
                    </div>
                    <span className="font-bold text-slate-800">{isZh ? t(`expenses.${category.toLowerCase()}`) || title : title} {hasItems ? `(${items.length})` : ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  {!hasItems && (
                     <button 
                        onClick={(e) => { e.stopPropagation(); addExpenseItem(category, defaultType); }} 
                        className="text-xin-blue flex items-center gap-1.5 text-sm font-bold hover:text-xin-cyan transition-colors"
                    >
                        <Plus size={18} /> {t('expenses.add') || 'Add'}
                    </button>
                  )}
                  {hasItems && (
                    <div className="text-xin-blue flex items-center gap-1.5 text-sm font-bold">
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  )}
                </div>
            </div>
            
            {/* Body */}
            {isOpen && (
                <div className="bg-slate-50/50 p-6 pt-2 space-y-4 border-t border-slate-100">
                    {items.map((item) => (
                        <div key={item.id} className="relative bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                {/* Type Dropdown */}
                                <div className="w-full md:w-5/12">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('common.type') || 'Type'}</label>
                                    <select
                                        className={selectClasses + " w-full !py-2"}
                                        value={item.type}
                                        onChange={(e) => updateExpenseItem(item.id, 'type', e.target.value)}
                                    >
                                        {options.map(opt => (
                                            <option key={opt.value} value={opt.value}>{isZh ? opt.labelZh : opt.labelEn}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Amount Input */}
                                <div className="w-full md:w-4/12">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('common.amount') || 'Amount'}</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-slate-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                            <span className="text-slate-500 font-bold text-xs">RM</span>
                                        </div>
                                        <DebouncedNumberInput 
                                            className="w-full pl-16 pr-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-xin-cyan/20 focus:border-xin-cyan bg-white shadow-sm font-bold text-slate-700"
                                            value={item.amount}
                                            onChange={(val) => updateExpenseItem(item.id, 'amount', val)}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* Delete */}
                                <div className="w-full md:w-3/12 flex items-end">
                                      <button 
                                          onClick={() => removeExpenseItem(item.id)} 
                                          className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors w-full md:w-auto mt-4 md:mt-0"
                                      >
                                          <Trash2 size={18} /> <span className="md:hidden text-sm font-bold ml-2">Delete</span>
                                      </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    <button 
                        onClick={() => addExpenseItem(category, defaultType)} 
                        className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-xin-blue hover:border-xin-blue/30 hover:bg-xin-blue/5 transition-all flex items-center justify-center gap-2 text-sm font-bold font-sans"
                    >
                        <Plus size={16} /> {isZh ? '添加明细' : 'Add Detail'}
                    </button>
                </div>
            )}
        </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-xin-blue animate-spin" />
        <p className="text-slate-500">Loading previous records...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 border border-slate-100 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
      
      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 border-b border-slate-100 pb-6">
        <div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
            <StepUpIcon className="text-emerald-500" size={28} />
            Monthly Level Up
          </h3>
          <p className="text-sm text-slate-500">Record your latest financial data to track your progress and level up your stats.</p>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <select 
            value={targetMonth} 
            onChange={(e) => setTargetMonth(e.target.value)}
            className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            {MONTH_NAMES.map(m => <option key={m.value} value={m.value}>{isZh ? m.zh : m.en}</option>)}
          </select>
          <select 
            value={targetYear} 
            onChange={(e) => setTargetYear(e.target.value)}
            className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            {[0, -1, -2].map(offset => {
              const y = (new Date().getFullYear() + offset).toString();
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertCircle size={20} />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}
      
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 flex items-center gap-3">
          <Check size={20} />
          <span className="font-bold text-sm">{successMsg}</span>
        </div>
      )}

      {/* STEP 1: Income & Expenses */}
      {step === 1 && (
        <div className="space-y-10 animate-fade-in">
          {/* Section: Income */}
          <div>
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                <Wallet size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-800">{t('income.title') || 'Income'}</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {INCOME_FIELDS.map((field) => {
                const inc = incomes.find(i => i.key === field.key);
                if (!inc) return null;
                return (
                  <div key={field.key} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-colors">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center">
                          <label className="text-sm font-bold text-slate-700">{field.label}</label>
                          <Tooltip text={field.tooltip} />
                        </div>
                    </div>
                    
                    <div className="relative mb-3">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-slate-200 pr-3 my-px bg-slate-50 rounded-l-md">
                            <span className="text-slate-400 font-bold text-xs">RM</span>
                        </div>
                        <DebouncedNumberInput 
                            className="w-full pl-16 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-xin-cyan/20 focus:border-xin-cyan bg-white shadow-sm transition-shadow font-bold text-slate-700"
                            value={inc.amount}
                            onChange={(val) => updateIncomeItem(field.key, 'amount', val)}
                            placeholder="0"
                        />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Expenses */}
          <div>
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <div className="bg-orange-50 p-2 rounded-lg text-orange-600">
                <Receipt size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-800">{t('expenses.title') || 'Expenses'}</h4>
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl flex items-start gap-3 mb-6">
              <Info size={18} className="text-xin-blue flex-shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-slate-600 italic">
                {isZh ? '您可以按类别添加支出明细，确保财务追踪更加精准。' : 'Add expense details by category to ensure more accurate financial tracking.'}
              </p>
            </div>
            
            <div className="space-y-2">
                {renderExpandableExpenseCard(t('expenses.household') || 'Household', Home, "Household", HOUSEHOLD_OPTIONS, "All - Household")}
                {renderExpandableExpenseCard(t('expenses.transport') || 'Transportation', Car, "Transportation", TRANSPORT_OPTIONS, "All - Transport")}
                {renderExpandableExpenseCard(t('expenses.dependants') || 'Dependants', Baby, "Dependants", DEPENDANTS_OPTIONS, "All - Dependants")}
                {renderExpandableExpenseCard(t('expenses.personal') || 'Personal', User, "Personal", PERSONAL_OPTIONS, "All - Personal")}
                {renderExpandableExpenseCard(t('expenses.misc') || 'Miscellaneous', Package, "Miscellaneous", MISC_OPTIONS, "All - Miscellaneous")}
                {renderExpandableExpenseCard(t('expenses.others') || 'Other Expenses', FolderPlus, "Other Expenses", OTHER_EXPENSES_OPTIONS, "Loan Repayment")}
            </div>
          </div>

          <div className="flex justify-end pt-8 border-t border-slate-100">
            <button 
              onClick={() => setStep(2)}
              className="flex items-center gap-3 bg-xin-blue text-white px-8 py-3.5 rounded-full font-bold hover:bg-xin-blue/90 shadow-xl shadow-xin-blue/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Next: Update Assets & Liabilities <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Assets & Liabilities */}
      {step === 2 && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h4 className="text-lg font-bold text-slate-800 mb-2">Assets</h4>
            <p className="text-xs text-slate-500 mb-4">These are carried over from your last record. Click update to modify current values.</p>
            
            <div className="space-y-2">
              {assets.map(asset => (
                <div key={asset.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <div className="mb-2 sm:mb-0">
                    <p className="text-sm font-bold text-slate-700">{asset.description || asset.category}</p>
                    <span className="text-xs font-semibold text-xin-blue bg-xin-blue/10 px-2 py-0.5 rounded-md">{asset.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {asset.isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-400">RM</span>
                        <input 
                          type="number"
                          autoFocus
                          className="w-24 text-right font-bold text-slate-800 border-b-2 border-xin-blue focus:outline-none"
                          value={asset.tempAmount !== undefined ? asset.tempAmount : asset.amount}
                          onChange={(e) => setAssets(prev => prev.map(p => p.id === asset.id ? { ...p, tempAmount: e.target.value } : p))}
                        />
                        <button 
                          onClick={() => handleUpdateAmount(setAssets, asset.id, parseFloat(asset.tempAmount || String(asset.amount)) || 0)}
                          className="bg-green-100 text-green-700 p-1.5 rounded-lg hover:bg-green-200"
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-slate-800">RM {asset.amount.toLocaleString()}</span>
                        <button 
                          onClick={() => setAssets(prev => prev.map(p => p.id === asset.id ? { ...p, isEditing: true, tempAmount: String(p.amount) } : p))}
                          className="text-xs font-bold text-xin-blue hover:underline flex items-center gap-1"
                        >
                          <Edit2 size={12} /> Update
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {assets.length === 0 && <p className="text-sm text-slate-400 italic">No existing assets found.</p>}
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h4 className="text-lg font-bold text-slate-800 mb-2">Liabilities</h4>
            <p className="text-xs text-slate-500 mb-4">Values have been auto-decremented based on your monthly installment. Click update to modify if needed.</p>
            
            <div className="space-y-2">
              {liabilities.map(liab => (
                <div key={liab.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <div className="mb-2 sm:mb-0">
                    <p className="text-sm font-bold text-slate-700">{liab.description || liab.category}</p>
                    <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-md">{liab.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {liab.isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-400">RM</span>
                        <input 
                          type="number"
                          autoFocus
                          className="w-24 text-right font-bold text-slate-800 border-b-2 border-red-500 focus:outline-none"
                          value={liab.tempAmount !== undefined ? liab.tempAmount : liab.amount}
                          onChange={(e) => setLiabilities(prev => prev.map(p => p.id === liab.id ? { ...p, tempAmount: e.target.value } : p))}
                        />
                        <button 
                          onClick={() => handleUpdateAmount(setLiabilities, liab.id, parseFloat(liab.tempAmount || String(liab.amount)) || 0)}
                          className="bg-green-100 text-green-700 p-1.5 rounded-lg hover:bg-green-200"
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-slate-800">RM {liab.amount.toLocaleString()}</span>
                        <button 
                          onClick={() => setLiabilities(prev => prev.map(p => p.id === liab.id ? { ...p, isEditing: true, tempAmount: String(p.amount) } : p))}
                          className="text-xs font-bold text-xin-blue hover:underline flex items-center gap-1"
                        >
                          <Edit2 size={12} /> Update
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {liabilities.length === 0 && <p className="text-sm text-slate-400 italic">No existing liabilities found.</p>}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button 
              onClick={() => setStep(1)}
              className="text-sm font-bold text-slate-500 hover:text-slate-800"
            >
              Back
            </button>
            <button 
              onClick={() => setStep(3)}
              className="flex items-center gap-2 bg-xin-blue text-white px-6 py-3 rounded-full font-bold hover:bg-xin-blue/90 shadow-md transition-all"
            >
              Review Summary <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Summary & Submit */}
      {step === 3 && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-xin-blue/5 p-6 rounded-2xl border border-xin-blue/20 text-center">
            <h4 className="text-2xl font-bold text-xin-blue mb-2">Review Your Data</h4>
            <p className="text-slate-600">Please confirm your snapshot for <strong>{(() => {
                const monthObj = MONTH_NAMES.find(m => m.value === targetMonth);
                return isZh ? monthObj?.zh : monthObj?.en;
            })()} {targetYear}</strong> before submitting.</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-emerald-50 p-6 rounded-2xl">
              <span className="text-xs font-bold text-emerald-600 uppercase">Total Income Entered</span>
              <p className="text-3xl font-bold text-slate-800">RM {incomes.reduce((acc, curr) => acc + (parseFloat(String(curr.amount).replace(/,/g, '')) || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-orange-50 p-6 rounded-2xl">
              <span className="text-xs font-bold text-orange-600 uppercase">Total Expenses Entered</span>
              <p className="text-3xl font-bold text-slate-800">RM {expenses.reduce((acc, curr) => acc + (parseFloat(String(curr.amount).replace(/,/g, '')) || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 p-6 rounded-2xl">
              <span className="text-xs font-bold text-blue-600 uppercase">Total Assets</span>
              <p className="text-3xl font-bold text-slate-800">RM {assets.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-red-50 p-6 rounded-2xl">
              <span className="text-xs font-bold text-red-600 uppercase">Total Liabilities</span>
              <p className="text-3xl font-bold text-slate-800">RM {liabilities.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex justify-between pt-6 border-t border-slate-100">
            <button 
              onClick={() => setStep(2)}
              disabled={submitting}
              className="text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50"
            >
              Back to Edit
            </button>
            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 bg-emerald-500 text-white px-8 py-3 rounded-full font-bold hover:bg-emerald-600 shadow-md transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {submitting ? 'Uploading to Database...' : 'Confirm & Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LevelUp;