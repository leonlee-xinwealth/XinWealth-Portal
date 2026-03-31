import React, { useState, useEffect, useMemo } from 'react';
import { fetchRawHealthData } from '../services/larkService';
import { Loader2, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

type TabType = 'assets' | 'liabilities' | 'networth';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#f4a261', '#d9ed92'];

// Helpers
const extractValue = (item: any, fields: string[]): number => {
  if (!item || !item.fields) return 0;
  for (const field of fields) {
    if (item.fields[field] !== undefined) {
       let val = item.fields[field];
       
       // Handle arrays (e.g., lookup or formula fields returning arrays)
       if (Array.isArray(val) && val.length > 0) {
           val = val[0];
           if (val && typeof val === 'object' && val.text) val = val.text;
       }
       // Handle objects
       else if (val && typeof val === 'object' && val !== null && val.text) {
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
  if (!item || !item.fields) return defaultValue;
  for (const field of fields) {
    if (item.fields[field] !== undefined) {
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
    // First check specific Quarter/Year fields if any are present from the API or custom logic
    const quarterStr = extractString(item, ["Quarter", "quarter"], "");
    const yearStr = extractString(item, ["Year", "year"], "");
    
    // Then check Date
    const rawDate = item.fields["Date"] || item.fields["date"];

    if (rawDate) {
        const d = new Date(typeof rawDate === 'number' ? rawDate : rawDate);
        if (!isNaN(d.getTime())) {
            return {
                year: d.getFullYear().toString(),
                month: (d.getMonth() + 1).toString().padStart(2, '0'),
                timestamp: d.getTime()
            };
        }
    }

    // If no raw Date, use Year and Month/Quarter
    const monthStr = extractString(item, ["Month", "month"], "");
    
    if (yearStr && monthStr) {
        // Convert month names like "January" to numbers if needed, or assume it's "1"
        const m = parseInt(monthStr, 10);
        let validMonth = "01";
        if (!isNaN(m) && m >= 1 && m <= 12) {
            validMonth = m.toString().padStart(2, '0');
        } else {
            // handle string months if necessary
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

    if (yearStr && quarterStr) {
        // Approximate month from quarter for sorting
        const qNum = parseInt(quarterStr.replace(/[^0-9]/g, '')) || 1;
        const mockMonth = (qNum - 1) * 3 + 1; // Q1 -> 1, Q2 -> 4
        return {
            year: yearStr,
            month: mockMonth.toString().padStart(2, '0'),
            timestamp: new Date(`${yearStr}-${mockMonth.toString().padStart(2, '0')}-01`).getTime()
        }
    }
    
    // If we only have year but no month/quarter/date, default to Jan 1st (Q1)
    if (yearStr) {
        return {
            year: yearStr,
            month: '01',
            timestamp: new Date(`${yearStr}-01-01`).getTime()
        }
    }

    // Return N/A so it doesn't skew current data falsely. 
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
  quarter: string; // 'Q1', 'Q2', 'Q3', 'Q4'
  month: string;   // Keeping month for potential internal sorting/logic if needed
  timestamp: number;
  category: string;
  description: string;
  value: number;
}

const getQuarter = (monthStr: string): string => {
    // If it's already a valid quarter string (Q1, Q2, Q3, Q4), return it directly
    if (monthStr && (monthStr.toUpperCase() === 'Q1' || monthStr.toUpperCase() === 'Q2' || monthStr.toUpperCase() === 'Q3' || monthStr.toUpperCase() === 'Q4')) {
        return monthStr.toUpperCase();
    }
    
    const m = parseInt(monthStr, 10);
    if (isNaN(m)) return 'Q1'; // Default to Q1 instead of N/A to ensure data shows up
    if (m >= 1 && m <= 3) return 'Q1';
    if (m >= 4 && m <= 6) return 'Q2';
    if (m >= 7 && m <= 9) return 'Q3';
    if (m >= 10 && m <= 12) return 'Q4';
    return 'Q1'; // Default fallback
};

const mapRecords = (rawArray: any[], valueFields: string[], defaultCategory?: string): RecordItem[] => {
    return (rawArray || []).map(item => {
      if (!item || !item.fields) {
          return {
            id: Math.random().toString(),
            year: 'N/A',
            month: 'N/A',
            quarter: 'Q1',
            timestamp: 0,
            category: defaultCategory || 'Unknown',
            description: 'Unknown',
            value: 0
          };
      }
      
      const d = parseDate(item);
      // Explicitly check for Quarter field in raw item, otherwise derive from month
      const explicitQuarter = extractString(item, ["Quarter", "quarter"], "");
      const finalQuarter = explicitQuarter ? explicitQuarter.toUpperCase() : getQuarter(d.month);
      
      return {
        id: item.id || Math.random().toString(),
        year: d.year || 'N/A',
        month: d.month || 'N/A',
        quarter: finalQuarter || 'Q1',
        timestamp: d.timestamp || 0,
        category: defaultCategory || extractString(item, ["Category", "category", "Type", "type"]),
        description: extractString(item, ["Description", "description", "Name", "name", "Item", "item", "Fund Name", "fund name", "Investment Name", "investment name"]),
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

  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q1');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchRawHealthData();
        
        const combinedAssets = [
            ...mapRecords(data.assets || [], ["Value", "value", "Amount", "amount"]),
            ...mapRecords(data.investments || [], ["Amount", "amount", "Value", "value", "End Value", "end value"], 'Investment')
        ];
        const parsedLiabilities = mapRecords(data.liabilities || [], ["Outstanding Amount", "outstanding amount", "Amount", "amount", "Value", "value"]);
        
        console.log("Raw Health Data:", data);
        console.log("Combined Assets:", combinedAssets);
        console.log("Parsed Liabilities:", parsedLiabilities);
        
        setAssets(combinedAssets);
        setLiabilities(parsedLiabilities);
        
        // Find latest date for default selection
        let latestYear = '';
        let latestQuarter = '';
        
        [...(combinedAssets || []), ...(parsedLiabilities || [])].forEach(item => {
            if (!item || !item.year || item.year === 'N/A') return;
            const itemYear = item.year;
            const itemQuarter = (item.quarter && item.quarter !== 'N/A') ? item.quarter : 'Q1';
            
            if (itemYear > latestYear) {
                latestYear = itemYear;
                latestQuarter = itemQuarter;
            } else if (itemYear === latestYear && itemQuarter > latestQuarter) {
                latestQuarter = itemQuarter;
            }
        });
        
        if (latestYear) {
            setSelectedYear(latestYear);
            setSelectedQuarter(latestQuarter || 'Q1');
        } else {
            setSelectedYear(new Date().getFullYear().toString());
            setSelectedQuarter('Q1');
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
      try {
          const years = new Set<string>();
          
          // Always collect years from both lists to ensure dropdown has options
          // even if one list is empty for a particular year
          (assets || []).forEach(item => { 
              if (item && item.year && item.year !== 'N/A') years.add(item.year); 
          });
          (liabilities || []).forEach(item => { 
              if (item && item.year && item.year !== 'N/A') years.add(item.year); 
          });
          
          // Only include current year if no data is present at all to avoid confusing UI
          if (years.size === 0) {
              years.add(new Date().getFullYear().toString());
          }
          
          return Array.from(years).sort((a, b) => b.localeCompare(a));
      } catch (err) {
          console.error("Error in availableYears useMemo:", err);
          return [new Date().getFullYear().toString()];
      }
  }, [assets, liabilities]);

  const availableQuarters = useMemo(() => {
      // Return fixed quarters with descriptive names instead of dynamic derivation
      // This ensures we always have these four options regardless of what data was loaded
      return [
          { id: 'Q1', label: 'Q1 (Jan-Mar)' },
          { id: 'Q2', label: 'Q2 (Apr-Jun)' },
          { id: 'Q3', label: 'Q3 (Jul-Sep)' },
          { id: 'Q4', label: 'Q4 (Oct-Dec)' }
      ];
  }, []);

  // Ensure selected quarter is valid when year changes
  useEffect(() => {
      try {
          if (!selectedQuarter) {
              setSelectedQuarter('Q1');
          }
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
  }, [selectedQuarter, selectedYear, availableYears]);


      // Tab 1 & 2: Assets / Liabilities
  const renderAssetsOrLiabilities = () => {
      // Add default values to prevent destructuring errors if useMemo fails or returns undefined somehow
      const { pieData = [], categoryMap = new Map(), totalValue = 0 } = useMemo(() => {
          try {
              const list = activeTab === 'assets' ? (assets || []) : (liabilities || []);
              const filteredList = list.filter(item => {
                  if (!item || !item.year || item.year === 'N/A') return false;
                  const itemQuarter = (item.quarter && item.quarter !== 'N/A') ? item.quarter : 'Q1';
                  return String(item.year) === String(selectedYear) && String(itemQuarter) === String(selectedQuarter);
              });
              
              const catMap = new Map<string, { value: number, items: RecordItem[] }>();
              
              filteredList.forEach(item => {
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
              console.error("Error in useMemo for Assets/Liabilities:", err);
              return { pieData: [], categoryMap: new Map(), totalValue: 0 };
          }
      }, [activeTab, assets, liabilities, selectedYear, selectedQuarter]);

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
      const finalChartData = useMemo(() => {
          try {
              const timeMap = new Map<string, { time: string, timestamp: number, assets: number, liabilities: number, netWorth: number }>();
              
              const addToMap = (item: RecordItem, type: 'assets' | 'liabilities') => {
                  if (!item || !item.year || item.year === 'N/A') return;

                  const itemYear = item.year;
                  const quarter = (item.quarter && item.quarter !== 'N/A') ? item.quarter : 'Q1';
                  
                  const key = `${itemYear} ${quarter}`;
                  if (!timeMap.has(key)) {
                      const qStr = String(quarter).replace(/[^0-9]/g, '');
                      const qNum = parseInt(qStr, 10) || 1;
                      const mockMonth = (qNum - 1) * 3 + 1;
                      const timestamp = new Date(`${itemYear}-${mockMonth.toString().padStart(2, '0')}-01`).getTime();
                      
                      timeMap.set(key, { time: key, timestamp, assets: 0, liabilities: 0, netWorth: 0 });
                  }
                  const group = timeMap.get(key)!;
                  const val = Number(item.value) || 0;
                  if (type === 'assets') group.assets += val;
                  if (type === 'liabilities') group.liabilities += val;
              };

              (assets || []).forEach(item => addToMap(item, 'assets'));
              (liabilities || []).forEach(item => addToMap(item, 'liabilities'));

              const chartData = Array.from(timeMap.values());
              
              chartData.forEach(group => {
                  group.netWorth = group.assets - group.liabilities;
              });

              chartData.sort((a, b) => a.timestamp - b.timestamp);

              return [...chartData];
          } catch (err) {
              console.error("Error in useMemo for NetWorth:", err);
              return [];
          }
      }, [assets, liabilities]);

      if (!finalChartData || finalChartData.length === 0) {
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
                          <BarChart data={finalChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                          <LineChart data={finalChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                    value={selectedYear || ''} 
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue"
                >
                    {(availableYears || []).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select 
                    value={selectedQuarter || ''} 
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue"
                >
                    {(availableQuarters || []).map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
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
