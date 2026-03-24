import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth } from '../services/larkService';
import { FinancialHealthData } from '../types';
import { Activity, AlertCircle, CheckCircle2, AlertTriangle, Loader2, Info } from 'lucide-react';

const Tooltip: React.FC<{ title: string; content: React.ReactNode }> = ({ title, content }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-flex items-center gap-1 cursor-help group"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <span className="font-medium text-slate-700 underline decoration-slate-300 decoration-dashed underline-offset-4">{title}</span>
      <Info size={14} className="text-slate-400 group-hover:text-xin-blue transition-colors" />
      
      {isVisible && (
        <div className="absolute z-50 w-80 p-4 bg-white rounded-xl shadow-xl border border-slate-100 text-sm left-0 bottom-full mb-2 animate-fade-in-up">
          {content}
          <div className="absolute -bottom-2 left-4 w-4 h-4 bg-white border-b border-r border-slate-100 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getCalculationDetail = (id: string, raw?: FinancialHealthData['raw']) => {
    if (!raw) return null;
    
    switch (id) {
      case 'basicLiquidityRatio':
        return `(${formatCurrency(raw.cashAndFD)}) / ${formatCurrency(raw.monthlyExpenses)}`;
      case 'liquidAssetToNetWorth':
        return `(${formatCurrency(raw.cashAndFD)}) / ${formatCurrency(raw.netWorth)}`;
      case 'solvencyRatio':
        return `${formatCurrency(raw.netWorth)} / ${formatCurrency(raw.totalAssets)}`;
      case 'debtServiceRatio':
        return `${formatCurrency(raw.totalMonthlyDebtRepayment)} / ${formatCurrency(raw.monthlyNetIncome)}`;
      case 'nonMortgageDSR':
        return `${formatCurrency(raw.consumerDebtRepayment)} / ${formatCurrency(raw.monthlyNetIncome)}`;
      case 'lifeInsuranceCoverage':
        return `${formatCurrency(raw.totalSumAssured)} / ${formatCurrency(raw.annualIncome)}`;
      case 'savingsRatio':
        return `${formatCurrency(raw.monthlySavings)} / ${formatCurrency(raw.monthlyGrossIncome)}`;
      case 'investAssetsToNetWorth':
        return `${formatCurrency(raw.investmentAssets)} / ${formatCurrency(raw.netWorth)}`;
      case 'passiveIncomeCoverage':
        return `${formatCurrency(raw.annualPassiveIncome)} / ${formatCurrency(raw.annualExpenses)}`;
      default:
        return '';
    }
  };

  const tooltips: Record<string, React.ReactNode> = {
    'basicLiquidityRatio': (
      <div className="space-y-2">
        <p><strong className="text-xin-blue">指标含义：</strong> 衡量您手头的现金和定存，能够支撑家庭几个月的日常开销。</p>
        <p><strong className="text-xin-blue">为何重要：</strong> 它最重要的作用，是在突发事件发生时维持基本生活，避免因为短期现金流断裂而陷入财务危机。</p>
        <p className="text-slate-500 text-xs">没有足够备用金时，人往往会被迫借贷，或者在不理想的时点卖出股票、基金等长期投资，从而扩大损失或陷入债务循环。<br/><br/>反过来，足够的备用金会把“意外支出”和“长期投资计划”隔开，让你的投资更稳定、更能坚持下去。<br/><br/>同时，作为企业家，保持6至12个月的充足备用金，能让您在面对生意寒冬、客户拖欠账款等突发状况时，无需为了应付个人生活费而做出仓促、妥协的商业决策。</p>
      </div>
    ),
    'liquidAssetToNetWorth': (
      <div className="space-y-2">
        <p><strong className="text-xin-blue">指标含义：</strong> 检查您的个人总净值中，有多少是可以随时变现的“活钱”。</p>
        <p><strong className="text-xin-blue">为何重要：</strong></p>
        <ul className="list-disc pl-4 text-xs text-slate-500 space-y-1">
          <li>第一，它反映你应付短期财务义务和突发开支的能力；这个比率越高，通常代表短期财务安全垫越强。</li>
          <li>第二，它能减少你在紧急时刻被迫借高息债务，或在不合适的时间卖出长期投资的概率。</li>
          <li>第三，它能帮助你识别自己是否处于“富有的穷人”（asset rich, cash poor）的状态，也就是账面上有钱，但实际可用现金不足。</li>
        </ul>
        <p className="text-slate-500 text-xs mt-2">尤其是会把资金全压在公司库存、厂房或名下的房地产上的企业家，保持 15% - 20% 的流动比例，能确保您在急需资金时，不必忍痛“贱卖”资产。</p>
      </div>
    ),
    'solvencyRatio': (
      <div className="space-y-2">
        <p><strong className="text-xin-blue">指标含义：</strong> 衡量如果变卖所有个人资产并还清所有债务后，您真正拥有的财富比例。</p>
        <p><strong className="text-xin-blue">为何重要：</strong></p>
        <ul className="list-disc pl-4 text-xs text-slate-500 space-y-1">
          <li>第一，它能帮助你判断自己是否借太多钱，因为负债占资产越高，越容易出现偿付问题。</li>
          <li>第二，它能反映长期财务安全性；如果你已经有房贷，再继续增加车贷或个人贷款，负债会上升，偿付压力也会变大。</li>
          <li>第三，它能作为人生不同阶段的财务体检指标，帮助你安排有限资源，到底该先还债、留现金，还是再投资。</li>
        </ul>
        <p className="text-slate-500 text-xs mt-2">中小企业老板通常需要为公司贷款签署“个人担保 (Personal Guarantee)”。这个指标能检视您的个人财务护城河有多深。如果比率太低（低于 50%），意味着一旦公司出现债务危机，极容易波及个人和家庭资产。</p>
      </div>
    ),
    'debtServiceRatio': (
      <div className="space-y-2">
        <p><strong className="text-xin-blue">指标含义：</strong> 衡量您每个月的个人净收入中，有多少比例被拿去还银行贷款。</p>
        <p><strong className="text-xin-blue">为何重要：</strong></p>
        <ul className="list-disc pl-4 text-xs text-slate-500 space-y-1">
          <li>第一、贷款申请的关键门槛：马来西亚银行以 DSR 作为评估贷款资格的核心因素，多数要求 DSR 低于 60%。</li>
          <li>第二、反映财务健康状态：DSR 越低，代表可支配收入越多，财务缓冲能力越强；过高则现金流紧绷。</li>
          <li>第三、破产风险预警：面临利率上升或失业时，高 DSR 借款人破产风险极高。</li>
          <li>第四、影响退休规划：长期高 DSR 会压缩投资与储蓄空间。</li>
          <li>第五、影响信用评分：DSR 越高，贷款被拒概率越大。</li>
        </ul>
        <p className="text-slate-500 text-xs mt-2">哪怕身为企业家的您是为了公司垫资而增加的个人贷款，银行看 CCRIS 记录时一视同仁。过高的个人 DSR 会导致您未来想要为公司扩张融资时被卡死。</p>
      </div>
    )
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
                          {tooltips[item.id] ? (
                            <Tooltip 
                              title={item.name.split('(')[0]} 
                              content={tooltips[item.id]} 
                            />
                          ) : (
                            <span className="font-medium text-slate-700 block">{item.name.split('(')[0]}</span>
                          )}
                          <span className="text-xs text-slate-500 block">({item.name.split('(')[1]}</span>
                        </td>
                        <td className="p-4 text-sm text-slate-600 font-mono bg-slate-50/30">
                          <div>{item.formula}</div>
                          {data?.raw && getCalculationDetail(item.id, data.raw) && (
                            <div className="text-xs text-slate-400 mt-1">
                              = {getCalculationDetail(item.id, data.raw)}
                            </div>
                          )}
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
