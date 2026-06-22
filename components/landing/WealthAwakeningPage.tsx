import React, { useCallback, useEffect, useState } from 'react';
import {
  Wallet, Landmark, AlertTriangle, HelpCircle,
  ShieldCheck, Gauge, TrendingUp,
  User, Coins, Clock, Crown, ArrowRight, Sparkles,
  Send, FileText, MessageSquare, Award, Check, X as XIcon, Quote,
} from 'lucide-react';
import ApplyForm from './ApplyForm';
import ReportPreview from './ReportPreview';

// ════════════════════════════════════════════════════════════════
//  一次性营销活动「财富觉醒·上帝视角」落地页（仅中文）。
//  活动结束后整体删除本目录 + api/wealth-awakening-lead.js + App.tsx 路由即可。
//  ↓↓↓ 活动截止时间：上线前改这一行 ↓↓↓
const CAMPAIGN_END = new Date('2026-06-30T23:59:00+08:00'); // 活动截止
const TOTAL_SPOTS = 10;

//  Hero 背景大图（留 null 则用 CSS 渐变还原暗金质感）。
const HERO_BG: string | null = '/landing/hero.jpg';

//  顾问信息
const ADVISOR = {
  name: 'Leon Lee',
  title: 'XinWealth 财富顾问',
  // 头像（留 null 显示字母徽标）。
  photo: '/landing/leon.jpg' as string | null,
  credentials: [
    '持牌理财规划师 · 专注高净值家庭',
    '协助客户建立完整财富全貌',
    '风险 · 健康 · 效率 三维诊断方法',
  ],
  quote: '财富自由的第一步，是先看清自己现在站在哪里。',
};

//  真实客户反馈
const TESTIMONIALS = [
  {
    initial: '何',
    name: '何女士',
    role: '自雇人士',
    quote: '在进行财务规划之前，我原先不清楚自己的财务全貌，甚至还被误导以为是投资基金，结果却买了不必要的保险。这件事困扰我很久，我不知道要怎么决策。经过 Leon 的梳理和分析，我知道自己需要做什么，而且对整体财务有了明确的掌握——也知道哪些资产应该继续持有、哪些该放手。对于我这种不熟悉这么多复杂工具的人，现在很清晰地知道日后财务方面什么该做、什么不该做。',
  },
];
// ════════════════════════════════════════════════════════════════

// ── 倒计时 ────────────────────────────────────────────────────
function useCountdown(target: Date) {
  const calc = () => Math.max(0, target.getTime() - Date.now());
  const [ms, setMs] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setMs(calc()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const total = Math.floor(ms / 1000);
  return {
    ended: ms <= 0,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

const Countdown: React.FC<{ ended: boolean; days: number; hours: number; minutes: number; seconds: number; compact?: boolean }> = (t) => {
  if (t.ended) return <div className="text-red-300 font-semibold tracking-wide">活动已结束 · 名额已满</div>;
  const cells = [
    { v: t.days, l: '天' }, { v: t.hours, l: '时' },
    { v: t.minutes, l: '分' }, { v: t.seconds, l: '秒' },
  ];
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {cells.map((c, i) => (
        <React.Fragment key={c.l}>
          <div className="flex flex-col items-center">
            <span className="font-serif text-2xl sm:text-3xl font-bold text-xin-gold tabular-nums w-11 text-center">{pad(c.v)}</span>
            <span className="text-[10px] text-white/50 mt-0.5">{c.l}</span>
          </div>
          {i < cells.length - 1 && <span className="text-xin-gold/40 text-2xl -mt-3">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── 区块内容 ──────────────────────────────────────────────────
const PAIN_POINTS = [
  { icon: Wallet, text: '钱赚得越来越多，但财务越来越复杂' },
  { icon: Landmark, text: '资产分散，却不清楚整体状况' },
  { icon: AlertTriangle, text: '不知道哪里有漏洞、低效率或隐藏风险' },
  { icon: HelpCircle, text: '现在的方向，真的能走向财富自由吗？' },
];
const FEATURES = [
  { icon: ShieldCheck, title: '财务风险评估', desc: '找出潜在风险，防患于未然' },
  { icon: Gauge, title: '财务健康指数', desc: '全面评估你的财务健康状况' },
  { icon: TrendingUp, title: '财务效率优化', desc: '优化资源配置，提升财富效能' },
];
const STEPS = [
  { icon: Send, title: '提交申请', desc: '填写下方表单，通过资格审核' },
  { icon: FileText, title: '资料梳理', desc: '协助你整理资产、负债与现金流全貌' },
  { icon: MessageSquare, title: '一对一诊断', desc: '约 45–60 分钟深度诊断会谈' },
  { icon: Award, title: '专属报告', desc: '获得财务健康指数与优化建议' },
];
const CONDITIONS = [
  { icon: User, title: '年收入', highlight: '六位数以上' },
  { icon: Coins, title: '可投资资金', highlight: '六位数以上' },
];
const FOR_YOU = [
  '年收入或可投资资金已达六位数以上',
  '想一次看清自己的财务全貌',
  '愿意诚实面对现状、认真对待',
  '完成后愿意给一段真实反馈（testimonial）',
];
const NOT_FOR_YOU = [
  '只想随便看看、收集免费资料',
  '不愿意提供任何真实信息',
  '在寻找快速致富的捷径',
  '没有时间参与一次完整的诊断',
];

// ── 通用 ──────────────────────────────────────────────────────
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white text-center mb-3">{children}</h2>
);
const GoldRule: React.FC = () => (
  <div className="mx-auto w-24 h-px bg-gradient-to-r from-transparent via-xin-gold to-transparent mb-12" />
);

// ── 页面 ──────────────────────────────────────────────────────
const WealthAwakeningPage: React.FC = () => {
  const t = useCountdown(CAMPAIGN_END);
  const [remaining, setRemaining] = useState<number | null>(null);

  const fetchRemaining = useCallback(async () => {
    try {
      const res = await fetch('/api/wealth-awakening-lead');
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.remaining === 'number') setRemaining(data.remaining);
    } catch { /* 优雅降级 */ }
  }, []);
  useEffect(() => { fetchRemaining(); }, [fetchRemaining]);

  const soldOut = remaining !== null && remaining <= 0;
  const formDisabled = t.ended || soldOut;
  const scrollToForm = () => document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' });
  const spotsLabel = remaining === null ? `限 ${TOTAL_SPOTS} 位` : soldOut ? '名额已满' : `仅剩 ${remaining} 位 / 共 ${TOTAL_SPOTS} 位`;

  return (
    <div className="min-h-screen bg-xin-dark text-white font-sans selection:bg-xin-gold selection:text-xin-dark overflow-x-hidden pb-20 lg:pb-0">
      {/* ── 顶栏 ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-xin-dark/80 border-b border-xin-gold/15">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-xin-gold to-xin-goldDark rounded-lg flex items-center justify-center">
              <span className="text-xin-dark font-bold font-serif text-lg">X</span>
            </div>
            <span className="font-serif font-bold text-xl tracking-tight">Xin<span className="text-xin-gold">Wealth</span></span>
          </div>
          <button onClick={scrollToForm}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-xin-gold/40 text-xin-gold hover:bg-xin-gold/10 transition-colors cursor-pointer">
            立即申请
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative isolate px-5 pt-14 pb-20 sm:pt-20 sm:pb-24">
        {HERO_BG ? (
          <div className="absolute inset-0 -z-10">
            <img src={HERO_BG} alt="" aria-hidden className="w-full h-full object-cover" />
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(6,22,38,0.72) 0%, rgba(4,16,29,0.92) 100%), radial-gradient(120% 90% at 78% 0%, rgba(200,169,126,0.22) 0%, transparent 60%)' }} />
          </div>
        ) : (
          <>
            <div className="absolute inset-0 -z-10"
              style={{ background: 'radial-gradient(120% 90% at 78% 0%, rgba(200,169,126,0.30) 0%, rgba(200,169,126,0.06) 35%, transparent 65%), linear-gradient(180deg, #061626 0%, #04101d 100%)' }} />
            {/* 城市天际线剪影 */}
            <div className="absolute bottom-0 left-0 right-0 h-28 -z-10 opacity-40"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.6) 0px, rgba(0,0,0,0.6) 14px, transparent 14px, transparent 22px, rgba(0,0,0,0.45) 22px, rgba(0,0,0,0.45) 30px, transparent 30px, transparent 46px)', maskImage: 'linear-gradient(180deg, transparent, #000 80%)', WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 80%)' }} />
          </>
        )}
        {/* 漂浮金色光球 */}
        <div className="absolute top-10 -left-20 w-72 h-72 rounded-full bg-xin-gold/10 blur-3xl -z-10 motion-safe:animate-float-slow motion-reduce:animate-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-xin-goldDark/10 blur-3xl -z-10" />

        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* 左：文案 */}
          <div className="text-center lg:text-left motion-safe:animate-fade-in-up">
            <div className="inline-flex flex-col items-center lg:items-start gap-1 mb-7 px-5 py-3 rounded-2xl border border-xin-gold/30 bg-white/5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <span>价值</span>
                <span className="line-through decoration-red-500/80 decoration-2 text-white/50">RM 3,688</span>
              </div>
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="w-4 h-4 text-xin-gold" />
                <span>现开放 <span className="text-red-400">免费体验</span>（限 {TOTAL_SPOTS} 位）</span>
              </div>
            </div>

            <h1 className="font-serif font-bold leading-[1.05] mb-6">
              <span className="block text-5xl sm:text-7xl bg-gradient-to-br from-xin-goldLight via-xin-gold to-xin-goldDark bg-clip-text text-transparent">财富觉醒</span>
              <span className="block text-5xl sm:text-7xl mt-1">上帝视角</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/70 mb-7">看清财富全局，做出更好的每一个决定</p>

            <div className="inline-block bg-red-600 text-white font-bold px-6 py-2.5 rounded-full shadow-lg shadow-red-900/40 mb-8">
              符合条件即可免费获得！
            </div>

            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-5 sm:gap-7 mb-8 p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-xin-gold/15">
              <div className="flex flex-col items-center sm:items-start">
                <span className="text-xs text-white/50 mb-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 距活动截止</span>
                <Countdown {...t} />
              </div>
              <div className="hidden sm:block w-px h-12 bg-xin-gold/20" />
              <div className="flex flex-col items-center sm:items-start">
                <span className="text-xs text-white/50 mb-2 flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> 名额</span>
                <span className={`font-serif text-2xl font-bold ${soldOut ? 'text-red-400' : 'text-xin-gold'}`}>{spotsLabel}</span>
              </div>
            </div>

            <button onClick={scrollToForm}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-xin-goldDark via-xin-gold to-xin-goldLight text-xin-dark font-bold text-lg px-8 py-4 rounded-xl shadow-lg shadow-xin-gold/25 hover:shadow-xin-gold/50 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
              立即申请，锁定免费名额 <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* 右：样本报告可视化 */}
          <div className="motion-safe:animate-fade-in-up motion-safe:[animation-delay:150ms]">
            <ReportPreview />
          </div>
        </div>
      </section>

      {/* ── 痛点 ── */}
      <section className="px-5 py-16 sm:py-20 bg-black/20">
        <div className="max-w-3xl mx-auto">
          <SectionTitle>很多高收入人士都有一个共同问题</SectionTitle>
          <GoldRule />
          <div className="space-y-4">
            {PAIN_POINTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-xin-gold/30 transition-colors">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-xin-gold/10 border border-xin-gold/25 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-xin-gold" />
                </div>
                <p className="text-base sm:text-lg text-white/85">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 方案 ── */}
      <section className="px-5 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <SectionTitle>我会协助你建立财富全貌</SectionTitle>
          <GoldRule />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center p-8 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-xin-gold/20 hover:border-xin-gold/50 hover:-translate-y-1 transition-all duration-300">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-xin-gold/10 border border-xin-gold/30 flex items-center justify-center mb-5">
                  <Icon className="w-8 h-8 text-xin-gold" />
                </div>
                <h3 className="font-serif text-xl font-bold mb-2 text-white">{title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 流程 ── */}
      <section className="px-5 py-16 sm:py-20 bg-black/20">
        <div className="max-w-5xl mx-auto">
          <SectionTitle>评估如何进行</SectionTitle>
          <GoldRule />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative p-6 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="absolute top-4 right-5 font-serif text-3xl font-bold text-xin-gold/20">{i + 1}</span>
                <div className="w-12 h-12 rounded-xl bg-xin-gold/10 border border-xin-gold/25 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-xin-gold" />
                </div>
                <h3 className="font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 参与条件 ── */}
      <section className="px-5 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <SectionTitle>参与条件</SectionTitle>
          <p className="text-center text-white/60 mb-10 -mt-2">符合其中一条即可</p>
          <div className="flex flex-col sm:flex-row items-stretch justify-center gap-4">
            {CONDITIONS.map(({ icon: Icon, title, highlight }, i) => (
              <React.Fragment key={title}>
                <div className="flex-1 flex items-center gap-4 p-6 rounded-2xl bg-white/[0.04] border border-xin-gold/25 backdrop-blur-sm">
                  <div className="shrink-0 w-14 h-14 rounded-full bg-xin-gold/10 border border-xin-gold/30 flex items-center justify-center">
                    <Icon className="w-7 h-7 text-xin-gold" />
                  </div>
                  <div>
                    <p className="text-white/70 text-sm">{title}</p>
                    <p className="font-serif text-xl font-bold text-xin-gold">{highlight}</p>
                  </div>
                </div>
                {i === 0 && <div className="flex items-center justify-center"><span className="font-serif text-xl text-white/50 px-2">或</span></div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── 适合 / 不适合 ── */}
      <section className="px-5 py-16 sm:py-20 bg-black/20">
        <div className="max-w-4xl mx-auto">
          <SectionTitle>这套评估适合谁</SectionTitle>
          <p className="text-center text-white/60 mb-10 -mt-2">名额有限，我们只想找认真的人</p>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="p-7 rounded-2xl bg-xin-gold/[0.06] border border-xin-gold/30">
              <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-xin-goldLight mb-5">
                <Check className="w-5 h-5" /> 适合你，如果你
              </h3>
              <ul className="space-y-3">
                {FOR_YOU.map((x) => (
                  <li key={x} className="flex gap-3 text-white/80 text-sm leading-relaxed">
                    <Check className="w-5 h-5 text-xin-gold shrink-0 mt-0.5" /><span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10">
              <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-white/60 mb-5">
                <XIcon className="w-5 h-5" /> 不适合你，如果你
              </h3>
              <ul className="space-y-3">
                {NOT_FOR_YOU.map((x) => (
                  <li key={x} className="flex gap-3 text-white/50 text-sm leading-relaxed">
                    <XIcon className="w-5 h-5 text-red-400/70 shrink-0 mt-0.5" /><span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Offer ── */}
      <section className="px-5 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-lg text-white/70 mb-2">完成后，只需给出</p>
          <p className="font-serif text-3xl sm:text-4xl font-bold text-xin-gold mb-2 tracking-wider">— TESTIMONIAL —</p>
          <p className="text-lg text-white/70 mb-8">即可免费获得这个价值</p>
          <div className="inline-flex items-end justify-center gap-2 mb-3">
            <span className="font-serif text-3xl sm:text-4xl font-bold text-white">RM</span>
            <span className="font-serif text-6xl sm:text-8xl font-extrabold bg-gradient-to-br from-xin-goldLight via-xin-gold to-xin-goldDark bg-clip-text text-transparent leading-none">3,688</span>
          </div>
          <p className="font-serif text-2xl font-bold text-white">方案！</p>
        </div>
      </section>

      {/* ── 顾问权威 ── */}
      <section className="px-5 py-16 sm:py-20 bg-black/20">
        <div className="max-w-4xl mx-auto">
          <SectionTitle>关于你的顾问</SectionTitle>
          <GoldRule />
          <div className="flex flex-col sm:flex-row items-center gap-8 p-8 rounded-3xl bg-white/[0.04] border border-xin-gold/20">
            {/* 头像（有照片用照片，否则字母徽标） */}
            {ADVISOR.photo ? (
              <img src={ADVISOR.photo} alt={`${ADVISOR.name} 头像`} className="w-32 h-32 rounded-2xl object-cover object-top border border-xin-gold/30 shrink-0" />
            ) : (
              <div className="w-32 h-32 rounded-2xl shrink-0 bg-gradient-to-br from-xin-gold/20 to-xin-goldDark/10 border border-xin-gold/30 flex items-center justify-center">
                <span className="font-serif text-5xl font-bold text-xin-gold">{ADVISOR.name.charAt(0)}</span>
              </div>
            )}
            <div className="text-center sm:text-left">
              <h3 className="font-serif text-2xl font-bold text-white">{ADVISOR.name}</h3>
              <p className="text-xin-gold text-sm mb-4">{ADVISOR.title}</p>
              <ul className="space-y-2 mb-4">
                {ADVISOR.credentials.map((c) => (
                  <li key={c} className="flex gap-2 text-sm text-white/75 justify-center sm:justify-start">
                    <ShieldCheck className="w-4 h-4 text-xin-gold shrink-0 mt-0.5" /><span>{c}</span>
                  </li>
                ))}
              </ul>
              <p className="text-white/60 italic text-sm">“{ADVISOR.quote}”</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 客户反馈 ── */}
      <section className="px-5 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <SectionTitle>他们已经看清了全貌</SectionTitle>
          <GoldRule />
          <div className={`grid gap-5 ${TESTIMONIALS.length === 1 ? 'max-w-2xl mx-auto' : 'md:grid-cols-3'}`}>
            {TESTIMONIALS.map((tm) => (
              <div key={tm.name} className="p-7 sm:p-8 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col">
                <Quote className="w-8 h-8 text-xin-gold/40 mb-4" />
                <p className="text-white/85 text-base leading-relaxed flex-1">{tm.quote}</p>
                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-white/10">
                  <div className="w-11 h-11 rounded-full bg-xin-gold/15 border border-xin-gold/30 flex items-center justify-center">
                    <span className="font-serif font-bold text-xin-gold">{tm.initial}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{tm.name}</p>
                    <p className="text-xs text-white/50">{tm.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 紧迫横幅 ── */}
      <section className="px-5 py-10 bg-gradient-to-r from-red-900/40 via-red-800/30 to-red-900/40 border-y border-red-500/20">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
          <p className="font-serif text-2xl font-bold">仅限 {TOTAL_SPOTS} 位 · 名额有限，额满即止！</p>
          <div className="sm:border-l sm:border-white/20 sm:pl-4"><Countdown {...t} /></div>
        </div>
      </section>

      {/* ── 申请表单 ── */}
      <section id="apply" className="px-5 py-16 sm:py-20">
        <div className="max-w-xl mx-auto">
          <SectionTitle>立即申请，锁定免费名额</SectionTitle>
          <p className="text-center text-white/60 mb-3">{spotsLabel}</p>
          <GoldRule />
          <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.04] border border-xin-gold/20 shadow-2xl shadow-black/40 backdrop-blur-sm">
            <ApplyForm onSuccess={fetchRemaining} disabled={formDisabled} />
          </div>
        </div>
      </section>

      {/* ── P.S. ── */}
      <section className="px-5 pb-16">
        <div className="max-w-2xl mx-auto p-7 rounded-2xl bg-white/[0.03] border-l-2 border-xin-gold/50">
          <p className="text-white/75 leading-relaxed text-sm sm:text-base">
            <span className="text-xin-gold font-semibold">P.S. </span>
            真正需要看清财务全貌的人，往往是犹豫最久的那一个。这次只开放 {TOTAL_SPOTS} 个免费名额，
            额满就停。如果你也想站上「上帝视角」，现在就申请，把名额留给认真的自己。
          </p>
        </div>
      </section>

      {/* ── 页脚 ── */}
      <footer className="px-5 py-10 border-t border-white/10 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-7 h-7 bg-gradient-to-br from-xin-gold to-xin-goldDark rounded-lg flex items-center justify-center">
            <span className="text-xin-dark font-bold font-serif">X</span>
          </div>
          <span className="font-serif font-bold">Xin<span className="text-xin-gold">Wealth</span></span>
        </div>
        <p className="text-xs text-white/40 max-w-md mx-auto leading-relaxed">
          本活动名额有限，先到先得，额满即止。提交申请不构成任何投资建议；最终参与资格以确认为准。
        </p>
        <p className="text-xs text-white/30 mt-3">© {new Date().getFullYear()} XinWealth. 版权所有。</p>
      </footer>

      {/* ── 移动端常驻 CTA ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 px-4 py-3 bg-xin-dark/90 backdrop-blur-md border-t border-xin-gold/20 flex items-center justify-between gap-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="leading-tight">
          <p className="text-[10px] text-white/50">{soldOut ? '名额已满' : `${spotsLabel}`}</p>
          <p className="text-xs font-semibold text-xin-gold">免费体验 · 价值 RM3,688</p>
        </div>
        <button onClick={scrollToForm}
          className="shrink-0 bg-gradient-to-r from-xin-goldDark via-xin-gold to-xin-goldLight text-xin-dark font-bold text-sm px-5 py-2.5 rounded-lg cursor-pointer">
          立即申请
        </button>
      </div>
    </div>
  );
};

export default WealthAwakeningPage;
