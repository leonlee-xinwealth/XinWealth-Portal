import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth, fetchClientProfile } from '../services/larkService';
import { FinancialHealthData, ClientProfile } from '../types';
import { Loader2, AlertCircle, Gamepad2, Shield, Zap, Heart, Star, Brain, TrendingUp, Sparkles, Sword } from 'lucide-react';

const MovementIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M4 8h4" />
    <path d="M2 12h5" />
    <path d="M5 16h3" />
    <circle cx="16" cy="5" r="2" />
    <path d="M12 10l2-2l3 2l2-1" />
    <path d="M14 8v5l-3 4l-2 4" />
    <path d="M11 17l4 1l1 4" />
  </svg>
);

const Player: React.FC = () => {
  const [healthData, setHealthData] = useState<FinancialHealthData | null>(null);
  const [profileData, setProfileData] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [health, profile] = await Promise.all([
          fetchFinancialHealth(),
          fetchClientProfile()
        ]);
        setHealthData(health);
        setProfileData(profile);
      } catch (err: any) {
        setError(err.message || 'Failed to load player data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-xin-blue animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Loading Player Profile...</p>
      </div>
    );
  }

  if (error || !healthData || !profileData) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-slate-600 font-medium">Unable to load player data</p>
        <p className="text-sm text-slate-400 max-w-md text-center">{error}</p>
      </div>
    );
  }

  const { raw } = healthData;

  // Calculations based on requirements
  // 1) HP (生命值) - Emergency Reserve. Target: 3 months of expenses (default)
  const emergencyTarget = raw.monthlyExpenses * 3;
  const currentEmergency = raw.cashAndFD;
  let hpPercent = emergencyTarget > 0 ? (currentEmergency / emergencyTarget) * 100 : 100;
  hpPercent = Math.min(Math.max(hpPercent, 0), 100);

  // 2) MP (法力值) - Deployable Capital (Liquid assets - Emergency reserve)
  const mpValue = Math.max(raw.cashAndFD - emergencyTarget, 0);
  const netWorth = raw.netWorth;
  let mpPercent = netWorth > 0 ? (mpValue / netWorth) * 100 : 0;
  mpPercent = Math.min(Math.max(mpPercent, 0), 100);

  // 3) ATK (攻击力) - Active Income = Gross Income - Passive Income
  const activeIncome = raw.monthlyGrossIncome - (raw.annualPassiveIncome / 12);
  const atkValue = Math.max(activeIncome, 0);

  // 4) DEF (防御力) - Insurance Coverage
  const defValue = raw.totalSumAssured || 0;

  // 5) INT (智力) - Net Worth Growth Rate
  const intValue = profileData.returnPercentage; // 5% base, 10% standard, 15% excellent
  let intStatus = 'Needs Improvement';
  if (intValue >= 15) intStatus = 'Excellent';
  else if (intValue >= 10) intStatus = 'Standard';
  else if (intValue >= 5) intStatus = 'Baseline';

  // 6) AGI (敏捷) - Liquid Asset / Net Worth
  const agiValue = healthData.liquidAssetToNetWorth * 100;

  // 7) LUK (幸运) - Net Worth / Total Assets
  const lukValue = healthData.solvencyRatio * 100;

  // Formatters
  const formatCurrency = (val: number) => `RM ${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const formatPercent = (val: number) => `${val.toFixed(1)}%`;

  return (
    <div className="animate-fade-in-up pb-10">
      <div className="mb-8">
        <h2 className="text-3xl font-serif font-bold text-xin-blue mb-2 flex items-center gap-3">
          <Gamepad2 className="text-xin-gold" size={32} />
          Player Attributes
        </h2>
        <p className="text-slate-500">Your gamified financial profile. Level up your stats by improving your financial health!</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Player Avatar & Vital Bars (HP/MP) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col items-center relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-xin-gold/5 rounded-bl-full -z-10" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-xin-blue/5 rounded-tr-full -z-10" />

            <div className="w-24 h-24 bg-gradient-to-tr from-xin-blue to-blue-400 rounded-full flex items-center justify-center shadow-lg shadow-xin-blue/30 mb-4 border-4 border-white">
              <span className="text-3xl font-bold text-white">
                {profileData.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-1">{profileData.name}</h3>
            <p className="text-sm font-semibold text-xin-gold mb-8 uppercase tracking-widest">Financial Player</p>

            {/* HP Bar */}
            <div className="w-full space-y-2 mb-6">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <Heart className="text-red-500" size={18} fill="currentColor" />
                  <span className="font-bold text-slate-700">HP (Health)</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-800">{formatCurrency(currentEmergency)}</span>
                </div>
              </div>
              <div className="h-5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner relative flex items-center justify-center">
                <div 
                  className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out ${hpPercent > 50 ? 'bg-green-500' : hpPercent > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${hpPercent}%` }}
                />
                <span className="relative text-[11px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] tracking-wide">
                  {hpPercent.toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-slate-500 text-center">Emergency Reserve</p>
            </div>

            {/* MP Bar */}
            <div className="w-full space-y-2">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <Zap className="text-blue-500" size={18} fill="currentColor" />
                  <span className="font-bold text-slate-700">MP (Mana)</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-800">{formatCurrency(mpValue)}</span>
                </div>
              </div>
              <div className="h-5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner relative flex items-center justify-center">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-blue-500 transition-all duration-1000 ease-out"
                  style={{ width: `${mpPercent}%` }}
                />
                <span className="relative text-[11px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] tracking-wide">
                  {mpPercent.toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-slate-500 text-center">Deployable Capital / Net Worth</p>
            </div>
          </div>
        </div>

        {/* Right Column: Player Stats */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-xin-blue/5 rounded-bl-full -z-10" />
            
            <h3 className="text-xl font-bold text-xin-blue mb-8">Character Stats</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* ATK */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-orange-50/50 border border-orange-100 hover:shadow-md transition-shadow">
                <div className="p-3 bg-orange-100 rounded-xl text-orange-600">
                  <Sword size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">ATK (Attack)</h4>
                  <p className="text-2xl font-bold text-slate-800 mb-1">{formatCurrency(atkValue)}</p>
                  <p className="text-xs text-slate-500">Active Monthly Income. Increases your offensive wealth-building power.</p>
                </div>
              </div>

              {/* DEF */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 hover:shadow-md transition-shadow">
                <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                  <Shield size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">DEF (Defense)</h4>
                  <p className="text-2xl font-bold text-slate-800 mb-1">{formatCurrency(defValue)}</p>
                  <p className="text-xs text-slate-500">Risk Tolerance / Insurance Coverage. Protects you from unexpected critical hits.</p>
                </div>
              </div>

              {/* INT */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-purple-50/50 border border-purple-100 hover:shadow-md transition-shadow">
                <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                  <Brain size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">INT (Intelligence)</h4>
                  <div className="flex items-baseline gap-2 mb-1">
                    <p className="text-2xl font-bold text-slate-800">{formatPercent(intValue)}</p>
                    <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{intStatus}</span>
                  </div>
                  <p className="text-xs text-slate-500">Net Worth Growth Rate. Smart investments increase your INT (Base: 5%, Excellent: 15%+).</p>
                </div>
              </div>

              {/* AGI */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 hover:shadow-md transition-shadow">
                <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                  <MovementIcon size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">AGI (Agility)</h4>
                  <p className="text-2xl font-bold text-slate-800 mb-1">{formatPercent(agiValue)}</p>
                  <p className="text-xs text-slate-500">Liquid Asset to Net Worth. How fast you can mobilize funds in opportunities.</p>
                </div>
              </div>

              {/* LUK */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-yellow-50/50 border border-yellow-100 hover:shadow-md transition-shadow md:col-span-2">
                <div className="p-3 bg-yellow-100 rounded-xl text-yellow-600">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">LUK (Luck)</h4>
                  <div className="flex items-baseline gap-2 mb-1">
                    <p className="text-2xl font-bold text-slate-800">{formatPercent(lukValue)}</p>
                    {lukValue < 50 && (
                      <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Bad Luck</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Solvency Ratio (Net Worth / Total Assets). True wealth percentage. Higher LUK means you truly own your assets.</p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Player;