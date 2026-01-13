import React, { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart 
} from 'recharts';
import { ArrowUpRight, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { fetchPortfolioHistory, fetchTransactions, fetchClientProfile } from '../services/larkService';
import { PortfolioDataPoint, Transaction, ClientProfile } from '../types';

const Investment: React.FC = () => {
  const [history, setHistory] = useState<PortfolioDataPoint[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [histData, txData, profileData] = await Promise.all([
          fetchPortfolioHistory(),
          fetchTransactions(),
          fetchClientProfile()
        ]);
        setHistory(histData);
        setTransactions(txData);
        setProfile(profileData);
      } catch (error) {
        console.error("Failed to load investment data", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[60vh]">
         <div className="flex flex-col items-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-slate-200"></div>
            <div className="w-48 h-4 rounded-lg bg-slate-200"></div>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in-up">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-xin-gold mb-2">Overview</p>
          <h2 className="text-4xl lg:text-5xl font-black text-xin-blue tracking-tighter font-serif">
            Investment Portfolio
          </h2>
        </div>
        <div className="text-right hidden md:block">
            <p className="text-sm text-slate-500 mb-1">Last Updated</p>
            <p className="font-bold text-xin-blue">{profile?.lastUpdated}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {/* Total Value Card */}
        <div className="group bg-xin-blue p-8 rounded-[2.5rem] shadow-xl hover:-translate-y-2 transition-transform duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <DollarSign size={120} />
            </div>
            <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
                    <DollarSign className="text-xin-gold" size={24} />
                </div>
                <p className="text-xin-gold text-sm font-bold tracking-widest uppercase mb-2">Total Net Worth</p>
                <h3 className="text-4xl font-bold text-white tracking-tight">
                    ${profile?.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
            </div>
        </div>

        {/* Returns Card */}
        <div className="group bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-[0_20px_40px_-10px_rgba(12,46,74,0.08)] hover:-translate-y-2 transition-all duration-500 border border-slate-50">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-500 transition-colors duration-300">
                <ArrowUpRight className="text-green-600 group-hover:text-white" size={24} />
            </div>
            <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-2">Total Return</p>
            <h3 className="text-4xl font-bold text-xin-blue tracking-tight">
               +${profile?.totalReturn.toLocaleString()}
            </h3>
            <p className="mt-2 text-sm font-bold text-green-600 bg-green-50 inline-block px-3 py-1 rounded-full">
                +{profile?.returnPercentage}% All Time
            </p>
        </div>

         {/* Benchmarking Card (FD Gap) */}
         <div className="group bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-[0_20px_40px_-10px_rgba(12,46,74,0.08)] hover:-translate-y-2 transition-all duration-500 border border-slate-50">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <TrendingUp className="text-slate-400" size={24} />
            </div>
            <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-2">Vs Fixed Deposit</p>
            <h3 className="text-3xl font-bold text-xin-blue tracking-tight">
               Outperforming
            </h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                Your portfolio beat the standard FD rate (3.5%) by a margin of <span className="text-xin-blue font-bold">12.4%</span> this year.
            </p>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="bg-white p-6 lg:p-12 rounded-[2.5rem] lg:rounded-[3.5rem] shadow-sm border border-slate-50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
            <div>
                <h3 className="text-2xl font-bold text-xin-blue mb-2 font-serif">Performance Analysis</h3>
                <p className="text-slate-500">Portfolio Growth vs. Traditional Fixed Deposit</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-xin-gold"></span>
                    <span className="text-xs font-bold text-xin-blue uppercase tracking-wider">Portfolio</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">FD @ 3.5%</span>
                </div>
            </div>
        </div>
        
        <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d8c195" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#d8c195" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        dy={10}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickFormatter={(value) => `$${value/1000}k`}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: '#fff', 
                            borderRadius: '16px', 
                            border: 'none', 
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                        }}
                        itemStyle={{ color: '#0c2e4a', fontWeight: 'bold' }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    />
                    {/* FD Line (Dashed) */}
                    <Line 
                        type="monotone" 
                        dataKey="fdValue" 
                        stroke="#cbd5e1" 
                        strokeWidth={2} 
                        strokeDasharray="5 5" 
                        dot={false}
                        name="Fixed Deposit"
                    />
                    {/* Portfolio Area */}
                    <Area 
                        type="monotone" 
                        dataKey="portfolioValue" 
                        stroke="#d8c195" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorPortfolio)" 
                        name="My Portfolio"
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white p-8 lg:p-12 rounded-[2.5rem] lg:rounded-[3.5rem] shadow-sm border border-slate-50">
        <h3 className="text-2xl font-bold text-xin-blue mb-8 font-serif">Recent Transactions</h3>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-slate-100">
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Asset</th>
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {transactions.map((tx) => (
                        <tr key={tx.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                            <td className="py-6 px-4 font-medium text-slate-600">{tx.date}</td>
                            <td className="py-6 px-4 font-bold text-xin-blue">{tx.type}</td>
                            <td className="py-6 px-4 text-slate-600">{tx.asset}</td>
                            <td className={`py-6 px-4 text-right font-bold ${['Withdrawal', 'Sell'].includes(tx.type) ? 'text-slate-400' : 'text-xin-blue'}`}>
                                {['Withdrawal', 'Sell'].includes(tx.type) ? '-' : '+'}${tx.amount.toLocaleString()}
                            </td>
                            <td className="py-6 px-4 text-center">
                                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-600">
                                    {tx.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        
        <div className="mt-8 text-center">
            <button className="text-xin-gold font-bold text-sm tracking-widest uppercase hover:text-xin-blue transition-colors">
                View All History
            </button>
        </div>
      </div>

    </div>
  );
};

export default Investment;