import React, { useState, useEffect, useMemo } from 'react';
import { fetchRawHealthData } from '../services/larkService';
import { Loader2, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

type TabType = 'assets' | 'liabilities' | 'networth';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#f4a261', '#d9ed92'];

// Helpers
const extractValue = (item: any, fields: string[]): number => {
  for (const field of fields) {
    if (item.fields[field] !== undefined) {
       let val = item.fields[field];
       if (typeof val === 'string') {
         val = parseFloat(val.replace(/RM/g, '').replace(/,/g, '').trim());
       }
       return val || 0;
    }
  }
  return 0;
};

const extractString = (item: any, fields: string[]): string => {
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
  return 'Unknown';
};

const parseDate = (item: any) => {
  const rawDate = item.fields["Date"] || item.fields["date"];
  if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
          return {
              year: d.getFullYear().toString(),
              month: (d.getMonth() + 1).toString().padStart(2, '0'),
              timestamp: d.getTime()
          };
      }
  }
  const year = item.fields["Year"] || item.fields["year"];
  const month = item.fields["Month"] || item.fields["month"];
  if (year && month) {
      return { 
          year: String(year), 
          month: String(month).padStart(2, '0'), 
          timestamp: new Date(`${year}-${month}-01`).getTime() 
      };
  }
  return { year: 'N/A', month: 'N/A', timestamp: 0 };
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface RecordItem {
  id: string;
  year: string;
  quarter: string; // 'Q1', 'Q2', 'Q3', 'Q4'
  month: string;   // Keeping month for potential internal sorting/logic if needed
  timestamp: number;
  category: string;
  description: string;
  value: number;
}

const getQuarter = (monthStr: string): string => {
    const m = parseInt(monthStr, 10);
    if (m >= 1 && m <= 3) return 'Q1';
    if (m >= 4 && m <= 6) return 'Q2';
    if (m >= 7 && m <= 9) return 'Q3';
    if (m >= 10 && m <= 12) return 'Q4';
    return 'N/A';
};

const mapRecords = (rawArray: any[], valueFields: string[]): RecordItem[] => {
  return (rawArray || []).map(item => {
    const d = parseDate(item);
    return {
      id: item.id || Math.random().toString(),
      year: d.year,
      month: d.month,
      quarter: getQuarter(d.month),
      timestamp: d.timestamp,
      category: extractString(item, ["Category", "category", "Type", "type"]),
      description: extractString(item, ["Description", "description", "Name", "name", "Item", "item"]),
      value: extractValue(item, valueFields)
    };
  });
};

const NetWorth: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('assets');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [assets, setAssets] = useState<RecordItem[]>([]);
  const [liabilities, setLiabilities] = useState<RecordItem[]>([]);

  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchRawHealthData();
        
        const combinedAssets = [
            ...mapRecords(data.assets || [], ["Value", "value", "Amount", "amount"]),
            ...mapRecords(data.investments || [], ["Amount", "amount", "Value", "value", "End Value", "end value"])
        ];
        const parsedLiabilities = mapRecords(data.liabilities || [], ["Outstanding Amount", "outstanding amount", "Amount", "amount", "Value", "value"]);
        
        setAssets(combinedAssets);
        setLiabilities(parsedLiabilities);
        
        // Find latest date for default selection
        let latestYear = '';
        let latestQuarter = '';
        let maxTime = 0;
        
        [...combinedAssets, ...parsedLiabilities].forEach(item => {
            if (item.timestamp > maxTime) {
                maxTime = item.timestamp;
                latestYear = item.year;
                latestQuarter = item.quarter;
            }
        });
        
        if (latestYear && latestQuarter) {
            setSelectedYear(latestYear);
            setSelectedQuarter(latestQuarter);
        }

      } catch (err: any) {
        setError(err.message || 'Failed to load net worth data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Dropdown options
  const availableYears = useMemo(() => {
      const years = new Set<string>();
      const currentList = activeTab === 'assets' ? assets : liabilities;
      currentList.forEach(item => { if (item.year !== 'N/A') years.add(item.year); });
      return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [assets, liabilities, activeTab]);

  const availableQuarters = useMemo(() => {
      const quarters = new Set<string>();
      const currentList = activeTab === 'assets' ? assets : liabilities;
      currentList.forEach(item => { 
          if (item.year === selectedYear && item.quarter !== 'N/A') {
              quarters.add(item.quarter);
          }
      });
      return Array.from(quarters).sort();
  }, [assets, liabilities, activeTab, selectedYear]);

  // Ensure selected quarter is valid when year changes
  useEffect(() => {
      if (availableQuarters.length > 0 && !availableQuarters.includes(selectedQuarter)) {
          setSelectedQuarter(availableQuarters[availableQuarters.length - 1]);
      }
  }, [availableQuarters, selectedQuarter]);


  // Tab 1 & 2: Assets / Liabilities
  const renderAssetsOrLiabilities = () => {
      const list = activeTab === 'assets' ? assets : liabilities;
      const filteredList = list.filter(item => item.year === selectedYear && item.quarter === selectedQuarter);
      
      // Group by category
      const categoryMap = new Map<string, { value: number, items: RecordItem[] }>();
      filteredList.forEach(item => {
          if (!categoryMap.has(item.category)) {
              categoryMap.set(item.category, { value: 0, items: [] });
          }
          const group = categoryMap.get(item.category)!;
          group.value += item.value;
          group.items.push(item);
      });
      
      const pieData = Array.from(categoryMap.entries()).map(([name, data]) => ({
          name,
          value: data.value
      })).filter(d => d.value > 0);

      const totalValue = pieData.reduce((sum, item) => sum + item.value, 0);

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
                                          innerRadius={80}
                                          outerRadius={120}
                                          paddingAngle={5}
                                          dataKey="value"
                                      >
                                          {pieData.map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                          ))}
                                      </Pie>
                                      <Tooltip formatter={(val: number) => formatCurrency(val)} />
                                      <Legend />
                                  </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                  <p className="text-sm text-slate-500 font-medium">Total</p>
                                  <p className="text-xl font-bold text-xin-blue">{formatCurrency(totalValue)}</p>
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
                                          <span className="font-bold text-slate-700">{cat}</span>
                                          <span className="font-bold text-xin-blue">{formatCurrency(data.value)}</span>
                                      </div>
                                      <div className="space-y-2 pl-4 border-l-2 border-slate-100">
                                          {data.items.map(item => (
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

  // Tab 3: Net Worth
  const renderNetWorth = () => {
      // Group all data by Year-Quarter
      const timeMap = new Map<string, { time: string, timestamp: number, assets: number, liabilities: number, netWorth: number }>();
      
      const addToMap = (item: RecordItem, type: 'assets' | 'liabilities') => {
          if (item.year === 'N/A' || item.quarter === 'N/A') return;
          const key = `${item.year} ${item.quarter}`;
          if (!timeMap.has(key)) {
              // Create a consistent timestamp for sorting based on year and quarter
              const qNum = parseInt(item.quarter.replace('Q', ''));
              const mockMonth = (qNum - 1) * 3 + 1; // Q1 -> 1, Q2 -> 4, etc.
              const timestamp = new Date(`${item.year}-${mockMonth.toString().padStart(2, '0')}-01`).getTime();
              
              timeMap.set(key, { time: key, timestamp, assets: 0, liabilities: 0, netWorth: 0 });
          }
          const group = timeMap.get(key)!;
          if (type === 'assets') group.assets += item.value;
          if (type === 'liabilities') group.liabilities += item.value;
          group.netWorth = group.assets - group.liabilities;
      };

      assets.forEach(item => addToMap(item, 'assets'));
      liabilities.forEach(item => addToMap(item, 'liabilities'));

      const chartData = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);

      if (chartData.length === 0) {
          return (
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm min-h-[300px] flex items-center justify-center">
                  <p className="text-slate-400">No historical data available to generate charts.</p>
              </div>
          );
      }

      return (
          <div className="space-y-8">
              {/* Grouped Bar Chart */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-xl font-bold text-xin-blue mb-6">Assets vs Liabilities & Net Worth</h3>
                  <p className="text-sm text-slate-500 mb-6">Comparing total assets against the sum of liabilities and net worth over time.</p>
                  <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="time" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis 
                                  tickFormatter={(value) => `RM ${value / 1000}k`} 
                                  tick={{ fill: '#64748b' }} 
                                  axisLine={false} 
                                  tickLine={false} 
                              />
                              <Tooltip 
                                  formatter={(value: number) => formatCurrency(value)}
                                  labelFormatter={(label) => `Quarter: ${label}`}
                                  cursor={{ fill: '#f1f5f9' }}
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              />
                              <Legend wrapperStyle={{ paddingTop: '20px' }} />
                              {/* Asset Bar */}
                              <Bar dataKey="assets" name="Assets" fill="#0088FE" radius={[4, 4, 0, 0]} />
                              {/* Stacked Liabilities and Net Worth Bar (Net Worth at bottom, Liabilities on top) */}
                              <Bar dataKey="netWorth" name="Net Worth" stackId="stack" fill="#00C49F" />
                              <Bar dataKey="liabilities" name="Liabilities" stackId="stack" fill="#FF8042" radius={[4, 4, 0, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* Line Chart for Net Worth */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-xl font-bold text-xin-blue mb-6">Net Worth Trend</h3>
                  <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="time" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis 
                                  tickFormatter={(value) => `RM ${value / 1000}k`} 
                                  tick={{ fill: '#64748b' }} 
                                  axisLine={false} 
                                  tickLine={false} 
                                  domain={['auto', 'auto']}
                              />
                              <Tooltip 
                                  formatter={(value: number) => formatCurrency(value)}
                                  labelFormatter={(label) => `Quarter: ${label}`}
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              />
                              <Legend wrapperStyle={{ paddingTop: '20px' }} />
                              <Line 
                                  type="monotone" 
                                  dataKey="netWorth" 
                                  name="Net Worth" 
                                  stroke="#00C49F" 
                                  strokeWidth={3}
                                  dot={{ r: 4, fill: '#00C49F', strokeWidth: 0 }}
                                  activeDot={{ r: 6, strokeWidth: 0 }}
                              />
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-xin-blue animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Calculating Net Worth...</p>
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
            <h2 className="text-3xl font-serif font-bold text-xin-blue mb-2">Net Worth</h2>
            <p className="text-slate-500">View your assets, liabilities, and overall net worth over time.</p>
        </div>
        
        {/* Dropdowns for Assets/Liabilities */}
        {activeTab !== 'networth' && (
            <div className="flex gap-3">
                <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue"
                >
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select 
                    value={selectedQuarter} 
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue"
                >
                    {availableQuarters.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
            </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-slate-200">
        {(['assets', 'liabilities', 'networth'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-colors relative ${
              activeTab === tab ? 'text-xin-blue' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.replace('networth', 'Net Worth')}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-xin-blue rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'networth' ? renderNetWorth() : renderAssetsOrLiabilities()}
      
    </div>
  );
};

export default NetWorth;
