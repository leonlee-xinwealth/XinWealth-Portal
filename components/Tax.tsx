import React, { useState } from 'react';

const TAX_YEARS = [2025];

interface TaxReliefItem {
  id: string;
  name: string;
  maxLimit: number;
  spent: number;
}

const initialReliefs: TaxReliefItem[] = [
  { id: 'lifestyle', name: 'Lifestyle (Books, PC, Internet)', maxLimit: 2500, spent: 0 },
  { id: 'sports', name: 'Sports Equipment & Activities', maxLimit: 1000, spent: 0 },
  { id: 'medical', name: 'Medical Expenses (Self, Spouse, Child)', maxLimit: 10000, spent: 0 },
  { id: 'education', name: 'Education Fees (Self)', maxLimit: 7000, spent: 0 },
  { id: 'childcare', name: 'Child Care Fees', maxLimit: 3000, spent: 0 },
  { id: 'sspn', name: 'SSPN', maxLimit: 8000, spent: 0 },
  { id: 'life_insurance', name: 'Life Insurance', maxLimit: 3000, spent: 0 },
  { id: 'epf', name: 'EPF', maxLimit: 4000, spent: 0 },
  { id: 'edu_med_insurance', name: 'Education & Medical Insurance', maxLimit: 4000, spent: 0 },
  { id: 'prs', name: 'Private Retirement Scheme (PRS)', maxLimit: 3000, spent: 0 },
  { id: 'ev', name: 'EV Charging Facilities', maxLimit: 2500, spent: 0 },
  { id: 'parents_medical', name: 'Medical Expenses for Parents', maxLimit: 8000, spent: 0 },
  { id: 'breastfeeding', name: 'Breastfeeding Equipment', maxLimit: 1000, spent: 0 },
];

const calculateTax = (chargeableIncome: number) => {
  if (chargeableIncome <= 5000) return 0;
  if (chargeableIncome <= 20000) return (chargeableIncome - 5000) * 0.01;
  if (chargeableIncome <= 35000) return 150 + (chargeableIncome - 20000) * 0.03;
  if (chargeableIncome <= 50000) return 600 + (chargeableIncome - 35000) * 0.06;
  if (chargeableIncome <= 70000) return 1500 + (chargeableIncome - 50000) * 0.11;
  if (chargeableIncome <= 100000) return 3700 + (chargeableIncome - 70000) * 0.19;
  if (chargeableIncome <= 400000) return 9400 + (chargeableIncome - 100000) * 0.25;
  if (chargeableIncome <= 600000) return 84400 + (chargeableIncome - 400000) * 0.26;
  if (chargeableIncome <= 2000000) return 136400 + (chargeableIncome - 600000) * 0.28;
  return 528400 + (chargeableIncome - 2000000) * 0.30;
};

const Tax: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [reliefs, setReliefs] = useState<TaxReliefItem[]>(initialReliefs);
  
  // Tax Estimator state
  const [annualIncome, setAnnualIncome] = useState<string>('');
  const [monthlyPcb, setMonthlyPcb] = useState<string>('');

  const handleReliefChange = (id: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setReliefs(prev => prev.map(r => r.id === id ? { ...r, spent: isNaN(numValue) ? 0 : numValue } : r));
  };

  const totalPotential = reliefs.reduce((acc, r) => acc + r.maxLimit, 0);
  const totalClaimed = reliefs.reduce((acc, r) => acc + Math.min(r.spent, r.maxLimit), 0);
  const remainingPotential = totalPotential - totalClaimed;
  const optimizationScore = Math.round((totalClaimed / totalPotential) * 100) || 0;

  // Tax Liability Calculation
  const income = parseFloat(annualIncome) || 0;
  const pcb = parseFloat(monthlyPcb) || 0;
  const totalPcb = pcb * 12;
  const totalReliefsAmount = totalClaimed + 9000; // 9000 is base individual relief
  const chargeableIncome = Math.max(0, income - totalReliefsAmount);
  const taxPayable = calculateTax(chargeableIncome);
  const finalPayableOrRefundable = taxPayable - totalPcb;

  const [showReference, setShowReference] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-xin-blue">Tax Management</h2>
          <p className="text-slate-500 mt-1">Optimize your tax reliefs and estimate your tax liability.</p>
        </div>
        <div>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xin-blue font-medium focus:outline-none focus:ring-2 focus:ring-xin-blue/20"
          >
            {TAX_YEARS.map(year => (
              <option key={year} value={year}>{year} Year of Assessment</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tax Relief Tracker */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-xin-blue">Tax Relief Tracker</h3>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-medium uppercase">Optimization Score</p>
                  <p className="text-2xl font-bold text-xin-gold">{optimizationScore}%</p>
                </div>
              </div>
            </div>

            <div className="bg-xin-bg rounded-2xl p-6 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Tax Savings Potential</p>
                <p className="text-3xl font-bold text-xin-blue">RM {remainingPotential.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-slate-400 mt-1">Unused relief limit</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 font-medium">Total Claimed</p>
                <p className="text-xl font-bold text-emerald-600">RM {totalClaimed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-slate-400 mt-1">Out of RM {totalPotential.toLocaleString()}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full mb-8 overflow-hidden">
              <div 
                className="h-full bg-xin-gold transition-all duration-500"
                style={{ width: `${optimizationScore}%` }}
              />
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {reliefs.map(relief => {
                const claimed = Math.min(relief.spent, relief.maxLimit);
                const progress = (claimed / relief.maxLimit) * 100;
                return (
                  <div key={relief.id} className="p-4 border border-slate-100 rounded-2xl hover:border-xin-blue/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xin-blue">{relief.name}</span>
                      <span className="text-xs font-bold text-slate-400">Max: RM {relief.maxLimit.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : 'bg-xin-blue'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">RM</span>
                        <input
                          type="number"
                          value={relief.spent || ''}
                          onChange={(e) => handleReliefChange(relief.id, e.target.value)}
                          className="w-32 pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-xin-blue/20"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Tax Liability Estimator */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-xl font-bold text-xin-blue mb-2">Tax Liability Estimator</h3>
            <p className="text-sm text-slate-500 mb-6">Plan your cash flow for tax season.</p>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Annual Income (EA Form)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">RM</span>
                  <input
                    type="number"
                    value={annualIncome}
                    onChange={(e) => setAnnualIncome(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-xin-blue/20"
                    placeholder="e.g. 120000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Monthly PCB Deduction</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">RM</span>
                  <input
                    type="number"
                    value={monthlyPcb}
                    onChange={(e) => setMonthlyPcb(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-xin-blue/20"
                    placeholder="e.g. 500"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Total yearly PCB: RM {totalPcb.toLocaleString()}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-500">Chargeable Income</span>
                <span className="font-medium">RM {chargeableIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-sm text-slate-500">Estimated Tax Payable</span>
                <span className="font-medium">RM {taxPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div className={`p-6 rounded-2xl ${finalPayableOrRefundable > 0 ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${finalPayableOrRefundable > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {finalPayableOrRefundable > 0 ? 'Estimated Payable (You Owe)' : 'Estimated Refundable (LHDN Owes You)'}
                </p>
                <p className={`text-4xl font-black ${finalPayableOrRefundable > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  RM {Math.abs(finalPayableOrRefundable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-xin-blue rounded-3xl p-6 text-white shadow-xl shadow-xin-blue/20">
             <h3 className="font-serif font-bold text-xl mb-2 text-xin-gold">Tax Reference</h3>
             <p className="text-sm text-white/80 mb-6">Need to refer to the official LHDN tax tables and reliefs for {selectedYear}?</p>
             <button 
               onClick={() => setShowReference(true)}
               className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold transition-colors"
             >
                View Tax Tables & Reliefs
             </button>
          </div>
        </div>
      </div>

      {/* Tax Reference Modal */}
      {showReference && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-xin-blue/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-2xl font-serif font-bold text-xin-blue">Tax Reference - {selectedYear}</h3>
              <button 
                onClick={() => setShowReference(false)}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
              {/* Note for User */}
              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm">
                <strong>Note:</strong> You can replace the placeholder areas below with the actual {selectedYear} Tax Table and Tax Relief images you uploaded.
              </div>
              
              <div>
                <h4 className="text-xl font-bold text-xin-blue mb-4">Tax Table {selectedYear}</h4>
                <div className="w-full h-64 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300">
                  <p className="text-slate-500 font-medium">Insert Tax Table Image Here</p>
                </div>
              </div>

              <div>
                <h4 className="text-xl font-bold text-xin-blue mb-4">Tax Reliefs {selectedYear}</h4>
                <div className="w-full h-96 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300">
                  <p className="text-slate-500 font-medium">Insert Tax Relief Images Here</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tax;