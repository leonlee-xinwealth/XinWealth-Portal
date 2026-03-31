import React, { useState, useEffect, useMemo } from 'react';
import { fetchRawHealthData } from '../services/larkService';
import { Loader2, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type TabType = 'inflow' | 'outflow';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#f4a261', '#d9ed92'];

// Helpers
const extractValue = (item: any, fields: string[]): number => {
  if (!item || !item.fields) return 0;
  for (const field of fields) {
    if (item.fields[field] !== undefined && item.fields[field] !== null) {
       let val = item.fields[field];
       
       if (Array.isArray(val) && val.length > 0) {
           val = val[0];
           if (val && typeof val === 'object' && val.text) val = val.text;
       }
       else if (val && typeof val === 'object' && val !== null && val.text) {
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

const parseDate = (item: any) => {
    if (!item || !item.fields) {
        return { year: 'N/A', month: 'N/A', timestamp: 0 };
    }
    const yearStr = extractString(item, ["Year", "year"], "");
    const monthStr = extractString(item, ["Month", "month"], "");
    let rawDate = item.fields["Date"] || item.fields["date"];

    if (rawDate) {
        if (Array.isArray(rawDate)) rawDate = rawDate[0];
        const isNumeric = typeof rawDate === 'string' && /^\d+$/.test(rawDate);
        const d = new Date(isNumeric ? parseInt(rawDate, 10) : rawDate);
        if (!isNaN(d.getTime())) {
            return {
                year: d.getFullYear().toString(),
                month: (d.getMonth() + 1).toString().padStart(2, '0'),
                timestamp: d.getTime()
            };
        }
    }

    if (yearStr && monthStr) {
        const m = parseInt(monthStr, 10);
        let validMonth = "01";
        if (!isNaN(m) && m >= 1 && m <= 12) {
            validMonth = m.toString().padStart(2, '0');
        } else {
            const monthMap: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
            const mStrLower = monthStr.substring(0, 3).toLowerCase();
            if (monthMap[mStrLower]) validMonth = monthMap[mStrLower];
        }
        return { 
            year: yearStr, 
            month: validMonth, 
            timestamp: new Date(`${yearStr}-${validMonth}-01`).getTime() 
        };
    }

    if (yearStr) {
        return {
            year: yearStr,
            month: '01',
            timestamp: new Date(`${yearStr}-01-01`).getTime()
        }
    }

    return { 
        year: 'N/A', 
        month: 'N/A', 
        timestamp: 0 
    };
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

interface RecordItem {
  id: string;
  year: string;
  month: string;
  timestamp: number;
  category: string;
  description: string;
  value: number;
}

const mapRecords = (rawArray: any[], valueFields: string[], categoryFields: string[], descFields: string[]): RecordItem[] => {
  return (rawArray || []).map(item => {
    if (!item || !item.fields) {
        return {
          id: Math.random().toString(),
          year: 'N/A',
          month: 'N/A',
          timestamp: 0,
          category: 'Unknown',
          description: 'Unknown',
          value: 0
        };
    }
    
    const d = parseDate(item);
    
    return {
      id: item.id || Math.random().toString(),
      year: d.year || 'N/A',
      month: d.month || 'N/A',
      timestamp: d.timestamp || 0,
      category: extractString(item, categoryFields),
      description: extractString(item, descFields, 'General'),
      value: extractValue(item, valueFields)
    };
  });
};

const Cashflow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('inflow');
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [incomes, setIncomes] = useState<RecordItem[]>([]);
  const [expenses, setExpenses] = useState<RecordItem[]>([]);

  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));

  const MONTHS = [
    { value: '01', label: 'Jan' },
    { value: '02', label: 'Feb' },
    { value: '03', label: 'Mar' },
    { value: '04', label: 'Apr' },
    { value: '05', label: 'May' },
    { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' },
    { value: '08', label: 'Aug' },
    { value: '09', label: 'Sep' },
    { value: '10', label: 'Oct' },
    { value: '11', label: 'Nov' },
    { value: '12', label: 'Dec' }
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchRawHealthData();
        
        if (!data) {
            throw new Error("No data returned from API");
        }
        
        const parsedIncomes = mapRecords(
            data.incomes || [], 
            ["Amount", "amount", "Value", "value"], 
            ["Category", "category", "Type", "type"],
            ["Description", "description", "Name", "name"]
        );
        
        const parsedExpenses = mapRecords(
            data.expenses || [], 
            ["Amount", "amount", "Value", "value"], 
            ["Type", "type", "Category", "category"],
            ["Description", "description", "Name", "name", "Item", "item"]
        );
        
        setIncomes(parsedIncomes || []);
        setExpenses(parsedExpenses || []);
        
        let latestYear = '';
        
        [...(parsedIncomes || []), ...(parsedExpenses || [])].forEach(item => {
            if (!item || !item.year || item.year === 'N/A') return;
            if (item.year > latestYear) {
                latestYear = item.year;
            }
        });
        
        if (latestYear) {
            setSelectedYear(latestYear);
        } else {
            setSelectedYear(new Date().getFullYear().toString());
        }

      } catch (err: any) {
        console.error("Cashflow data load error:", err);
        setError(err.message || 'Failed to load cashflow data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const availableYears = useMemo(() => {
      try {
          const years = new Set<string>();
          
          (incomes || []).forEach(item => { 
              if (item && item.year && item.year !== 'N/A') years.add(item.year); 
          });
          (expenses || []).forEach(item => { 
              if (item && item.year && item.year !== 'N/A') years.add(item.year); 
          });
          
          if (years.size === 0) {
              years.add(new Date().getFullYear().toString());
          }
          
          return Array.from(years).sort((a, b) => b.localeCompare(a));
      } catch (err) {
          console.error("Error in availableYears useMemo:", err);
          return [new Date().getFullYear().toString()];
      }
  }, [incomes, expenses]);

  useEffect(() => {
      try {
          if (!selectedYear || (availableYears && !availableYears.includes(selectedYear))) {
              if (availableYears && availableYears.length > 0) {
                  setSelectedYear(availableYears[0]);
              } else {
                  setSelectedYear(new Date().getFullYear().toString());
              }
          }
      } catch (err) {
          console.error("Error in selection effect:", err);
      }
  }, [selectedYear, availableYears]);

  const dataValues = useMemo(() => {
      try {
          const list = activeTab === 'inflow' ? (incomes || []) : (expenses || []);
          const filteredList = list.filter(item => {
              if (!item || !item.year || item.year === 'N/A') return false; 
              
              if (viewMode === 'annual') {
                  return String(item.year) === String(selectedYear);
              } else {
                  const itemMonth = item.month || '01';
                  return String(item.year) === String(selectedYear) && String(itemMonth) === String(selectedMonth);
              }
          });

          const catMap = new Map<string, { value: number, items: RecordItem[] }>();
          
          (filteredList || []).forEach(item => {
              if (!item || item.value === undefined || item.value === 0) return;
              
              if (!catMap.has(item.category)) {
                  catMap.set(item.category, { value: 0, items: [] });
              }
              const group = catMap.get(item.category)!;
              group.value += item.value;
              group.items.push(item);
          });
          
          const pData = Array.from(catMap.entries()).map(([name, data]) => ({
              name,
              value: data.value
          })).filter(d => d.value > 0);

          const tValue = pData.reduce((sum, item) => sum + item.value, 0);

          return { pieData: pData, categoryMap: catMap, totalValue: tValue };
      } catch (err) {
          console.error("Error in useMemo for Cashflow:", err);
          return { pieData: [], categoryMap: new Map(), totalValue: 0 };
      }
  }, [activeTab, incomes, expenses, viewMode, selectedYear, selectedMonth]);

  const renderContent = () => {
      const pieData = dataValues?.pieData || [];
      const categoryMap = dataValues?.categoryMap || new Map<string, { value: number, items: RecordItem[] }>();
      const totalValue = dataValues?.totalValue || 0;

      return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Pie Chart */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col">
                  <h3 className="text-xl font-bold text-xin-blue mb-6">Distribution</h3>
                  <div className="flex-1 min-h-[300px] flex items-center justify-center relative">
                      {pieData.length > 0 ? (
                          <>
                              <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                      <Pie
                                          data={pieData}
                                          cx="50%"
                                          cy="50%"
                                          innerRadius={60}
                                          outerRadius={100}
                                          paddingAngle={5}
                                          dataKey="value"
                                          label={({ cx, cy, midAngle, outerRadius, percent }: any) => {
                                              const RADIAN = Math.PI / 180;
                                              const radius = outerRadius + 15;
                                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                              return percent >= 0.01 ? (
                                                  <text 
                                                      x={x} 
                                                      y={y} 
                                                      fill="#475569" 
                                                      textAnchor={x > cx ? 'start' : 'end'} 
                                                      dominantBaseline="central" 
                                                      fontSize={12} 
                                                      fontWeight="bold"
                                                  >
                                                      {`${(percent * 100).toFixed(0)}%`}
                                                  </text>
                                              ) : null;
                                          }}
                                          labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                                      >
                                          {pieData.map((_, index) => (
                                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                          ))}
                                      </Pie>
                                      <Tooltip formatter={(val: number) => formatCurrency(val)} />
                                      <Legend />
                                  </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                  <p className="text-sm text-slate-500 font-medium">Total</p>
                                  <p className="text-lg font-bold text-xin-blue">{formatCurrency(totalValue)}</p>
                              </div>
                          </>
                      ) : (
                          <p className="text-slate-400">No data available for this period.</p>
                      )}
                  </div>
              </div>

              {/* Right: Detail Table */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-xl font-bold text-xin-blue mb-6">Details</h3>
                  {pieData.length > 0 ? (
                      <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                          {Array.from(categoryMap.entries()).map(([cat, data], idx) => {
                              if (data.value <= 0) return null;
                              return (
                                  <div key={idx} className="space-y-3">
                                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                          <div className="flex items-center gap-2">
                                              <span className="font-bold text-slate-700">{cat}</span>
                                              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                                                  {((data.value / totalValue) * 100).toFixed(0)}%
                                              </span>
                                          </div>
                                          <span className="font-bold text-xin-blue">{formatCurrency(data.value)}</span>
                                      </div>
                                      <div className="space-y-2 pl-4 border-l-2 border-slate-100">
                                          {data.items.map((item: any) => (
                                              <div key={item.id} className="flex justify-between text-sm">
                                                  <span className="text-slate-500">{item.description}</span>
                                                  <span className="text-slate-700 font-medium">{formatCurrency(item.value)}</span>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  ) : (
                      <div className="h-full flex items-center justify-center min-h-[200px]">
                          <p className="text-slate-400">No details available.</p>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-xin-blue animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Calculating Cashflow...</p>
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
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h2 className="text-3xl font-serif font-bold text-xin-blue mb-2">Cashflow</h2>
            <p className="text-slate-500">Track your cash inflows and outflows.</p>
        </div>
        
        <div className="flex flex-col gap-3 items-end">
            {/* Toggle Switch */}
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setViewMode('annual')}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                        viewMode === 'annual' 
                            ? 'bg-white text-xin-blue shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Annual
                </button>
                <button
                    onClick={() => setViewMode('monthly')}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                        viewMode === 'monthly' 
                            ? 'bg-white text-xin-blue shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Monthly
                </button>
            </div>

            {/* Dropdowns */}
            <div className="flex gap-3">
                <select 
                    value={selectedYear || ''} 
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue min-w-[100px]"
                >
                    {(availableYears || []).map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                {viewMode === 'monthly' && (
                    <select 
                        value={selectedMonth || ''} 
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue min-w-[100px]"
                    >
                        {(MONTHS || []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                )}
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-slate-200">
        {(['inflow', 'outflow'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-colors relative ${
              activeTab === tab ? 'text-xin-blue' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'inflow' ? 'Cash Inflow' : 'Cash Outflow'}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-xin-blue rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {renderContent()}
      
    </div>
  );
};

export default Cashflow;