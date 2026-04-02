import React, { useState, useEffect } from 'react';
import { fetchRawHealthData, getLatestRecords, getSession } from '../services/larkService';
import { Loader2, AlertCircle, UploadCloud, TrendingUp, TrendingDown, Edit2, Check, ArrowRight, Save, Plus, Trash2 } from 'lucide-react';

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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const INCOME_CATEGORIES = ['Salary', 'Director/Advisory/Professional Fee', 'Commission/Referral Fee', 'Dividend from company', 'Rental Income', 'Interest from investment'];
const EXPENSE_CATEGORIES = ['Household', 'Transportation', 'Dependants', 'Personal', 'Miscellaneous', 'Other Expenses'];

const LevelUp: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [targetMonth, setTargetMonth] = useState(MONTH_NAMES[new Date().getMonth()]);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear().toString());

  const [incomes, setIncomes] = useState<{ id: string; category: string; description: string; amount: number }[]>([]);
  const [expenses, setExpenses] = useState<{ id: string; type: string; description: string; amount: number }[]>([]);
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
        const oldAmount = parseFloat(r.fields['Outstanding Amount'] || r.fields['Amount'] || 0);
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

      // Pre-fill one empty row for each income/expense category to make it easy
      setIncomes(INCOME_CATEGORIES.map(cat => ({ id: Math.random().toString(), category: cat, description: '', amount: 0 })));
      setExpenses(EXPENSE_CATEGORIES.map(type => ({ id: Math.random().toString(), type, description: '', amount: 0 })));

    } catch (err: any) {
      setError(err.message || 'Failed to load latest data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = (setter: any, template: any) => {
    setter((prev: any) => [...prev, { id: Math.random().toString(), ...template }]);
  };

  const handleRemoveRow = (setter: any, id: string) => {
    setter((prev: any) => prev.filter((item: any) => item.id !== id));
  };

  const handleUpdateAmount = (setter: any, id: string, newAmount: number) => {
    setter((prev: any) => prev.map((item: any) => {
      if (item.id === id) {
        return { ...item, amount: newAmount, isEditing: false };
      }
      return item;
    }));
  };

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
      incomes: incomes.filter(i => i.amount > 0),
      expenses: expenses.filter(e => e.amount > 0),
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
      
      setSuccessMsg(`Successfully leveled up for ${targetMonth} ${targetYear}!`);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission');
    } finally {
      setSubmitting(false);
    }
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
            className="bg-transparent font-bold text-slate-700 focus:outline-none"
          >
            {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select 
            value={targetYear} 
            onChange={(e) => setTargetYear(e.target.value)}
            className="bg-transparent font-bold text-slate-700 focus:outline-none"
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
        <div className="space-y-8 animate-fade-in">
          {/* Incomes */}
          <div className="bg-emerald-50/30 p-6 rounded-2xl border border-emerald-100">
            <h4 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
              <TrendingUp size={20} /> Income
            </h4>
            <div className="space-y-3">
              {incomes.map((inc, idx) => (
                <div key={inc.id} className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                  <select 
                    value={inc.category} 
                    onChange={(e) => setIncomes(prev => prev.map(p => p.id === inc.id ? { ...p, category: e.target.value } : p))}
                    className="w-full sm:w-1/3 text-sm bg-transparent font-medium text-slate-700 focus:outline-none border-b border-slate-100 pb-1"
                  >
                    {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input 
                    type="text" placeholder="Description (Optional)" 
                    value={inc.description}
                    onChange={(e) => setIncomes(prev => prev.map(p => p.id === inc.id ? { ...p, description: e.target.value } : p))}
                    className="w-full sm:w-1/3 text-sm bg-transparent focus:outline-none border-b border-slate-100 pb-1"
                  />
                  <div className="w-full sm:w-1/3 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-400">RM</span>
                    <input 
                      type="number" min="0" placeholder="0"
                      value={inc.amount || ''}
                      onChange={(e) => setIncomes(prev => prev.map(p => p.id === inc.id ? { ...p, amount: parseFloat(e.target.value) || 0 } : p))}
                      className="w-full text-right font-bold text-emerald-600 focus:outline-none border-b border-slate-100 pb-1"
                    />
                    <button onClick={() => handleRemoveRow(setIncomes, inc.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
              <button onClick={() => handleAddRow(setIncomes, { category: 'Salary', description: '', amount: 0 })} className="text-sm font-bold text-emerald-600 flex items-center gap-1 hover:underline mt-2">
                <Plus size={16} /> Add Income
              </button>
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-orange-50/30 p-6 rounded-2xl border border-orange-100">
            <h4 className="text-lg font-bold text-orange-800 mb-4 flex items-center gap-2">
              <TrendingDown size={20} /> Expenses
            </h4>
            <div className="space-y-3">
              {expenses.map((exp, idx) => (
                <div key={exp.id} className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                  <select 
                    value={exp.type} 
                    onChange={(e) => setExpenses(prev => prev.map(p => p.id === exp.id ? { ...p, type: e.target.value } : p))}
                    className="w-full sm:w-1/3 text-sm bg-transparent font-medium text-slate-700 focus:outline-none border-b border-slate-100 pb-1"
                  >
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input 
                    type="text" placeholder="Description (Optional)" 
                    value={exp.description}
                    onChange={(e) => setExpenses(prev => prev.map(p => p.id === exp.id ? { ...p, description: e.target.value } : p))}
                    className="w-full sm:w-1/3 text-sm bg-transparent focus:outline-none border-b border-slate-100 pb-1"
                  />
                  <div className="w-full sm:w-1/3 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-400">RM</span>
                    <input 
                      type="number" min="0" placeholder="0"
                      value={exp.amount || ''}
                      onChange={(e) => setExpenses(prev => prev.map(p => p.id === exp.id ? { ...p, amount: parseFloat(e.target.value) || 0 } : p))}
                      className="w-full text-right font-bold text-orange-600 focus:outline-none border-b border-slate-100 pb-1"
                    />
                    <button onClick={() => handleRemoveRow(setExpenses, exp.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
              <button onClick={() => handleAddRow(setExpenses, { type: 'Household', description: '', amount: 0 })} className="text-sm font-bold text-orange-600 flex items-center gap-1 hover:underline mt-2">
                <Plus size={16} /> Add Expense
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button 
              onClick={() => setStep(2)}
              className="flex items-center gap-2 bg-xin-blue text-white px-6 py-3 rounded-full font-bold hover:bg-xin-blue/90 shadow-md transition-all"
            >
              Next: Update Assets & Liabilities <ArrowRight size={18} />
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
            <p className="text-slate-600">Please confirm your snapshot for <strong>{targetMonth} {targetYear}</strong> before submitting.</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-emerald-50 p-6 rounded-2xl">
              <span className="text-xs font-bold text-emerald-600 uppercase">Total Income Entered</span>
              <p className="text-3xl font-bold text-slate-800">RM {incomes.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-orange-50 p-6 rounded-2xl">
              <span className="text-xs font-bold text-orange-600 uppercase">Total Expenses Entered</span>
              <p className="text-3xl font-bold text-slate-800">RM {expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}</p>
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