import React, { useState, useEffect } from 'react';
import { fetchFinancialHealth } from '../services/apiService';
import { FinancialHealthData } from '../types';
import { Activity, AlertCircle, CheckCircle2, AlertTriangle, Loader2, Info, X } from 'lucide-react';

const InfoModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  content: React.ReactNode 
}> = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-xl font-bold text-xin-blue flex items-center gap-2">
            <Info className="text-xin-gold" size={24} />
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {content}
        </div>
      </div>
    </div>
  );
};

const FinancialHealthCheck: React.FC = () => {
  const [data, setData] = useState<FinancialHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);

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
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <div>
          <h4 className="font-bold text-xin-blue mb-1">指标含义：</h4>
          <p>衡量您手头的现金和定存，能够支撑家庭几个月的日常开销。</p>
        </div>
        <div>
          <h4 className="font-bold text-xin-blue mb-1">为何重要：</h4>
          <p>它最重要的作用，是在突发事件发生时维持基本生活，避免因为短期现金流断裂而陷入财务危机。</p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>没有足够备用金时，人往往会被迫借贷，或者在不理想的时点卖出股票、基金等长期投资，从而扩大损失或陷入债务循环。</li>
            <li>反过来，足够的备用金会把“意外支出”和“长期投资计划”隔开，让你的投资更稳定、更能坚持下去。</li>
            <li>同时，作为企业家，保持6至12个月的充足备用金，能让您在面对生意寒冬、客户拖欠账款等突发状况时，无需为了应付个人生活费而做出仓促、妥协的商业决策。</li>
          </ul>
        </div>
      </div>
    ),
    'liquidAssetToNetWorth': (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <div>
          <h4 className="font-bold text-xin-blue mb-1">指标含义：</h4>
          <p>检查您的个人总净值中，有多少是可以随时变现的“活钱”。</p>
        </div>
        <div>
          <h4 className="font-bold text-xin-blue mb-1">为何重要：</h4>
          <ul className="list-decimal pl-5 space-y-2">
            <li>它反映你应付短期财务义务和突发开支的能力；这个比率越高，通常代表短期财务安全垫越强。</li>
            <li>它能减少你在紧急时刻被迫借高息债务，或在不合适的时间卖出长期投资的概率。</li>
            <li>它能帮助你识别自己是否处于“富有的穷人”（asset rich, cash poor）的状态，也就是账面上有钱，但实际可用现金不足。</li>
          </ul>
          <p className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">尤其是会把资金全压在公司库存、厂房或名下的房地产上的企业家，保持 15% - 20% 的流动比例，能确保您在急需资金时，不必忍痛“贱卖”资产。</p>
        </div>
      </div>
    ),
    'solvencyRatio': (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <div>
          <h4 className="font-bold text-xin-blue mb-1">指标含义：</h4>
          <p>衡量如果变卖所有个人资产并还清所有债务后，您真正拥有的财富比例。</p>
        </div>
        <div>
          <h4 className="font-bold text-xin-blue mb-1">为何重要：</h4>
          <ul className="list-decimal pl-5 space-y-2">
            <li>它能帮助你判断自己是否借太多钱，因为负债占资产越高，越容易出现偿付问题。</li>
            <li>它能反映长期财务安全性；如果你已经有房贷，再继续增加车贷或个人贷款，负债会上升，偿付压力也会变大。</li>
            <li>它能作为人生不同阶段的财务体检指标，帮助你安排有限资源，到底该先还债、留现金，还是再投资。</li>
          </ul>
          <p className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">中小企业老板通常需要为公司贷款签署“个人担保 (Personal Guarantee)”。这个指标能检视您的个人财务护城河有多深。如果比率太低（低于 50%），意味着一旦公司出现债务危机，极容易波及个人和家庭资产。</p>
        </div>
      </div>
    ),
    'debtServiceRatio': (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <div>
          <h4 className="font-bold text-xin-blue mb-1">指标含义：</h4>
          <p>衡量您每个月的个人净收入中，有多少比例被拿去还银行贷款。</p>
        </div>
        <div>
          <h4 className="font-bold text-xin-blue mb-1">为何重要：</h4>
          <ul className="list-decimal pl-5 space-y-2">
            <li><strong>贷款申请的关键门槛：</strong>马来西亚银行以 DSR 作为评估贷款资格的三大核心因素之一，大多数银行要求 DSR 低于 60% 才考虑批准贷款。</li>
            <li><strong>反映财务健康状态：</strong>DSR 越低，代表你有更多可支配收入用于储蓄、投资与日常生活，财务缓冲能力越强；DSR 过高则意味着现金流紧绷。</li>
            <li><strong>破产风险的预警指标：</strong>截至 2024 年，仍有超过四分之一（27%）的马来西亚借款人 DSR 超过 60%，一旦遭遇利率上升、失业或通货膨胀，面临破产的风险极高。</li>
            <li><strong>影响退休财务规划：</strong>DSR 长期过高会压缩个人的投资与储蓄空间，直接削弱退休基金的积累能力，对长期财富增值造成负面影响。</li>
            <li><strong>影响信用评分与融资能力：</strong>DSR 是银行信用评分的重要组成部分，DSR 越高，贷款申请被拒的概率越大，严重者甚至影响未来所有融资机会。</li>
          </ul>
          <p className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">哪怕身为企业家的您是为了公司垫资而增加的个人贷款，银行看 CCRIS 记录时一视同仁。过高的个人 DSR 会导致您未来想要为公司扩张融资，或购买优质个人资产时，被银行的信用评估卡死。</p>
        </div>
      </div>
    ),
    'nonMortgageDSR': (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <div>
          <h4 className="font-bold text-xin-blue mb-1">指标含义：</h4>
          <p>剔除掉属于良性债务的“房贷”后，衡量您在车贷、信用卡、个人贷款等“消费型债务”上的还款压力。</p>
        </div>
        <div>
          <h4 className="font-bold text-xin-blue mb-1">为何重要：</h4>
          <ul className="list-decimal pl-5 space-y-2">
            <li><strong>直接影响房贷审批：</strong>银行在审核房贷申请时，会将 Non-Mortgage DSR 与新房贷月供合并计算总 DSR。若您的非房贷债务已偏高，即使有稳定收入，银行也可能拒绝批准房贷。在马来西亚，总 DSR 一般不应超过 70%，低于 60% 才有较高的获批率。</li>
            <li><strong>反映真实财务健康状况：</strong>Non-Mortgage DSR 涵盖信用卡和个人贷款等无担保债务，能更全面地反映一个人的债务负担。这个比率越高，意味着收入中有越大比例被用于偿还债务，可支配收入越少，财务灵活性越低。</li>
            <li><strong>影响信贷记录与未来借贷能力：</strong>若房贷申请因 DSR 过高被拒，该记录会在 CCRIS 中保留 3-6 个月，影响您向其他银行申请的机会。过高的非房贷债务会形成连锁效应，令您在需要资金时处处受限。</li>
            <li><strong>退休规划与资产积累的关键障碍：</strong>从财务规划角度看，若客户的 Non-Mortgage DSR 长期居高，不仅难以购置房产，更无法积累投资资产。国家银行建议贷款总额不超过净收入的 50-60%，而理财专家更建议有家庭者的总 DSR 保持在 40% 以下，以确保有足够现金流用于储蓄与投资。</li>
          </ul>
          <p className="mt-3 bg-red-50 text-red-800 p-3 rounded-lg border border-red-100 text-sm font-medium">这是侵蚀您财富的“恶性债务”。将这个比例控制在 15% 以下，您才能腾出更多现金流来为自己积累财富，而不是永远在为过去的消费买单。</p>
        </div>
      </div>
    ),
    'lifeInsuranceCoverage': (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <div>
          <h4 className="font-bold text-xin-blue mb-1">指标含义：</h4>
          <p>衡量如果您不幸发生意外，留下的保险理赔金能替代您多少年的年收入。</p>
        </div>
        <div>
          <h4 className="font-bold text-xin-blue mb-1">为何重要：</h4>
          <p>人寿保险最基本的作用，是在被保人身故或全残时，向受益人提供一笔免税的赔偿金（Death Benefit），确保家人的日常生活、房贷、子女教育费用不因为主要收入者的离开而中断。对于家庭支柱（breadwinner）而言，这等于是将自己的"人力资本"转化为可量化的财务保障。人寿保险也涵盖全残保障，若因意外或疾病导致永久伤残，保险公司同样会赔付。</p>
          <p className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">身为企业家，您是公司和家庭最大的“提款机”。这笔理赔金不仅是为了保障家人未来 10 年的生活费，更是为了随时结清您背负的个人担保债务，确保家人无需被迫去接手或处理他们不熟悉的生意烂摊子。</p>
        </div>
      </div>
    ),
    'savingsRatio': (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <div>
          <h4 className="font-bold text-xin-blue mb-1">指标含义：</h4>
          <p>衡量您每个月从个人收入（包含薪水和分红）中，能真正留存下来用于投资或备用的比例。</p>
        </div>
        <div>
          <h4 className="font-bold text-xin-blue mb-1">为何重要：</h4>
          <ul className="list-decimal pl-5 space-y-2">
            <li>它是财务安全垫的来源，因为持续储蓄能让你逐步建立应急资金，而不是在意外开支出现时被迫依赖高成本信贷。</li>
            <li>它决定你是否有资金进入长期投资与复利积累；较高储蓄率有助于建立财富、降低财务压力，并支持长期财务目标。</li>
            <li>它会影响你的选择自由度，因为有储蓄的人在失业、转职或收入波动时，通常更有缓冲空间。</li>
          </ul>
          <p className="mt-2 font-medium text-xin-blue">对大多数人来说，储蓄率其实是在决定“你离退休目标是越来越近，还是越来越远”。</p>
          <p className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">很多企业家习惯将利润全部投回公司，导致个人户口“空空如也”。维持 20% 以上的储蓄率，意味着您正在系统性地将公司风险转化为个人资产。这是为您自己建立“私人金库”，确保无论生意好坏，您的私人财富都在稳步增长。</p>
        </div>
      </div>
    ),
    'investAssetsToNetWorth': (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <div>
          <h4 className="font-bold text-xin-blue mb-1">指标含义：</h4>
          <p>检查您的总资产中，有多少比例是投在“非公司业务”的生息资产上（如股票、基金、优质房产、退休金 EPF 等）。</p>
        </div>
        <div>
          <h4 className="font-bold text-xin-blue mb-1">为何重要：</h4>
          <ul className="list-decimal pl-5 space-y-2">
            <li><strong>衡量资产效率：</strong>此比率揭示你有多少净资产正在通过投资产生回报，而非停留在低效的现金或消费性资产中。</li>
            <li><strong>对抗通货膨胀：</strong>持有过多闲置现金会随时间贬值。数据显示，成熟市场股票预期年回报约 8%，远高于现金的 2.8%，投资才能真正保护财富购买力。</li>
            <li><strong>退休规划的核心指标：</strong>净资产高但投资比率低的客户，其财富增长潜力远不如投资比率高的客户。</li>
            <li><strong>复利效应的基础：</strong>越早将资产投入投资，复利效应越显著，同时更长的时间跨度也能更好地抵御市场波动。</li>
          </ul>
          <p className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">此外，您的 Sdn Bhd 股份属于高风险资产。这个指标衡量您的资产是否过度集中在单一行业。提高投资资产占比（建议 50% 以上），能帮您实现资产多元化，降低生意波动对整体身家的影响，是实现“资产出海、风险隔离”的关键。</p>
        </div>
      </div>
    ),
    'passiveIncomeCoverage': (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <div>
          <h4 className="font-bold text-xin-blue mb-1">指标含义：</h4>
          <p>衡量您无需上班或亲自参与生意，单靠投资产生的股息、租金或利息，能覆盖多少比例的家庭开销。</p>
        </div>
        <div>
          <h4 className="font-bold text-xin-blue mb-1">为何重要：</h4>
          <ul className="list-decimal pl-5 space-y-2">
            <li>它能提升财务稳定性，因为被动收入可以在失业、行业下行或健康问题出现时，减轻突发事件对现金流的冲击。</li>
            <li>这是您真正的 “退场机制 (Exit Plan)” 指标。当这个比例达到 100% 时，意味着您已经实现了财务自由。届时，继续经营生意将是一种“选择”和“热爱”，而不是为了维持生计的“不得不为之”。</li>
          </ul>
        </div>
      </div>
    )
  };

  const categories = [
    {
      name: '流动性 (Liquidity)',
      items: [
        { id: 'basicLiquidityRatio', name: 'Basic Liquidity Ratio (基本流动比率/紧急备用金)', formula: '(Cash + FD + MMF) / Monthly Expenses', benchmark: '3 - 6 个月(自雇人士建议 6-12 个月)' },
        { id: 'liquidAssetToNetWorth', name: 'Liquid Asset to Net Worth (流动资产净值比)', formula: '(Cash + FD + MMF) / Net Worth', benchmark: '15% - 20%(过低风险大，过高则资金闲置)' }
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
                    const val = (data ? data[item.id as keyof Omit<FinancialHealthData, 'raw'>] : 0) as number;
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{item.name.split('(')[0]}</span>
                            {tooltips[item.id] && (
                              <button 
                                onClick={() => setActiveModal(item.id)}
                                className="text-slate-400 hover:text-xin-blue transition-colors focus:outline-none flex-shrink-0 bg-slate-100 hover:bg-slate-200 w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs"
                                title="点击查看详情"
                              >
                                !
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 block mt-0.5">({item.name.split('(')[1]}</span>
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

      <InfoModal 
        isOpen={activeModal !== null} 
        onClose={() => setActiveModal(null)} 
        title={activeModal ? categories.flatMap(c => c.items).find(i => i.id === activeModal)?.name.split('(')[0] || '' : ''}
        content={activeModal ? tooltips[activeModal] : null}
      />
    </div>
  );
};

export default FinancialHealthCheck;
