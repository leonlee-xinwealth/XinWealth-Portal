import React from 'react';

// 样本「财务健康诊断报告」可视化（纯 SVG/CSS，无需图片素材）。
// 直观展示 RM3,688 方案的交付物：健康指数仪表 + 三维雷达 + 指标条。

const SCORE = 72; // 样本分数
const GAUGE_LEN = Math.PI * 80; // 半圆周长 (r=80)

// 雷达三维：风险防护 / 财务健康 / 资金效率
const CX = 90, CY = 88, R = 58;
const AXES = [
  { label: '风险防护', angle: -90, value: 0.82 },
  { label: '资金效率', angle: 30, value: 0.64 },
  { label: '现金流', angle: 150, value: 0.74 },
];
const pt = (angle: number, radius: number) => {
  const a = (angle * Math.PI) / 180;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)] as const;
};
const ring = (f: number) => AXES.map((ax) => pt(ax.angle, R * f).join(',')).join(' ');
const dataPoly = AXES.map((ax) => pt(ax.angle, R * ax.value).join(',')).join(' ');

const BARS = [
  { label: '资产配置均衡度', pct: 68 },
  { label: '风险敞口控制', pct: 81 },
  { label: '税务与现金流效率', pct: 59 },
];

const ReportPreview: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`relative rounded-3xl border border-xin-gold/25 bg-white/[0.06] backdrop-blur-xl
      shadow-2xl shadow-black/50 p-6 sm:p-7 overflow-hidden ${className}`}
  >
    {/* 顶部高光 */}
    <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-xin-gold/60 to-transparent" />

    <div className="flex items-center justify-between mb-5">
      <div>
        <p className="text-[10px] tracking-[0.25em] text-xin-gold/70 mb-1">上帝视角 · 样本</p>
        <h3 className="font-serif text-lg font-bold text-white">财务健康诊断报告</h3>
      </div>
      <span className="text-[10px] px-2.5 py-1 rounded-full border border-xin-gold/30 text-xin-goldLight">PREVIEW</span>
    </div>

    <div className="grid grid-cols-2 gap-4 items-center">
      {/* 健康指数仪表 */}
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 200 120" className="w-full max-w-[180px]" role="img" aria-label={`财务健康指数 ${SCORE} 分`}>
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#A68255" />
              <stop offset="100%" stopColor="#E6D3B3" />
            </linearGradient>
          </defs>
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="12" strokeLinecap="round" />
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${(SCORE / 100) * GAUGE_LEN} ${GAUGE_LEN}`} />
          <text x="100" y="86" textAnchor="middle" className="fill-white" style={{ font: '700 34px Playfair Display, serif' }}>{SCORE}</text>
          <text x="100" y="106" textAnchor="middle" className="fill-white/50" style={{ font: '500 11px Inter, sans-serif' }}>/ 100</text>
        </svg>
        <p className="text-xs text-white/60 mt-1">财务健康指数</p>
      </div>

      {/* 三维雷达 */}
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 180 170" className="w-full max-w-[170px]" role="img" aria-label="财务三维评估雷达图">
          {[1, 0.66, 0.33].map((f) => (
            <polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
          ))}
          {AXES.map((ax) => {
            const [x, y] = pt(ax.angle, R);
            return <line key={ax.label} x1={CX} y1={CY} x2={x} y2={y} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />;
          })}
          <polygon points={dataPoly} fill="rgba(200,169,126,0.25)" stroke="#C8A97E" strokeWidth="2" />
          {AXES.map((ax) => {
            const [x, y] = pt(ax.angle, R + 14);
            return (
              <text key={ax.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                className="fill-white/60" style={{ font: '500 9px Inter, sans-serif' }}>{ax.label}</text>
            );
          })}
        </svg>
      </div>
    </div>

    {/* 指标条 */}
    <div className="mt-5 space-y-3">
      {BARS.map((b) => (
        <div key={b.label}>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-white/70">{b.label}</span>
            <span className="text-xin-goldLight tabular-nums">{b.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-xin-goldDark to-xin-goldLight" style={{ width: `${b.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default ReportPreview;
