import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth, fetchRawHealthData } from '../services/larkService';
import { Loader2, AlertCircle } from 'lucide-react';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

const extractValue = (item: any, fields: string[]): number => {
  for (const field of fields) {
    if (item.fields[field] !== undefined) {
       let val = item.fields[field];
       if (Array.isArray(val) && val.length > 0) {
           val = val[0];
           if (typeof val === 'object' && val.text) val = val.text;
       }
       else if (typeof val === 'object' && val !== null && val.text) {
           val = val.text;
       }
       if (typeof val === 'string') {
         val = parseFloat(val.replace(/RM/g, '').replace(/,/g, '').trim());
       }
       return Number(val) || 0;
    }
  }
  return 0;
};

const extractString = (item: any, fields: string[], defaultValue: string = 'Unknown'): string => {
  for (const field of fields) {
    if (item.fields[field] !== undefined) {
       let val = item.fields[field];
       if (Array.isArray(val) && val.length > 0) {
           if (typeof val[0] === 'object' && val[0].text) return val[0].text;
           return String(val[0]);
       }
       if (typeof val === 'object' && val.text) return val.text;
       return String(val);
    }
  }
  return defaultValue;
};

const Retirement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User profile defaults
  const [currentAge, setCurrentAge] = useState<number>(30);
  const [retirementAge, setRetirementAge] = useState<number | string>(55);
  
  // Projection assumptions
  const [salaryGrowthRate, setSalaryGrowthRate] = useState<number | string>(5); // 5%
  const [inflationRate, setInflationRate] = useState<number | string>(4); // 4%

  // We need to keep track of the initial loaded values to avoid infinite loops if we re-fetch
  const [hasLoadedBaseData, setHasLoadedBaseData] = useState(false);
  const [rawData, setRawData] = useState<any>(null);

  // Base financial data
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        let cAge = 30;
        let rAge = 55;

        // Get user session data for age
        const sessionStr = localStorage.getItem('xinwealth_user');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          if (session.currentAge) cAge = session.currentAge;
          if (session.retirementAge) rAge = session.retirementAge;
        }
        
        setCurrentAge(cAge);
        setRetirementAge(rAge);

        const data = await fetchRawHealthData();
        setRawData(data);
        setHasLoadedBaseData(true);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []); // Only run once on mount

  useEffect(() => {
    if (!hasLoadedBaseData || !rawData) return;
    
    try {
      // Find oldest year from incomes and expenses
      let oldestYear = new Date().getFullYear();
      const currentYear = new Date().getFullYear();
      
      const processYear = (item: any) => {
         const yearStr = extractString(item, ["Year", "year"], "");
         if (yearStr) {
            const y = parseInt(yearStr, 10);
            if (!isNaN(y) && y > 1900 && y <= currentYear) {
               if (y < oldestYear) oldestYear = y;
            }
         }
      };

      (rawData.incomes || []).forEach(processYear);
      (rawData.expenses || []).forEach(processYear);

      // Group data by year
      const yearlyData = new Map<number, { activeInc: number, passiveInc: number, expenses: number }>();
      
      for (let y = oldestYear; y <= currentYear; y++) {
         yearlyData.set(y, { activeInc: 0, passiveInc: 0, expenses: 0 });
      }

      (rawData.incomes || []).forEach((item: any) => {
         const yearStr = extractString(item, ["Year", "year"], "");
         let y = parseInt(yearStr, 10);
         if (isNaN(y) || y > currentYear || y < oldestYear) y = currentYear;
         
         let val = extractValue(item, ["Amount", "amount"]);
         const cat = extractString(item, ["Category", "category"]);
         
         if (!yearlyData.has(y)) yearlyData.set(y, { activeInc: 0, passiveInc: 0, expenses: 0 });
         const data = yearlyData.get(y)!;

         if (cat === 'Annual Bonus') {
           data.activeInc += val;
         } else if (cat === 'Rental Income' || cat === 'Dividend Income') {
           data.passiveInc += (val * 12); // Assuming monthly input
         } else {
           data.activeInc += (val * 12); // Assuming monthly salary
         }
      });

      (rawData.expenses || []).forEach((item: any) => {
         const yearStr = extractString(item, ["Year", "year"], "");
         let y = parseInt(yearStr, 10);
         if (isNaN(y) || y > currentYear || y < oldestYear) y = currentYear;
         
         let val = extractValue(item, ["Amount", "amount"]);
         const type = extractString(item, ["Type", "type"]);
         
         if (!yearlyData.has(y)) yearlyData.set(y, { activeInc: 0, passiveInc: 0, expenses: 0 });
         const data = yearlyData.get(y)!;

         if (type === 'Vacation/ Travel' || type === 'Income Tax Expense') {
            data.expenses += val;
         } else {
            data.expenses += (val * 12);
         }
      });

      let totalCashFD = 0;
      (rawData.assets || []).forEach((item: any) => {
        const val = extractValue(item, ["Value", "value", "Amount", "amount"]);
        const cat = extractString(item, ["Category", "category"]);
        if (cat === "Cash/Savings" || cat === "Savings" || cat === "Savings/Current Account" || cat === "Fixed Deposit" || cat === "Money Market Fund For Savings") {
          totalCashFD += val;
        }
      });

      // Calculate age at oldest year
      const startAge = currentAge - (currentYear - oldestYear);
      
      // Prepare projection data
      const data = [];
      let currentSavings = 0; 
      currentSavings += totalCashFD; 
      
      const endYear = oldestYear + (100 - startAge);
      
      let lastKnownActiveInc = 0;
      let lastKnownPassiveInc = 0;
      let lastKnownExpenses = 0;

      const numRetirementAge = Number(retirementAge) || 55;
      const numSalaryGrowth = Number(salaryGrowthRate) || 0;
      const numInflation = Number(inflationRate) || 0;

      for (let y = oldestYear; y <= endYear; y++) {
         const age = startAge + (y - oldestYear);
         let activeInc = 0;
         let passiveInc = 0;
         let expenses = 0;

         if (y <= currentYear) {
            // Historical data
            const yd = yearlyData.get(y);
            if (yd) {
               activeInc = yd.activeInc;
               passiveInc = yd.passiveInc;
               expenses = yd.expenses;
               
               if (activeInc > 0) lastKnownActiveInc = activeInc;
               if (passiveInc > 0) lastKnownPassiveInc = passiveInc;
               if (expenses > 0) lastKnownExpenses = expenses;
            } else {
               activeInc = lastKnownActiveInc;
               passiveInc = lastKnownPassiveInc;
               expenses = lastKnownExpenses;
            }
         } else {
            // Projection
            activeInc = age >= numRetirementAge ? 0 : lastKnownActiveInc * Math.pow(1 + numSalaryGrowth / 100, y - currentYear);
            passiveInc = lastKnownPassiveInc; // Keep constant
            expenses = lastKnownExpenses * Math.pow(1 + numInflation / 100, y - currentYear);
         }

         if (age >= numRetirementAge) activeInc = 0;

         let totalInc = activeInc + passiveInc;
         let takeHomeUsed = 0;
         let passiveUsed = 0;
         let cashUsed = 0;
         let shortfall = 0;

         if (totalInc >= expenses) {
           takeHomeUsed = Math.min(activeInc, expenses);
           passiveUsed = expenses - takeHomeUsed;
           currentSavings += (totalInc - expenses);
         } else {
           takeHomeUsed = activeInc;
           passiveUsed = passiveInc;
           let remainingExpenses = expenses - totalInc;
           
           if (currentSavings >= remainingExpenses) {
             cashUsed = remainingExpenses;
             currentSavings -= remainingExpenses;
           } else {
             cashUsed = currentSavings;
             shortfall = remainingExpenses - currentSavings;
             currentSavings = 0;
           }
         }

         data.push({
           age,
           year: y,
           expenses,
           takeHomeUsed,
           passiveUsed,
           cashUsed,
           shortfall,
           savings: currentSavings
         });
      }
      
      setChartData(data);

    } catch (err: any) {
      console.error('Calculation error:', err);
    }
  }, [hasLoadedBaseData, rawData, currentAge, retirementAge, salaryGrowthRate, inflationRate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 min-w-[250px]">
          <p className="text-center font-bold text-slate-700 border-b pb-2 mb-3">Age: {label}</p>
          <div className="space-y-2">
            <div className="flex justify-between font-bold text-slate-800">
              <span>Total Expenses</span>
              <span>{formatCurrency(data.expenses)}</span>
            </div>
            {data.shortfall > 0 && (
              <div className="flex justify-between text-sm items-center">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Shortfall</span>
                <span className="font-medium">{formatCurrency(data.shortfall)}</span>
              </div>
            )}
            {data.cashUsed > 0 && (
              <div className="flex justify-between text-sm items-center">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400"></span> Cash Used</span>
                <span className="font-medium">{formatCurrency(data.cashUsed)}</span>
              </div>
            )}
            {data.takeHomeUsed > 0 && (
              <div className="flex justify-between text-sm items-center">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-400"></span> Take-home Income Used</span>
                <span className="font-medium">{formatCurrency(data.takeHomeUsed)}</span>
              </div>
            )}
            {data.passiveUsed > 0 && (
              <div className="flex justify-between text-sm items-center">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-400"></span> Passive Income Used</span>
                <span className="font-medium">{formatCurrency(data.passiveUsed)}</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2 flex justify-between text-sm items-center">
                <span className="flex items-center gap-2"><span className="w-4 h-0.5 bg-slate-300"></span> Cash Savings</span>
                <span className="font-bold text-slate-600">{formatCurrency(data.savings)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-xin-blue animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Calculating Projection...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-slate-600 font-medium">Unable to load data</p>
        <p className="text-sm text-slate-400 max-w-md text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up pb-10">
      <div className="mb-8">
        <h2 className="text-3xl font-serif font-bold text-xin-blue mb-2">Retirement Projection</h2>
        <p className="text-slate-500">Project your financial future and determine if your savings will last through retirement.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Salary Growth Rate */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Salary Growth Rate (%)</label>
          <input 
            type="number" 
            value={salaryGrowthRate} 
            onChange={(e) => setSalaryGrowthRate(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full text-2xl font-bold text-xin-blue bg-transparent border-b-2 border-slate-200 focus:border-xin-blue focus:outline-none pb-1 transition-colors"
            step="0.1"
          />
        </div>

        {/* Inflation Rate */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Inflation Rate (%)</label>
          <input 
            type="number" 
            value={inflationRate} 
            onChange={(e) => setInflationRate(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full text-2xl font-bold text-xin-blue bg-transparent border-b-2 border-slate-200 focus:border-xin-blue focus:outline-none pb-1 transition-colors"
            step="0.1"
          />
        </div>

        {/* Retirement Age */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Retirement Age</label>
          <input 
            type="number" 
            value={retirementAge} 
            onChange={(e) => setRetirementAge(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full text-2xl font-bold text-xin-blue bg-transparent border-b-2 border-slate-200 focus:border-xin-blue focus:outline-none pb-1 transition-colors"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <h3 className="text-xl font-bold text-xin-blue mb-6">Cashflow & Savings Projection</h3>
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="age" 
                tick={{ fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false} 
                label={{ value: 'Age', position: 'bottom', fill: '#64748b' }}
              />
              <YAxis 
                yAxisId="left"
                tickFormatter={(value) => `RM ${value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : (value / 1000).toFixed(0) + 'K'}`} 
                tick={{ fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false} 
                label={{ value: 'Expenses', angle: -90, position: 'insideLeft', fill: '#64748b' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              
              <ReferenceLine x={retirementAge} stroke="#3b82f6" strokeDasharray="3 3" label={{ position: 'top', value: 'Retirement 🌴', fill: '#3b82f6' }} yAxisId="left" />

              <Bar dataKey="takeHomeUsed" name="Take-home Income Used" stackId="a" fill="#60a5fa" yAxisId="left" />
              <Bar dataKey="passiveUsed" name="Passive Income Used" stackId="a" fill="#4ade80" yAxisId="left" />
              <Bar dataKey="cashUsed" name="Cash Used" stackId="a" fill="#facc15" yAxisId="left" />
              <Bar dataKey="shortfall" name="Shortfall" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} yAxisId="left" />
              
              <Line type="monotone" dataKey="savings" name="Cash Savings" stroke="#94a3b8" strokeWidth={3} dot={false} yAxisId="left" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Retirement;