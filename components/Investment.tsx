import React, { useEffect, useState, useMemo } from 'react';
import {
  Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { fetchPortfolios, computePortfolioMetrics } from '../services/apiService';
import { Portfolio, PortfolioMetrics } from '../types';

// ── Formatting helpers ──

const fmt = (n: number, decimals = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}%`;

const fmtCurrency = (currency: string, n: number, showSign = false) => {
  const sign = showSign && n > 0 ? '+' : '';
  return `${sign}${currency} ${fmt(n)}`;
};

// ── Sub-components ──

const LoadingState = () => (
  <div className="w-full flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-4 animate-pulse">
      <div className="w-16 h-16 rounded-full bg-slate-200" />
      <div className="w-48 h-4 rounded-lg bg-slate-200" />
    </div>
  </div>
);

const EmptyState = () => (
  <div className="w-full flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
      <DollarSign className="text-slate-300" size={32} />
    </div>
    <h3 className="text-xl font-bold text-slate-800 mb-2">No portfolios yet</h3>
    <p className="text-slate-400 text-sm max-w-xs">Your investment portfolios will appear here once your advisor sets them up.</p>
  </div>
);

// ── Main Component ──

const Investment: React.FC = () => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolios()
      .then(data => {
        setPortfolios(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(err => console.error('Failed to load portfolios', err))
      .finally(() => setLoading(false));
  }, []);

  const metricsMap = useMemo(() => {
    const map = new Map<string, PortfolioMetrics>();
    portfolios.forEach(p => map.set(p.id, computePortfolioMetrics(p)));
    return map;
  }, [portfolios]);

  const selected = portfolios.find(p => p.id === selectedId) ?? null;
  const selectedMetrics = selectedId ? metricsMap.get(selectedId) ?? null : null;

  const overviewTotalValue = useMemo(
    () => portfolios.reduce((sum, p) => sum + (metricsMap.get(p.id)?.currentValue ?? 0), 0),
    [metricsMap]
  );
  const overviewFdDiff = useMemo(
    () => portfolios.reduce((sum, p) => sum + (metricsMap.get(p.id)?.fdDiffAbsolute ?? 0), 0),
    [metricsMap]
  );
  const overviewTotalCapital = useMemo(
    () => portfolios.reduce((sum, p) => sum + p.capital_injection, 0),
    [portfolios]
  );
  const overviewReturnPct = overviewTotalCapital > 0
    ? ((overviewTotalValue / overviewTotalCapital) - 1) * 100
    : 0;
  const overviewCurrency = portfolios[0]?.currency ?? 'SGD';

  if (loading) return <LoadingState />;
  if (!portfolios.length) return <EmptyState />;

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">

      {/* ── SECTION 1: Overview Banner ── */}
      <div className="bg-xin-blue rounded-[2.5rem] p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <svg viewBox="0 0 400 200" className="w-full h-full">
            <circle cx="350" cy="50" r="120" fill="white" />
          </svg>
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-xin-gold mb-1">Total Investment Value</p>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight font-serif">
            <span className="text-xin-gold text-2xl font-bold mr-1">{overviewCurrency}</span>
            {fmt(overviewTotalValue)}
          </h2>
          <div className="flex flex-wrap gap-6 mt-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Overall Return</p>
              <p className={`text-lg font-bold ${overviewReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtPct(overviewReturnPct)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">vs FD (3% p.a.)</p>
              <p className={`text-lg font-bold ${overviewFdDiff >= 0 ? 'text-xin-gold' : 'text-red-400'}`}>
                {fmtCurrency(overviewCurrency, overviewFdDiff, true)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Active Portfolios</p>
              <p className="text-lg font-bold">{portfolios.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Portfolio Selector ── */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-3 px-1">My Portfolios</p>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {portfolios.map(p => {
            const m = metricsMap.get(p.id);
            const isActive = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex-shrink-0 w-40 rounded-[1.5rem] p-4 text-left transition-all duration-300 ${
                  isActive
                    ? 'bg-xin-blue text-white shadow-xl'
                    : 'bg-white border border-slate-100 hover:border-xin-gold/50 hover:shadow-md text-xin-blue'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mb-3 ${isActive ? 'bg-xin-gold' : 'bg-slate-200'}`} />
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isActive ? 'text-white/50' : 'text-slate-400'}`}>
                  {p.currency}
                </p>
                <p className={`text-xs font-bold leading-tight mb-2 line-clamp-2 ${isActive ? 'text-white' : 'text-xin-blue'}`}>
                  {p.name}
                </p>
                <p className={`text-base font-black ${isActive ? 'text-xin-gold' : 'text-xin-blue'}`}>
                  {fmt(m?.currentValue ?? 0, 0)}
                </p>
                <p className={`text-xs font-bold mt-1 ${
                  (m?.totalReturnPct ?? 0) >= 0
                    ? isActive ? 'text-green-400' : 'text-green-600'
                    : 'text-red-500'
                }`}>
                  {fmtPct(m?.totalReturnPct ?? 0)} · CAGR {fmt(m?.cagr ?? 0)}%
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 3: Portfolio Detail ── */}
      {selected && selectedMetrics && (
        <PortfolioDetail portfolio={selected} metrics={selectedMetrics} />
      )}
    </div>
  );
};

// ── Portfolio Detail Component ──

interface PortfolioDetailProps {
  portfolio: Portfolio;
  metrics: PortfolioMetrics;
}

const PortfolioDetail: React.FC<PortfolioDetailProps> = ({ portfolio, metrics }) => {
  const { currency, name, capital_injection, injection_date } = portfolio;
  const { currentValue, totalReturnPct, cagr, xirr, twr, fdDiffAbsolute, fdCurrentValue, monthlyData } = metrics;

  const isOutperforming = fdDiffAbsolute >= 0;
  const injectionDateLabel = new Date(injection_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const lastUpdatedLabel = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].label : '-';

  return (
    <div className="space-y-5">

      {/* Info chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Portfolio', value: name },
          { label: 'Started', value: injectionDateLabel },
          { label: 'Capital In', value: `${currency} ${fmt(capital_injection)}` },
          { label: 'Last Updated', value: lastUpdatedLabel },
        ].map(chip => (
          <div key={chip.label} className="bg-white border border-slate-100 rounded-2xl px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{chip.label}</p>
            <p className="text-sm font-bold text-xin-blue mt-0.5">{chip.value}</p>
          </div>
        ))}
      </div>

      {/* Hero Story Card */}
      <div className={`rounded-[2rem] p-7 text-white relative overflow-hidden ${
        isOutperforming
          ? 'bg-gradient-to-br from-xin-blue to-[#163d5e]'
          : 'bg-gradient-to-br from-slate-700 to-slate-800'
      }`}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -mr-8 -mt-8" />
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40 mb-2">
          vs Fixed Deposit @ 3% p.a.
        </p>
        <p className="text-sm text-white/60 mb-2">
          {isOutperforming ? 'Your portfolio is outperforming FD by' : 'Your portfolio is underperforming FD by'}
        </p>
        <p className={`text-4xl font-black tracking-tight ${isOutperforming ? 'text-xin-gold' : 'text-red-400'}`}>
          <span className="text-xl font-bold mr-1">{currency}</span>
          {isOutperforming ? '+' : ''}{fmt(fdDiffAbsolute)}
        </p>
        <p className="text-xs text-white/30 mt-2">
          FD equivalent: {currency} {fmt(fdCurrentValue)} · Portfolio: {currency} {fmt(currentValue)}
        </p>
        <div className={`inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full text-xs font-bold ${
          isOutperforming
            ? 'bg-green-400/15 text-green-400 border border-green-400/25'
            : 'bg-red-400/15 text-red-400 border border-red-400/25'
        }`}>
          {isOutperforming
            ? <><TrendingUp size={12} /> Outperforming as of {lastUpdatedLabel}</>
            : <><TrendingDown size={12} /> Underperforming as of {lastUpdatedLabel}</>}
        </div>
      </div>

      {/* Monthly Timeline */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-3">Monthly Snapshot vs FD</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {monthlyData.map((m, i) => {
            const isLatest = i === monthlyData.length - 1;
            const isFirst = i === 0;
            return (
              <div
                key={m.label}
                className={`flex-shrink-0 min-w-[64px] rounded-2xl p-3 text-center border ${
                  isLatest
                    ? 'bg-white border-xin-gold shadow-md'
                    : 'bg-white border-slate-100'
                }`}
              >
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">{m.label}</p>
                <p className="text-xs font-black text-xin-blue mt-1">
                  {(m.portfolioValue / 1000).toFixed(1)}k
                </p>
                {isFirst ? (
                  <span className="text-[9px] bg-slate-100 text-slate-400 rounded px-1 py-0.5 font-bold mt-1 inline-block">Start</span>
                ) : (
                  <span className={`text-[9px] rounded px-1 py-0.5 font-bold mt-1 inline-block ${
                    m.fdDiff >= 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {m.fdDiff >= 0 ? '+' : ''}{fmt(m.fdDiff, 0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'CAGR', value: `${fmt(cagr)}%`, sub: 'Annualised compound return', dark: true },
          { label: 'XIRR', value: `${fmt(xirr)}%`, sub: 'Money-weighted annualised', dark: true },
          { label: 'TWR', value: `${fmt(twr)}%`, sub: 'Time-weighted return', dark: false },
          { label: 'Total Return', value: fmtPct(totalReturnPct), sub: `${currency} ${fmt(currentValue - capital_injection, 0)} since inception`, dark: false },
        ].map(metric => (
          <div
            key={metric.label}
            className={`rounded-[1.5rem] p-5 ${
              metric.dark
                ? 'bg-xin-blue text-white'
                : 'bg-white border border-slate-100'
            }`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${metric.dark ? 'text-white/40' : 'text-slate-400'}`}>
              {metric.label}
            </p>
            <p className={`text-2xl font-black tracking-tight ${metric.dark ? 'text-xin-gold' : 'text-xin-blue'}`}>
              {metric.value}
            </p>
            <p className={`text-[10px] mt-1.5 ${metric.dark ? 'text-white/25' : 'text-slate-400'}`}>
              {metric.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-xin-blue font-serif">Portfolio vs Fixed Deposit</h3>
            <p className="text-xs text-slate-400">Monthly market value compared to FD @ 3% p.a.</p>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-xin-gold" />
              <span className="text-[10px] font-bold text-xin-blue uppercase tracking-wider">Portfolio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-300" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FD</span>
            </div>
          </div>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d8c195" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#d8c195" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
              <YAxis
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v: number) => `${currency} ${(v / 1000).toFixed(1)}k`}
                width={80}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', borderRadius: 14, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                itemStyle={{ color: '#0c2e4a', fontWeight: 'bold' }}
                formatter={(value: number, name: string) => [
                  `${currency} ${fmt(value)}`,
                  name === 'portfolioValue' ? 'Portfolio' : 'Fixed Deposit'
                ]}
              />
              <Line type="monotone" dataKey="fdValue" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} name="fdValue" />
              <Area type="monotone" dataKey="portfolioValue" stroke="#d8c195" strokeWidth={2.5} fillOpacity={1} fill="url(#portfolioGrad)" name="portfolioValue" dot={{ fill: '#d8c195', r: 4, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default Investment;
