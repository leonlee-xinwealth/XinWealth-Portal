import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth } from '../services/larkService';
import { FinancialHealthData } from '../types';
import { Car, Home, Loader2, AlertCircle, TrendingUp, Info } from 'lucide-react';

type GoalType = 'car' | 'house';

const FinancialGoal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GoalType>('car');
  const [healthData, setHealthData] = useState<FinancialHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Car State
  const [carModel, setCarModel] = useState('');
  const [carPrice, setCarPrice] = useState<number | ''>('');
  const [carDownpaymentPercent, setCarDownpaymentPercent] = useState<number | ''>(10);
  const [carInterestRate, setCarInterestRate] = useState<number | ''>(3.0);
  const [carLoanTenure, setCarLoanTenure] = useState<number | ''>(9);
  const [carOtherFees, setCarOtherFees] = useState<number | ''>('');
  const [carYearsToGoal, setCarYearsToGoal] = useState<number | ''>(1);
  const [carCurrentSavings, setCarCurrentSavings] = useState<number | ''>('');

  // House State
  const [houseType, setHouseType] = useState('');
  const [housePrice, setHousePrice] = useState<number | ''>('');
  const [houseDownpaymentPercent, setHouseDownpaymentPercent] = useState<number | ''>(10);
  const [houseInterestRate, setHouseInterestRate] = useState<number | ''>(4.0);
  const [houseLoanTenure, setHouseLoanTenure] = useState<number | ''>(35);
  const [houseOtherFees, setHouseOtherFees] = useState<number | ''>('');
  const [houseYearsToGoal, setHouseYearsToGoal] = useState<number | ''>(3);
  const [houseCurrentSavings, setHouseCurrentSavings] = useState<number | ''>('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchFinancialHealth();
        setHealthData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load financial data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Car Calculations
  const calculateCar = () => {
    const price = Number(carPrice) || 0;
    const dpPercent = Number(carDownpaymentPercent) || 0;
    const rate = Number(carInterestRate) || 0;
    const tenure = Number(carLoanTenure) || 0;
    const fees = Number(carOtherFees) || 0;
    const savings = Number(carCurrentSavings) || 0;
    const years = Number(carYearsToGoal) || 1;

    const dpAmount = price * (dpPercent / 100);
    const loanAmount = price - dpAmount;
    
    // EIR Calculation
    const annualEIR = rate / 100;
    const monthlyRate = Math.pow(1 + annualEIR, 1 / 12) - 1;
    const totalMonths = tenure * 12;
    
    let monthlyInstallment = 0;
    if (monthlyRate > 0 && totalMonths > 0) {
      monthlyInstallment = loanAmount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -totalMonths)));
    } else if (totalMonths > 0) {
      monthlyInstallment = loanAmount / totalMonths;
    }

    const requiredFunds = dpAmount + fees;
    const shortfall = Math.max(0, requiredFunds - savings);
    const monthlySavingsNeeded = years > 0 ? shortfall / (years * 12) : 0;

    let currentDSR = 0;
    let newDSR = 0;
    let requiredIncome = 0;

    if (healthData && healthData.raw.monthlyNetIncome > 0) {
      currentDSR = (healthData.raw.totalMonthlyDebtRepayment / healthData.raw.monthlyNetIncome) * 100;
      newDSR = ((healthData.raw.totalMonthlyDebtRepayment + monthlyInstallment) / healthData.raw.monthlyNetIncome) * 100;
    }
    
    // To keep Car DSR <= 15%
    requiredIncome = monthlyInstallment / 0.15;

    return {
      monthlyInstallment,
      requiredFunds,
      monthlySavingsNeeded,
      currentDSR,
      newDSR,
      requiredIncome
    };
  };

  // House Calculations
  const calculateHouse = () => {
    const price = Number(housePrice) || 0;
    const dpPercent = Number(houseDownpaymentPercent) || 0;
    const rate = Number(houseInterestRate) || 0;
    const tenure = Number(houseLoanTenure) || 0;
    const fees = Number(houseOtherFees) || 0;
    const savings = Number(houseCurrentSavings) || 0;
    const years = Number(houseYearsToGoal) || 1;

    const dpAmount = price * (dpPercent / 100);
    const loanAmount = price - dpAmount;
    
    // Reducing balance calculation
    const monthlyRate = (rate / 100) / 12;
    const totalMonths = tenure * 12;
    let monthlyInstallment = 0;
    
    if (monthlyRate > 0 && totalMonths > 0) {
      monthlyInstallment = loanAmount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -totalMonths)));
    } else if (totalMonths > 0) {
      monthlyInstallment = loanAmount / totalMonths;
    }

    const requiredFunds = dpAmount + fees;
    const shortfall = Math.max(0, requiredFunds - savings);
    const monthlySavingsNeeded = years > 0 ? shortfall / (years * 12) : 0;

    let currentDSR = 0;
    let newDSR = 0;
    let requiredIncome = 0;

    if (healthData && healthData.raw.monthlyNetIncome > 0) {
      currentDSR = (healthData.raw.totalMonthlyDebtRepayment / healthData.raw.monthlyNetIncome) * 100;
      newDSR = ((healthData.raw.totalMonthlyDebtRepayment + monthlyInstallment) / healthData.raw.monthlyNetIncome) * 100;
    }

    // To keep House DSR <= 25%
    requiredIncome = monthlyInstallment / 0.25;

    return {
      monthlyInstallment,
      requiredFunds,
      monthlySavingsNeeded,
      currentDSR,
      newDSR,
      requiredIncome
    };
  };

  const carResult = calculateCar();
  const houseResult = calculateHouse();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-xin-blue animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Loading financial data...</p>
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
        <h2 className="text-3xl font-serif font-bold text-xin-blue mb-2">Financial Goal Calculator</h2>
        <p className="text-slate-500">Plan and calculate the requirements to achieve your financial goals.</p>
      </div>

      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setActiveTab('car')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            activeTab === 'car'
              ? 'bg-xin-blue text-white shadow-lg shadow-xin-blue/20'
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'
          }`}
        >
          <Car size={20} />
          买车 (Buy Car)
        </button>
        <button
          onClick={() => setActiveTab('house')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            activeTab === 'house'
              ? 'bg-xin-blue text-white shadow-lg shadow-xin-blue/20'
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'
          }`}
        >
          <Home size={20} />
          买房 (Buy House)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-xin-blue mb-6 border-b border-slate-100 pb-4">
            {activeTab === 'car' ? '输入车辆信息' : '输入房屋信息'}
          </h3>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {activeTab === 'car' ? '车的款式 (Model)' : '房子的款式 (Property Type)'}
              </label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue transition-all"
                value={activeTab === 'car' ? carModel : houseType}
                onChange={(e) => activeTab === 'car' ? setCarModel(e.target.value) : setHouseType(e.target.value)}
                placeholder={activeTab === 'car' ? 'e.g. Honda Civic' : 'e.g. Condominium'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">售价 (Price) RM</label>
                <input
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue transition-all"
                  value={activeTab === 'car' ? carPrice : housePrice}
                  onChange={(e) => activeTab === 'car' ? setCarPrice(Number(e.target.value)) : setHousePrice(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">首付比例 (Downpayment) %</label>
                <input
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue transition-all"
                  value={activeTab === 'car' ? carDownpaymentPercent : houseDownpaymentPercent}
                  onChange={(e) => activeTab === 'car' ? setCarDownpaymentPercent(Number(e.target.value)) : setHouseDownpaymentPercent(Number(e.target.value))}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {activeTab === 'car' ? '年实际利率 (EIR) %' : '贷款利率 (Interest Rate) %'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue transition-all"
                  value={activeTab === 'car' ? carInterestRate : houseInterestRate}
                  onChange={(e) => activeTab === 'car' ? setCarInterestRate(Number(e.target.value)) : setHouseInterestRate(Number(e.target.value))}
                  placeholder={activeTab === 'car' ? "3.0" : "4.0"}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">贷款年限 (Tenure) 年</label>
                <input
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue transition-all"
                  value={activeTab === 'car' ? carLoanTenure : houseLoanTenure}
                  onChange={(e) => activeTab === 'car' ? setCarLoanTenure(Number(e.target.value)) : setHouseLoanTenure(Number(e.target.value))}
                  placeholder={activeTab === 'car' ? "9" : "35"}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {activeTab === 'car' ? '其他费用 (车险/车牌/隔热膜等) RM' : '其他费用 (MRTA/房屋保险/装修等) RM'}
              </label>
              <input
                type="number"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue transition-all"
                value={activeTab === 'car' ? carOtherFees : houseOtherFees}
                onChange={(e) => activeTab === 'car' ? setCarOtherFees(Number(e.target.value)) : setHouseOtherFees(Number(e.target.value))}
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">准备多少年达成目标？ (Years)</label>
                <input
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue transition-all"
                  value={activeTab === 'car' ? carYearsToGoal : houseYearsToGoal}
                  onChange={(e) => activeTab === 'car' ? setCarYearsToGoal(Number(e.target.value)) : setHouseYearsToGoal(Number(e.target.value))}
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">已准备资金 (Current Savings) RM</label>
                <input
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-xin-blue/20 focus:border-xin-blue transition-all"
                  value={activeTab === 'car' ? carCurrentSavings : houseCurrentSavings}
                  onChange={(e) => activeTab === 'car' ? setCarCurrentSavings(Number(e.target.value)) : setHouseCurrentSavings(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-xin-blue/5 rounded-bl-full -z-10" />
            
            <h3 className="text-xl font-bold text-xin-blue mb-6 border-b border-slate-100 pb-4">计算结果</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">每月供期 (Monthly Installment)</p>
                    <p className="text-xs text-slate-400">
                      {activeTab === 'car' ? '等额本息计算 (EIR)' : '复利计算 (Reducing Balance)'}
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(activeTab === 'car' ? carResult.monthlyInstallment : houseResult.monthlyInstallment)}
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                    <Car size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">需要准备的资金 (Required Funds)</p>
                    <p className="text-xs text-slate-400">首付 + 其他费用</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(activeTab === 'car' ? carResult.requiredFunds : houseResult.requiredFunds)}
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Info size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">DSR 变化预估 (DSR Impact)</p>
                    <p className="text-xs text-slate-400">目前总DSR: {(activeTab === 'car' ? carResult.currentDSR : houseResult.currentDSR).toFixed(1)}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-800">
                    {(activeTab === 'car' ? carResult.newDSR : houseResult.newDSR).toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500">购买后预计</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-xin-blue to-slate-800 rounded-3xl p-8 shadow-lg text-white">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-xin-gold">✨</span> 财务推荐 (Recommendation)
            </h3>
            
            <div className="space-y-4">
              <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                <p className="text-sm text-slate-300 mb-1">为了让这个目标的供期不超过您收入的 {activeTab === 'car' ? '15%' : '25%'}，您需要的每月净收入为：</p>
                <p className="text-3xl font-bold text-xin-gold">
                  {formatCurrency(activeTab === 'car' ? carResult.requiredIncome : houseResult.requiredIncome)}
                </p>
                {healthData && healthData.raw.monthlyNetIncome > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    *您目前的每月净收入为 {formatCurrency(healthData.raw.monthlyNetIncome)}
                  </p>
                )}
              </div>

              <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                <p className="text-sm text-slate-300 mb-1">为了在 {(activeTab === 'car' ? carYearsToGoal : houseYearsToGoal) || 0} 年内达成目标，您每月需要储蓄：</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(activeTab === 'car' ? carResult.monthlySavingsNeeded : houseResult.monthlySavingsNeeded)}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  *基于剩余所需资金 {formatCurrency(Math.max(0, (activeTab === 'car' ? carResult.requiredFunds : houseResult.requiredFunds) - Number(activeTab === 'car' ? carCurrentSavings : houseCurrentSavings)))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialGoal;