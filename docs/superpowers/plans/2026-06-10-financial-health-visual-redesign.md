# Financial Health 视觉化重设计 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `FinancialHealthCheck` 组件从密集文字表格重设计为三层视觉化布局（总分 Banner + 雷达图 + 类别卡片），保留全部数据逻辑。

**架构：** 仅修改 `components/FinancialHealthCheck.tsx` 的 render 部分。新增 3 个纯函数（`getMetricScore`、`getCategoryScores`、`getTotalScore`）用于评分计算，以及 2 个工具函数（`getBarWidth`、`getBenchmarkPct`）用于进度条换算。所有现有逻辑（数据获取、`getStatus`、`formatValue`、`InfoModal`）原封不动保留。

**技术栈：** React、TypeScript、Tailwind CSS、SVG（内联，无新依赖）

---

## 文件变动

| 文件 | 操作 |
|------|------|
| `components/FinancialHealthCheck.tsx` | 修改：新增评分函数 + 完整重写 JSX render 部分 |

---

### 任务 1：新增评分计算函数

**文件：**
- 修改：`components/FinancialHealthCheck.tsx`（在 `getStatus` 函数之后插入）

这是纯逻辑，不涉及 UI，先独立完成并验证。

- [ ] **步骤 1：在 `getStatus` 函数后插入 `getMetricScore` 函数**

在 `getStatus` 函数结束的 `};` 之后、`formatValue` 函数之前，插入以下代码：

```typescript
const getMetricScore = (ratioId: string, value: number): number => {
  const status = getStatus(ratioId, value);
  if (status.color === 'text-green-500') return 100;
  if (status.color === 'text-yellow-500') return 60;
  return 20;
};

const getCategoryScores = (d: FinancialHealthData) => {
  const s = (id: string) =>
    getMetricScore(id, d[id as keyof Omit<FinancialHealthData, 'raw'>] as number);
  const avg = (...scores: number[]) =>
    Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return {
    liquidity:   avg(s('basicLiquidityRatio'), s('liquidAssetToNetWorth')),
    debt:        avg(s('solvencyRatio'), s('debtServiceRatio'), s('nonMortgageDSR')),
    protection:  s('lifeInsuranceCoverage'),
    growth:      avg(s('savingsRatio'), s('investAssetsToNetWorth'), s('passiveIncomeCoverage')),
  };
};

const getTotalScore = (cats: ReturnType<typeof getCategoryScores>): number =>
  Math.round((cats.liquidity + cats.debt + cats.protection + cats.growth) / 4);

const scoreColor = (s: number): string =>
  s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : s >= 40 ? '#f97316' : '#ef4444';

const getScoreSubtitle = (score: number): string => {
  if (score >= 80) return '财务状况优秀，继续保持';
  if (score >= 60) return '整体状况良好，有提升空间';
  if (score >= 40) return '存在明显薄弱环节，建议优先改善';
  return '财务风险较高，需立即关注';
};

const getBarWidth = (id: string, value: number): number => {
  const ranges: Record<string, number> = {
    basicLiquidityRatio:    12,
    liquidAssetToNetWorth:  0.40,
    solvencyRatio:          1.0,
    debtServiceRatio:       0.70,
    nonMortgageDSR:         0.40,
    lifeInsuranceCoverage:  20,
    savingsRatio:           0.50,
    investAssetsToNetWorth: 1.0,
    passiveIncomeCoverage:  1.50,
  };
  const max = ranges[id] ?? 1;
  return Math.min(100, Math.max(0, (value / max) * 100));
};

const getBenchmarkPct = (id: string): number => {
  const marks: Record<string, number> = {
    basicLiquidityRatio:    (6  / 12)   * 100,
    liquidAssetToNetWorth:  (0.15/0.40) * 100,
    solvencyRatio:          (0.5 / 1.0) * 100,
    debtServiceRatio:       (0.35/0.70) * 100,
    nonMortgageDSR:         (0.15/0.40) * 100,
    lifeInsuranceCoverage:  (10  / 20)  * 100,
    savingsRatio:           (0.20/0.50) * 100,
    investAssetsToNetWorth: (0.5 / 1.0) * 100,
    passiveIncomeCoverage:  (1.0 /1.50) * 100,
  };
  return marks[id] ?? 50;
};
```

- [ ] **步骤 2：在 `return (` 语句之前，在组件体内计算评分变量**

找到当前 `return (` 的位置（大约在第 349 行），在其正上方插入：

```typescript
const catScores = data ? getCategoryScores(data) : { liquidity: 0, debt: 0, protection: 0, growth: 0 };
const totalScore = getTotalScore(catScores);
const ringOffset = 226.2 * (1 - totalScore / 100); // SVG stroke-dashoffset for r=36 ring
```

- [ ] **步骤 3：验证 TypeScript 编译无错误**

```bash
npx tsc --noEmit
```

预期：无报错。如有报错，检查 `FinancialHealthData` 类型中是否包含所有 9 个指标字段（`basicLiquidityRatio`、`liquidAssetToNetWorth`、`solvencyRatio`、`debtServiceRatio`、`nonMortgageDSR`、`lifeInsuranceCoverage`、`savingsRatio`、`investAssetsToNetWorth`、`passiveIncomeCoverage`）。

- [ ] **步骤 4：Commit**

```bash
git add components/FinancialHealthCheck.tsx
git commit -m "feat: add scoring functions for financial health visual redesign"
```

---

### 任务 2：重写 JSX — 顶部 Score Banner

**文件：**
- 修改：`components/FinancialHealthCheck.tsx`（替换现有 `return (...)` 中的全部 JSX）

- [ ] **步骤 1：将现有 `return (...)` 块完整替换为新布局骨架**

将从 `return (` 到最后 `);` 的全部内容替换为以下代码（后续任务会填充占位符区域）：

```tsx
return (
  <div className="animate-fade-in-up pb-10 max-w-5xl">

    {/* ── SCORE BANNER ── */}
    <div className="mb-5 rounded-2xl p-6 flex items-center gap-7 text-white shadow-lg"
         style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)' }}>

      {/* Ring chart */}
      <div className="relative flex-shrink-0 w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="36" fill="none"
                  stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
          <circle cx="50" cy="50" r="36" fill="none"
                  stroke="#c9a227" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray="226.2"
                  strokeDashoffset={ringOffset}
                  style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black leading-none">{totalScore}</span>
          <span className="text-[10px] opacity-70">/ 100</span>
        </div>
      </div>

      {/* Title + mini bars */}
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-bold mb-0.5">Financial Health Check</h2>
        <p className="text-sm opacity-75 mb-3">{getScoreSubtitle(totalScore)}</p>
        <div className="flex flex-col gap-1.5">
          {[
            { label: '💧 流动性', score: catScores.liquidity },
            { label: '🏦 债务',   score: catScores.debt },
            { label: '🛡️ 保障',  score: catScores.protection },
            { label: '📈 积累',   score: catScores.growth },
          ].map(({ label, score }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[11px] opacity-85 w-16 flex-shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <div className="h-1.5 rounded-full transition-all duration-700"
                     style={{ width: `${score}%`, background: scoreColor(score) }} />
              </div>
              <span className="text-[11px] font-bold w-7 text-right opacity-90">{score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* ── MAIN LAYOUT (Radar + Categories) — Tasks 3 & 4 ── */}
    <div className="flex gap-4 items-start">

      {/* LEFT: Radar — Task 3 */}
      {/* RADAR_PLACEHOLDER */}

      {/* RIGHT: Categories — Task 4 */}
      {/* CATEGORIES_PLACEHOLDER */}

    </div>

    {/* InfoModal */}
    <InfoModal
      isOpen={activeModal !== null}
      onClose={() => setActiveModal(null)}
      title={activeModal ? categories.flatMap(c => c.items).find(i => i.id === activeModal)?.name.split('(')[0] || '' : ''}
      content={activeModal ? tooltips[activeModal] : null}
    />
  </div>
);
```

> **注意：** `{/* RADAR_PLACEHOLDER */}` 和 `{/* CATEGORIES_PLACEHOLDER */}` 是下面任务要替换的注释，不是真正的占位符——编译器会忽略注释，此文件此时可正常渲染（只是缺少雷达和类别区块）。

- [ ] **步骤 2：启动开发服务器，确认 Banner 正常渲染**

```bash
npm run dev
```

在浏览器打开 Financial Health 页面。预期：
- 深蓝渐变 Banner 显示总分数字（0-100）
- 4 条彩色迷你进度条出现
- 页面不报 TypeError

- [ ] **步骤 3：Commit**

```bash
git add components/FinancialHealthCheck.tsx
git commit -m "feat: add score banner to financial health check"
```

---

### 任务 3：雷达图 SVG

**文件：**
- 修改：`components/FinancialHealthCheck.tsx`

雷达图使用 4 轴正方形布局，中心 `(90, 90)`，最大半径 72px。

- [ ] **步骤 1：将 `{/* RADAR_PLACEHOLDER */}` 替换为雷达卡片**

```tsx
{/* LEFT: Radar chart */}
<div className="hidden lg:flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex-shrink-0 w-52">
  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 text-center">健康形态图</h3>
  <svg viewBox="0 0 180 180" className="w-full">
    {/* Grid — full diamond & inner rings */}
    <polygon points="90,18 162,90 90,162 18,90"
             fill="none" stroke="#f1f5f9" strokeWidth="1.5" strokeDasharray="4 3"/>
    <polygon points="90,54 126,90 90,126 54,90"
             fill="none" stroke="#f1f5f9" strokeWidth="1"/>
    <polygon points="90,72 108,90 90,108 72,90"
             fill="none" stroke="#f1f5f9" strokeWidth="1"/>
    {/* Axes */}
    <line x1="90" y1="18" x2="90" y2="162" stroke="#e2e8f0" strokeWidth="1"/>
    <line x1="18" y1="90" x2="162" y2="90" stroke="#e2e8f0" strokeWidth="1"/>
    {/* Data polygon: N=liquidity, E=debt, S=growth, W=protection */}
    {(() => {
      const r = 72;
      const cx = 90, cy = 90;
      const nl = catScores.liquidity / 100;
      const nd = catScores.debt / 100;
      const ng = catScores.growth / 100;
      const np = catScores.protection / 100;
      const pts = [
        `${cx},${cy - r * nl}`,        // N
        `${cx + r * nd},${cy}`,         // E
        `${cx},${cy + r * ng}`,         // S
        `${cx - r * np},${cy}`,         // W
      ].join(' ');
      return (
        <>
          <polygon points={pts}
                   fill="rgba(37,99,235,0.12)" stroke="#2563eb"
                   strokeWidth="2.5" strokeLinejoin="round"/>
          {/* Dots */}
          <circle cx={cx}            cy={cy - r * nl} r="5" fill={scoreColor(catScores.liquidity)}  stroke="white" strokeWidth="2"/>
          <circle cx={cx + r * nd}   cy={cy}          r="5" fill={scoreColor(catScores.debt)}        stroke="white" strokeWidth="2"/>
          <circle cx={cx}            cy={cy + r * ng} r="5" fill={scoreColor(catScores.growth)}      stroke="white" strokeWidth="2"/>
          <circle cx={cx - r * np}   cy={cy}          r="5" fill={scoreColor(catScores.protection)}  stroke="white" strokeWidth="2"/>
        </>
      );
    })()}
    {/* Labels */}
    <text x="90" y="12"  textAnchor="middle" fontSize="9" fill="#475569" fontFamily="sans-serif" fontWeight="600">流动性</text>
    <text x="168" y="93" textAnchor="start"  fontSize="9" fill="#475569" fontFamily="sans-serif" fontWeight="600">债务</text>
    <text x="90" y="175" textAnchor="middle" fontSize="9" fill="#475569" fontFamily="sans-serif" fontWeight="600">积累</text>
    <text x="2"  y="93"  textAnchor="start"  fontSize="9" fill="#475569" fontFamily="sans-serif" fontWeight="600">保障</text>
  </svg>
  {/* Legend */}
  <div className="mt-3 flex flex-col gap-1.5">
    {[
      { label: '流动性', score: catScores.liquidity },
      { label: '债务管理', score: catScores.debt },
      { label: '风险保障', score: catScores.protection },
      { label: '财富积累', score: catScores.growth },
    ].map(({ label, score }) => (
      <div key={label} className="flex items-center gap-2 text-[11px] text-slate-500">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: scoreColor(score) }}/>
        <span className="flex-1">{label}</span>
        <span className="font-bold" style={{ color: scoreColor(score) }}>{score}%</span>
      </div>
    ))}
  </div>
</div>
```

- [ ] **步骤 2：验证雷达图渲染**

在浏览器刷新页面（宽度 ≥ 1024px）。预期：
- 左侧出现雷达图卡片
- 4 个彩色顶点可见
- 雷达多边形面积随指标分数变化（可在浏览器 DevTools 临时修改 `catScores` 值验证形状变化）

- [ ] **步骤 3：Commit**

```bash
git add components/FinancialHealthCheck.tsx
git commit -m "feat: add radar chart to financial health check"
```

---

### 任务 4：类别卡片 + 指标进度条

**文件：**
- 修改：`components/FinancialHealthCheck.tsx`

- [ ] **步骤 1：将 `{/* CATEGORIES_PLACEHOLDER */}` 替换为类别卡片区域**

```tsx
{/* RIGHT: Category cards */}
<div className="flex-1 flex flex-col gap-3 min-w-0">

  {categories.map((category) => {
    // Derive category key from name for score lookup
    const catKey = ((): keyof typeof catScores => {
      if (category.name.includes('流动')) return 'liquidity';
      if (category.name.includes('债务')) return 'debt';
      if (category.name.includes('保障')) return 'protection';
      return 'growth';
    })();
    const catScore = catScores[catKey];
    const color = scoreColor(catScore);

    return (
      <div key={category.name}
           className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        {/* Category header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-600">{category.name}</span>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                style={{ background: `${color}22`, color }}>
            {catScore} / 100
          </span>
        </div>
        {/* Category progress bar */}
        <div className="h-1.5 bg-slate-100 rounded-full mb-3">
          <div className="h-1.5 rounded-full transition-all duration-700"
               style={{ width: `${catScore}%`, background: color }} />
        </div>

        {/* Metric rows */}
        <div className="flex flex-col gap-2">
          {category.items.map((item) => {
            const val = (data ? data[item.id as keyof Omit<FinancialHealthData, 'raw'>] : 0) as number;
            const status = getStatus(item.id, val);
            const StatusIcon = status.icon;
            const barWidth = getBarWidth(item.id, val);
            const benchmarkPct = getBenchmarkPct(item.id);

            return (
              <div key={item.id} className="flex items-center gap-2 min-w-0">
                {/* Name + info button */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-xs text-slate-500 truncate">{item.name.split('(')[0].trim()}</span>
                  {tooltips[item.id] && (
                    <button
                      onClick={() => setActiveModal(item.id)}
                      className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-xin-blue transition-colors flex items-center justify-center font-bold text-[10px]"
                    >!
                    </button>
                  )}
                </div>
                {/* Bar + benchmark tick */}
                <div className="w-28 flex-shrink-0">
                  <div className="relative h-1.5 bg-slate-100 rounded-full">
                    <div className="h-1.5 rounded-full transition-all duration-700"
                         style={{ width: `${barWidth}%`, background: status.color.replace('text-', '').replace('-500', '') === 'green' ? '#22c55e' : status.color.includes('yellow') ? '#eab308' : '#ef4444' }} />
                    {/* Benchmark tick */}
                    <div className="absolute top-[-3px] w-0.5 h-[10px] bg-slate-400 rounded-sm"
                         style={{ left: `${benchmarkPct}%` }} />
                  </div>
                </div>
                {/* Value */}
                <span className="text-xs font-bold text-slate-700 w-14 text-right flex-shrink-0">
                  {formatValue(item.id, val)}
                </span>
                {/* Status badge */}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${status.bg} ${status.color}`}>
                  <StatusIcon size={10} strokeWidth={2.5} />
                  {status.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  })}

</div>
```

> **Bar 颜色注意：** 进度条颜色用 hex 而非 Tailwind class，因为内联 `style` 需要 hex。绿 `#22c55e`、黄 `#eab308`、红 `#ef4444`——与 `scoreColor` 函数一致。上面的代码用三元表达式从 `status.color` 推导，如果感觉不优雅，可改为调用 `scoreColor(getMetricScore(item.id, val))`，效果完全等价。

- [ ] **步骤 2：修复进度条颜色推导（更简洁方案）**

在任务 4 步骤 1 的基础上，找到 Bar 颜色那行，将：

```tsx
style={{ width: `${barWidth}%`, background: status.color.replace('text-', '').replace('-500', '') === 'green' ? '#22c55e' : status.color.includes('yellow') ? '#eab308' : '#ef4444' }}
```

替换为：

```tsx
style={{ width: `${barWidth}%`, background: scoreColor(getMetricScore(item.id, val)) }}
```

- [ ] **步骤 3：检查"保障 + 积累"并排布局**

`categories` 数组中保障（1 项）和积累（3 项）目前是各自独立的卡片，已按顺序渲染。如果你想让它们并排（如规格第 3.3 节所述），在类别卡片 `div` 外层加一个条件包装：

找到 `{categories.map((category) => {` 的 `return (...)` 部分，将整个 `categories.map` 替换为：

```tsx
{/* Liquidity */}
{renderCategoryCard(categories[0])}
{/* Debt */}
{renderCategoryCard(categories[1])}
{/* Protection + Growth side by side */}
<div className="grid grid-cols-2 gap-3">
  {renderCategoryCard(categories[2])}
  {renderCategoryCard(categories[3])}
</div>
```

然后在组件 `return` 语句之前（`catScores` 计算之后）定义 `renderCategoryCard` 为一个内联函数：

```tsx
const renderCategoryCard = (category: typeof categories[0]) => {
  const catKey = ((): keyof typeof catScores => {
    if (category.name.includes('流动')) return 'liquidity';
    if (category.name.includes('债务')) return 'debt';
    if (category.name.includes('保障')) return 'protection';
    return 'growth';
  })();
  const catScore = catScores[catKey];
  const color = scoreColor(catScore);

  return (
    <div key={category.name} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-600">{category.name}</span>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: `${color}22`, color }}>
          {catScore} / 100
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full mb-3">
        <div className="h-1.5 rounded-full transition-all duration-700"
             style={{ width: `${catScore}%`, background: color }} />
      </div>
      <div className="flex flex-col gap-2">
        {category.items.map((item) => {
          const val = (data ? data[item.id as keyof Omit<FinancialHealthData, 'raw'>] : 0) as number;
          const status = getStatus(item.id, val);
          const StatusIcon = status.icon;
          return (
            <div key={item.id} className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-xs text-slate-500 truncate">{item.name.split('(')[0].trim()}</span>
                {tooltips[item.id] && (
                  <button
                    onClick={() => setActiveModal(item.id)}
                    className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-xin-blue transition-colors flex items-center justify-center font-bold text-[10px]"
                  >!</button>
                )}
              </div>
              <div className="w-28 flex-shrink-0">
                <div className="relative h-1.5 bg-slate-100 rounded-full">
                  <div className="h-1.5 rounded-full transition-all duration-700"
                       style={{ width: `${getBarWidth(item.id, val)}%`, background: scoreColor(getMetricScore(item.id, val)) }} />
                  <div className="absolute top-[-3px] w-0.5 h-[10px] bg-slate-400 rounded-sm"
                       style={{ left: `${getBenchmarkPct(item.id)}%` }} />
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 w-14 text-right flex-shrink-0">
                {formatValue(item.id, val)}
              </span>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${status.bg} ${status.color}`}>
                <StatusIcon size={10} strokeWidth={2.5} />
                {status.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **步骤 4：TypeScript 编译检查**

```bash
npx tsc --noEmit
```

预期：无报错。常见问题：`categories` 数组类型推导——如有 `never` 错误，给 `renderCategoryCard` 的参数加显式类型 `(category: (typeof categories)[0])`。

- [ ] **步骤 5：完整功能验证**

在浏览器中验证以下所有项：
1. 顶部 Banner 显示总分（整数 0-100）+ 4 条彩色迷你进度条
2. 左侧雷达图在 lg 以上显示，移动端隐藏（`hidden lg:flex`）
3. 流动性、债务管理各自独立卡片；保障和积累并排
4. 每行指标有进度条、基准刻度线（灰色竖线）、数值、状态徽章
5. 点击 `!` 按钮弹出 InfoModal，内容完整
6. 缩小浏览器窗口至 768px，验证布局不错位

- [ ] **步骤 6：最终 Commit**

```bash
git add components/FinancialHealthCheck.tsx
git commit -m "feat: complete financial health visual redesign with score banner, radar chart, and metric bars"
```

---

## 规格覆盖度检查

| 规格需求 | 对应任务 |
|---------|---------|
| 总分环形图 | 任务 2 |
| 4 类迷你进度条 + Banner | 任务 2 |
| 总分副标题动态文案 | 任务 1（`getScoreSubtitle`） |
| 雷达图 4 轴 | 任务 3 |
| 类别卡片进度条 | 任务 4 |
| 指标横向进度条 + 基准刻度线 | 任务 4 |
| 状态徽章保留 | 任务 4 |
| InfoModal `!` 按钮保留 | 任务 4 |
| 固定权重 25% 评分 | 任务 1（`getTotalScore`）|
| lg 以下隐藏雷达图 | 任务 3（`hidden lg:flex`）|
| 加载/错误状态不变 | 未改动（保留原有代码） |
