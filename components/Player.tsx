import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth, fetchClientProfile } from '../services/larkService';
import { getSession } from '../services/larkService';
import { FinancialHealthData, ClientProfile } from '../types';
import { Loader2, AlertCircle, Gamepad2, Shield, Zap, Heart, Star, Brain, TrendingUp, Sparkles, Sword, Coins, User } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'stats' | 'info'>('stats');

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

  // Session Data for JOB
  const session = getSession();
  const occupation = session?.occupation || 'None';
  const title = 'Wealth Awakener';

  // Formatters
  const formatCurrency = (val: number) => `RM ${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const formatPercent = (val: number) => `${val.toFixed(1)}%`;

  const InfoRow = ({ label, value }: { label: string, value?: string | number }) => (
    <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-slate-100 last:border-0 gap-1">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value || '-'}</span>
    </div>
  );

  return (
    <div className="animate-fade-in-up pb-10">
      <div className="mb-8">
        <h2 className="text-3xl font-serif font-bold text-xin-blue mb-2 flex items-center gap-3">
          <Gamepad2 className="text-xin-gold" size={32} />
          Player Attributes
        </h2>
        <p className="text-slate-500">Your gamified financial profile. Level up your stats by improving your financial health!</p>
      </div>

      <div className="flex gap-4 mb-8 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('stats')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-colors relative flex items-center gap-2 ${
            activeTab === 'stats' ? 'text-xin-blue' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Gamepad2 size={16} />
          Attributes
          {activeTab === 'stats' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-xin-blue rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-colors relative flex items-center gap-2 ${
            activeTab === 'info' ? 'text-xin-blue' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <User size={16} />
          Player Info
          {activeTab === 'info' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-xin-blue rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'stats' ? (
        <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 border border-slate-100 shadow-xl relative overflow-hidden">
          {/* Decorators */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-xin-blue via-xin-gold to-xin-blue" />
        
        {/* Top Section */}
        <div className="flex flex-col items-center mb-10">
          <div className="border border-xin-blue/20 px-10 py-2 rounded-full mb-6 tracking-[0.2em] font-bold text-xin-blue uppercase text-sm">
            STATUS
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
            {/* Level */}
            <div className="text-center">
              <span className="text-6xl font-bold text-xin-blue drop-shadow-sm block leading-none">1</span>
              <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">Level</span>
            </div>
            
            {/* Job and Title */}
            <div className="space-y-3 md:border-l-2 border-slate-100 md:pl-8 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <span className="text-xs font-bold text-slate-400 tracking-widest uppercase w-12 text-right md:text-left">Job</span>
                <span className="text-lg font-bold text-slate-700">{occupation}</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-3">
                <span className="text-xs font-bold text-slate-400 tracking-widest uppercase w-12 text-right md:text-left">Title</span>
                <span className="text-lg font-bold text-xin-gold">{title}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Box: HP & Gold */}
        <div className="border-2 border-slate-100 rounded-2xl p-6 mb-8 flex flex-col md:flex-row justify-around items-center gap-8 bg-slate-50/50">
          {/* HP Bar */}
          <div className="w-full max-w-sm flex items-center gap-4">
            <div className="flex flex-col items-center">
              <Heart className="text-red-500" size={28} fill="currentColor" />
              <span className="text-[10px] font-bold text-slate-500 mt-1">HP</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-bold text-slate-500">Emergency</span>
                <span className="text-xs font-bold text-slate-700">{formatCurrency(currentEmergency)} / {formatCurrency(emergencyTarget)}</span>
              </div>
              <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner relative flex items-center justify-center">
                <div 
                  className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out ${hpPercent > 50 ? 'bg-green-500' : hpPercent > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${hpPercent}%` }}
                />
                <span className="relative text-[10px] font-bold text-white drop-shadow-md">
                  {hpPercent.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="hidden md:block w-px h-16 bg-slate-200" />

          {/* Gold Value */}
          <div className="w-full max-w-sm flex items-center gap-4 md:justify-center">
            <div className="flex flex-col items-center">
              <Coins className="text-yellow-500" size={28} fill="currentColor" />
              <span className="text-[10px] font-bold text-slate-500 mt-1">GOLD</span>
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-2xl font-bold text-slate-800">{formatCurrency(mpValue)}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Deployable Capital</span>
            </div>
          </div>
        </div>

        {/* Bottom Box: Stats Grid */}
        <div className="border-2 border-slate-100 rounded-2xl p-8 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
            {/* Col 1 */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sword className="text-orange-500" size={24} />
                  <span className="font-bold text-slate-600 tracking-wider">ATK</span>
                </div>
                <span className="text-xl font-bold text-slate-800">{formatCurrency(atkValue)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MovementIcon className="text-emerald-500" size={24} />
                  <span className="font-bold text-slate-600 tracking-wider">AGI</span>
                </div>
                <span className="text-xl font-bold text-slate-800">{formatPercent(agiValue)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="text-yellow-500" size={24} />
                  <span className="font-bold text-slate-600 tracking-wider">LUK</span>
                </div>
                <div className="flex items-center gap-2">
                  {lukValue < 50 && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">Bad Luck</span>
                  )}
                  <span className="text-xl font-bold text-slate-800">{formatPercent(lukValue)}</span>
                </div>
              </div>
            </div>

            {/* Col 2 */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="text-indigo-500" size={24} />
                  <span className="font-bold text-slate-600 tracking-wider">DEF</span>
                </div>
                <span className="text-xl font-bold text-slate-800">{formatCurrency(defValue)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Brain className="text-purple-500" size={24} />
                  <span className="font-bold text-slate-600 tracking-wider">INT</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full uppercase">{intStatus}</span>
                  <span className="text-xl font-bold text-slate-800">{formatPercent(intValue)}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 mt-2">
                <span className="text-sm font-bold text-slate-500">Available Points</span>
                <span className="text-2xl font-bold text-xin-blue">0</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 border border-slate-100 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-xin-blue/5 rounded-bl-full -z-10" />
          
          <h3 className="text-xl font-bold text-xin-blue mb-8">Personal Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {/* Basic Info */}
            <div className="space-y-1 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <h4 className="text-xs font-bold text-xin-gold uppercase tracking-widest mb-4">Identity</h4>
              <InfoRow label="Family Name" value={session?.familyName} />
              <InfoRow label="Given Name" value={session?.givenName} />
              <InfoRow label="NRIC" value={session?.nric} />
              <InfoRow label="Date of Birth" value={session?.dob} />
              <InfoRow label="Age" value={session?.currentAge} />
              <InfoRow label="Gender" value={session?.gender} />
              <InfoRow label="Marital Status" value={session?.maritalStatus} />
              <InfoRow label="Nationality" value={session?.nationality} />
              <InfoRow label="Residency" value={session?.residency} />
            </div>

            {/* Financial & Contact Info */}
            <div className="space-y-6">
              <div className="space-y-1 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-bold text-xin-gold uppercase tracking-widest mb-4">Accounts</h4>
                <InfoRow label="EPF Account Number" value={session?.epfAccountNumber} />
                <InfoRow label="PPA Account Number" value={session?.ppaAccountNumber} />
              </div>
              
              <div className="space-y-1 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-bold text-xin-gold uppercase tracking-widest mb-4">Contact</h4>
                <InfoRow label="Correspondence Address" value={session?.correspodenceAddress} />
                <InfoRow label="Postal Code" value={session?.correspodencePostalCode} />
                <InfoRow label="City" value={session?.correspodenceCity} />
                <InfoRow label="State" value={session?.correspodenceState} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Player;