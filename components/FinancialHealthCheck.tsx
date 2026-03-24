import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth } from '../services/larkService';
import { FinancialHealthData } from '../types';
import { Activity, AlertCircle, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const FinancialHealthCheck: React.FC = () => {
  const [data, setData] = useState<FinancialHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const healthData = await fetchFinancialHealth();
        setData(healthData);
      } catch (err: any) {
        setError(err.message || 'Failed to load financial health data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getStatus = (ratioId: string, value: number) => {
    switch (ratioId) {
      case 'basicLiquidityRatio':
        if (value >= 6) return { label: '健康', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 };
        if (value >= 3) return { label: '正常', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: AlertTriangle };
        return { label: '危险', color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle };
      case 'liquidAssetToNetWorth':
        if (value >= 0.15 && value <= 0.20) return { label: '理想', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 };
        if (value > 0.20) return { label: '资金闲置', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: AlertTriangle };
        return { label: '风险大', color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle };
      case 'solvencyRatio':
        if (value > 0.5) return { label: '良好', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 };
        return { label: '危险', color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle };
      case 'debtServiceRatio':
        if (value < 0.35) return { label: '优秀', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 };
        if (value <= 0.50) return { label: '可接受', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: AlertTriangle };
        return { label: '危险', color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle };
      case 'nonMortgageDSR':
        if (value < 0.15) return { label: '良好', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 };
        return { label: '较差', color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle };
      case 'lifeInsuranceCoverage':
        if (value > 10) return { label: '充足', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 };
        return { label: '不足', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: AlertTriangle };
      case 'savingsRatio':
        if (value > 0.2) return { label: '优秀', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 };
        return { label: '需提升', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: AlertTriangle };
      case 'investAssetsToNetWorth':
        if (value > 0.5) return { label: '良好', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 };
        return { label: '偏低', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: AlertTriangle };
      case 'passiveIncomeCoverage':
        if (value > 1) return { label: '财务自由', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 };
        if (value > 0.5) return { label: '财务安全', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: AlertTriangle };
        return { label: '需提升', color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle };
      default:
        return { label: '-', color: 'text-gray-500', bg: 'bg-gray-50', icon: Activity };
    }
  };

  const formatValue = (id: string, value: number) => {
    if (isNaN(value) || !isFinite(value)) return '0.0';
    if (id === 'basicLiquidityRatio') {
      return value.toFixed(1) + ' 个月';
    }
    if (id === 'lifeInsuranceCoverage') {
      return value.toFixed(1) + ' 倍';
    }
    return (value * 100).toFixed(1) + '%';
  };

  const categories = [
    {
      name: '流动性 (Liquidity)',
      items: [
        { id: 'basicLiquidityRatio', name: 'Basic Liquidity Ratio (基本流动比率/紧急备用金)', formula: '(Cash + FD) / Monthly Expenses', benchmark: '3 - 6 个月(自雇人士建议 6-12 个月)' },
        { id: 'liquidAssetToNetWorth', name: 'Liquid Asset to Net Worth (流动资产净值比)', formula: '(Cash + FD) / Net Worth', benchmark: '15% - 20%(过低风险大，过高则资金闲置)' }
      ]
    },
    {
      name: '债务管理 (Debt Mgmt)',
      items: [
        { id: 'solvencyRatio', name: 'Solvency Ratio (偿付比率)', formula: 'Net Worth / Total Assets', benchmark: '> 50%(说明你拥有资产的一半以上，而非银行拥有)' },
        { id: 'debtServiceRatio', name: 'Debt Service Ratio (DSR) (总偿债比率)', formula: 'Total Monthly Debt Repayment / Monthly Net Income', benchmark: '< 35% (优秀) < 50% (可接受) > 50% (危险)' },
        { id: 'nonMortgageDSR', name: 'Non-Mortgage DSR (非房贷偿债比率)', formula: 'Consumer Debt Repayment / Monthly Net Income', benchmark: '< 15%(越低越好，这通常是恶性债务)' }
      ]
    },
    {
      name: '风险保障 (Protection)',
      items: [
        { id: 'lifeInsuranceCoverage', name: 'Life Insurance Coverage (寿险保障倍数)', formula: 'Total Sum Assured / Annual Income', benchmark: '> 10 倍(确保家庭 10 年的生活开销)' }
      ]
    },
    {
      name: '财富积累 (Growth)',
      items: [
        { id: 'savingsRatio', name: 'Savings Ratio (储蓄率)', formula: 'Monthly Savings / Monthly Gross Income', benchmark: '> 20%(越高代表积累财富速度越快)' },
        { id: 'investAssetsToNetWorth', name: 'Invest. Assets to Net Worth (投资资产占比)', formula: 'Investment Assets / Net Worth', benchmark: '> 50%(随年龄增长应逐渐提高)' },
        { id: 'passiveIncomeCoverage', name: 'Passive Income Coverage (被动收入覆盖率)', formula: 'Annual Passive Income / Annual Expenses', benchmark: '> 100% = 财务自由 > 50% = 财务安全' }
      ]
    }
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-xin-blue animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Calculating your financial health...</p>
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
        <h2 className="text-3xl font-serif font-bold text-xin-blue mb-2">Financial Health Check</h2>
        <p className="text-slate-500">Based on your submitted KYC data, here is an analysis of your financial health.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 font-semibold text-slate-600 text-sm w-1/5">类别</th>
                <th className="p-4 font-semibold text-slate-600 text-sm w-1/4">关键指标 (Key Ratio)</th>
                <th className="p-4 font-semibold text-slate-600 text-sm w-1/4">计算公式 (Formula)</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">健康基准参考 (Benchmark)</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-center">你的状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((category, catIndex) => (
                <React.Fragment key={catIndex}>
                  {category.items.map((item, itemIndex) => {
                    const val = data ? data[item.id as keyof FinancialHealthData] : 0;
                    const status = getStatus(item.id, val);
                    const StatusIcon = status.icon;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        {itemIndex === 0 && (
                          <td 
                            rowSpan={category.items.length} 
                            className="p-4 font-bold text-xin-blue align-top bg-slate-50/30 border-r border-slate-100"
                          >
                            {category.name}
                          </td>
                        )}
                        <td className="p-4">
                          <span className="font-medium text-slate-700 block">{item.name.split('(')[0]}</span>
                          <span className="text-xs text-slate-500 block">({item.name.split('(')[1]}</span>
                        </td>
                        <td className="p-4 text-sm text-slate-600 font-mono bg-slate-50/30">
                          {item.formula}
                        </td>
                        <td className="p-4 text-sm text-slate-600">
                          {item.benchmark}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <span className="font-bold text-lg text-slate-700">
                              {formatValue(item.id, val)}
                            </span>
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${status.bg} ${status.color}`}>
                              <StatusIcon size={14} strokeWidth={2.5} />
                              {status.label}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinancialHealthCheck;
