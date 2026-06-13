# 投资力自测获客漏斗 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在官网 www.xinwealth.com 上线一个「投资力自测」漏斗（测评 → 结果 → 预约 → WhatsApp 衔接），把陌生访客转化为高质量预约线索，自动进入 portal 的 Pipeline。

**Architecture:** 漏斗建在 **Homepage 仓库**（`xinwealth-website`，Vite+React+TS，Tailwind CDN），新增 `/invest-check` 页面（内部状态机 intro→quiz→result→booking→confirm）；提交时调用本仓库的 `api/lead` serverless，用 service-role key 直连**共享 Supabase**（portal 现有项目）写一条 `clients` 线索（`lead_source=website_quiz`，测评数据存 `metadata`）。Portal 仓库仅加一个线索来源枚举值与可选的线索详情展示。两仓库，一个 Supabase。

**Tech Stack:** React 18/19（现有，经 importmap+esm.sh 加载）、Vite、Tailwind（CDN，含 `xin-*` 调色板）、lucide-react、`@supabase/supabase-js`（仅 serverless 用）、vitest（新增，用于纯逻辑单测）、Vercel（部署 + serverless functions）、Supabase Postgres。

**关键参考（规格）:** [docs/superpowers/specs/2026-06-13-invest-check-funnel-design.md](../specs/2026-06-13-invest-check-funnel-design.md)

---

## 仓库与工作目录约定

本计划跨两个仓库：

| 代号 | 仓库 | 本地路径（约定，可调整） | 说明 |
|------|------|------------------------|------|
| **PORTAL** | XinWealth-Portal（当前仓库） | `D:\XinWealth Portal App\XinWealth-Portal` | 仅 Phase 0 改动 |
| **HP** | xinwealth-website（github `leonlee-xinwealth/Homepage`） | `D:\XinWealth Portal App\xinwealth-website` | 漏斗主体 |

每个任务的 **Files** 已标注属于 PORTAL 还是 HP。Phase 1 起进入 HP 仓库工作。

## 需要 Leon 提供（实现前确认；缺失项用占位，最后由 Leon 在 Vercel 填真值）

- `LEON_ADVISOR_ID`：Leon 在 Supabase `profiles` 表中的 id（落库 `clients.advisor_id`）。
- `ADVISOR_WA_NUMBER`：wa.me 用的 WhatsApp 号码，国际格式无 `+`，例 `60123456789`。
- 确认 HP 的 Vercel 项目连的是与 PORTAL **同一个** Supabase（同 `SUPABASE_URL` + service-role key）。

## 文件结构（HP 仓库新增）

```
xinwealth-website/
  index.tsx                      # 改：渲染 <App/>（原内联组件移出）
  App.tsx                        # 新：路径开关（/ → Home，/invest-check → InvestCheck）
  Home.tsx                       # 新：原 index.tsx 的营销首页组件（整体迁入）
  vercel.json                    # 改：加 SPA rewrite
  package.json                   # 改：加 @supabase/supabase-js、vitest、test 脚本
  lib/investCheck/
    scoring.ts                   # 新：题目分值表 + computeResult（纯函数）
    scoring.test.ts              # 新：评分单测
    projection.ts                # 新：差距投影计算（纯函数）
    projection.test.ts           # 新：投影单测
    whatsapp.ts                  # 新：buildWhatsappUrl（纯函数）
    whatsapp.test.ts             # 新：WhatsApp 模板单测
    content.ts                   # 新：双语文案（题目/选项/结果/映射/标签）
    types.ts                     # 新：共享类型
  invest-check/
    InvestCheck.tsx              # 新：状态机容器（intro→quiz→result→booking→confirm）+ lang
    IntroScreen.tsx              # 新：引导页
    Quiz.tsx                     # 新：测评题目逐题
    ResultPage.tsx               # 新：结果页（指数环/维度条/缺口/3 件事/CTA）
    Projection.tsx               # 新：差距投影交互组件
    BookingForm.tsx              # 新：预约表单
    ConfirmScreen.tsx            # 新：确认页 + WhatsApp 按钮
  api/
    _lib/supabase.js             # 新：admin client（service role）
    _lib/scoring.js              # 新：scoring.ts 的 JS 镜像（serverless 重算用）
    lead.js                      # 新：POST 线索写入
  .env.example                   # 新：环境变量样板
```

---

## Phase 0 — 共享后端前置（PORTAL + Supabase）

### Task 1: lead_source 枚举增加 website_quiz

**Files:**
- Create: `supabase/migrations/20260613000001_lead_source_website_quiz.sql` (PORTAL)

- [ ] **Step 1: 写迁移文件**

```sql
-- 为网站投资力自测漏斗新增线索来源
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'website_quiz';
```

- [ ] **Step 2: 应用到线上 Supabase**

用 Supabase MCP `apply_migration`（name=`lead_source_website_quiz`，query 同上），或在 Supabase Dashboard SQL Editor 执行该语句。
注意：`ALTER TYPE ... ADD VALUE` 不能与其他语句放进同一事务块——单独执行。

- [ ] **Step 3: 验证枚举已含新值**

用 Supabase MCP `execute_sql`：

```sql
select enumlabel from pg_enum e
join pg_type t on t.oid=e.enumtypid
where t.typname='lead_source' order by e.enumsortorder;
```

Expected: 返回列表包含 `website_quiz`。

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613000001_lead_source_website_quiz.sql
git commit -m "feat(pipeline): add website_quiz lead source enum value"
```

### Task 2: Pipeline 线索来源选项加「网站测评」

**Files:**
- Modify: `components/advisor/pipeline/stages.ts` (PORTAL)
- Test: `components/advisor/pipeline/stages.test.ts` (PORTAL)

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { getLeadSource, LEAD_SOURCES } from './stages';

describe('website_quiz lead source', () => {
  it('exists in LEAD_SOURCES with bilingual labels', () => {
    const src = LEAD_SOURCES.find(s => s.key === 'website_quiz');
    expect(src).toBeDefined();
    expect(src!.zh).toBe('网站测评');
    expect(src!.en).toBe('Website Quiz');
  });
  it('getLeadSource resolves website_quiz', () => {
    expect(getLeadSource('website_quiz')?.zh).toBe('网站测评');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run components/advisor/pipeline/stages.test.ts`
Expected: FAIL（找不到 website_quiz）。

- [ ] **Step 3: 在 LEAD_SOURCES 数组末尾新增一项**

在 `components/advisor/pipeline/stages.ts` 的 `LEAD_SOURCES` 中，`{ key: 'other', ... }` 之后加入：

```ts
  { key: 'website_quiz',     en: 'Website Quiz',        zh: '网站测评' },
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run components/advisor/pipeline/stages.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add components/advisor/pipeline/stages.ts components/advisor/pipeline/stages.test.ts
git commit -m "feat(pipeline): add website_quiz lead source option"
```

---

## Phase 1 — HP 仓库脚手架

### Task 3: 取得 HP 仓库并跑通基线

**Files:** 无（环境准备）

- [ ] **Step 1: Clone**

```bash
cd "D:\XinWealth Portal App"
git clone https://github.com/leonlee-xinwealth/Homepage.git xinwealth-website
cd xinwealth-website
npm install
```

- [ ] **Step 2: 基线构建通过**

Run: `npm run build`
Expected: 构建成功，生成 `dist/`。

- [ ] **Step 3: 本地起服务确认首页正常**

Run: `npm run dev`，浏览器打开本地地址，确认现有营销首页正常渲染、语言切换正常。然后停掉。

### Task 4: 引入 vitest

**Files:**
- Modify: `package.json` (HP)
- Create: `lib/investCheck/sanity.test.ts` (HP)

- [ ] **Step 1: 安装 vitest**

```bash
npm install -D vitest@^4.1.8
```

- [ ] **Step 2: package.json 加 test 脚本**

在 `scripts` 中加入：

```json
    "test": "vitest run",
```

- [ ] **Step 3: 写一个 sanity 测试**

```ts
import { describe, it, expect } from 'vitest';
describe('vitest wired', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 4: 运行通过**

Run: `npm test`
Expected: PASS（1 passed）。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/investCheck/sanity.test.ts
git commit -m "chore: add vitest for unit tests"
```

### Task 5: 抽出 Home 组件 + 路径开关 App

**Files:**
- Create: `Home.tsx` (HP)
- Create: `App.tsx` (HP)
- Modify: `index.tsx` (HP)

- [ ] **Step 1: 把现有首页组件迁入 Home.tsx**

将当前 `index.tsx` 中**整个** `App` 组件（含 `content`、`XinLogo`、`App` 本体及其依赖的 import）剪切到新文件 `Home.tsx`，改为默认导出 `Home`：

```tsx
// Home.tsx —— 原 index.tsx 中的营销首页组件，原样迁入，组件名改为 Home 并默认导出。
import React, { useState, useEffect } from 'react';
import { Heart, TrendingUp, ShieldCheck, Globe, Menu, X, ArrowRight, Users, Leaf, Facebook, Instagram } from 'lucide-react';

// …（原 LINKS / content / XinLogo / 组件主体，原样保留，不改逻辑）…

const Home: React.FC = () => {
  // …原 App 组件函数体原样…
};

export default Home;
```

注意：仅迁移，不改动首页任何渲染逻辑；删去原文件末尾的 `createRoot(...).render(<App/>)` 那段（移到 index.tsx）。

- [ ] **Step 2: 新建 App.tsx 路径开关**

```tsx
// App.tsx —— 极简路径开关：仅 2 个页面，不引入 react-router（YAGNI）
import React from 'react';
import Home from './Home';
import InvestCheck from './invest-check/InvestCheck';

const App: React.FC = () => {
  const path = window.location.pathname;
  if (path.startsWith('/invest-check')) return <InvestCheck />;
  return <Home />;
};

export default App;
```

- [ ] **Step 3: index.tsx 仅负责挂载**

```tsx
// index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
```

- [ ] **Step 4: 临时占位 InvestCheck 以便构建**

先建最小占位（Task 10 会替换）：

```tsx
// invest-check/InvestCheck.tsx （临时占位）
import React from 'react';
const InvestCheck: React.FC = () => <div style={{ padding: 40 }}>Invest Check — coming soon</div>;
export default InvestCheck;
```

- [ ] **Step 5: 构建并手测两条路径**

Run: `npm run build` → Expected: 成功。
Run: `npm run dev` → 访问 `/` 见首页；访问 `/invest-check` 见占位。

- [ ] **Step 6: Commit**

```bash
git add index.tsx App.tsx Home.tsx invest-check/InvestCheck.tsx
git commit -m "refactor: split Home component and add path switch for /invest-check"
```

### Task 6: Vercel SPA rewrite

**Files:**
- Modify: `vercel.json` (HP)

- [ ] **Step 1: 加 rewrites（保留现有 framework/build/output）**

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

说明：Vercel 先匹配文件系统（静态资源、`api/*` 函数），都不命中时才走该 rewrite，把深链 `/invest-check` 回退到 `index.html`。不影响 `api/` 与静态资源。

- [ ] **Step 2: 构建确认无报错**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore: SPA rewrite so /invest-check deep link serves index.html"
```

---

## Phase 2 — 评分逻辑（TDD 纯函数）

### Task 7: 类型与评分表 + computeResult

**Files:**
- Create: `lib/investCheck/types.ts` (HP)
- Create: `lib/investCheck/scoring.ts` (HP)
- Test: `lib/investCheck/scoring.test.ts` (HP)

- [ ] **Step 1: 写类型**

```ts
// lib/investCheck/types.ts
export type DimensionKey = 'action' | 'allocation' | 'growth' | 'control';
export type BandKey = 'low' | 'fair' | 'good' | 'strong';

export interface ScoreResult {
  score: number;                              // 0–100
  dimensions: Record<DimensionKey, number>;   // 各 0–100
  weakest: DimensionKey;
  band: BandKey;
}
```

- [ ] **Step 2: 写失败测试**

```ts
// lib/investCheck/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { computeResult } from './scoring';

describe('computeResult', () => {
  it('maps the spec example answers to score 48, weakest growth', () => {
    const r = computeResult([1, 1, 2, 1, 1, 1, 2, 2]);
    expect(r.dimensions).toEqual({ action: 43, allocation: 40, growth: 35, control: 75 });
    expect(r.score).toBe(48);
    expect(r.weakest).toBe('growth');
    expect(r.band).toBe('fair');
  });

  it('all-min answers => 0 / band low', () => {
    const r = computeResult([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.score).toBe(0);
    expect(r.band).toBe('low');
  });

  it('best answers => 100 / band strong', () => {
    // 每题选「满分」选项的下标。注意 Q2 满分在下标 2（不是末项「不确定」），Q3 满分在下标 4。
    const r = computeResult([3, 2, 4, 3, 3, 3, 3, 3]);
    expect(r.score).toBe(100);
    expect(r.band).toBe('strong');
  });

  it('tie on weakest prefers growth > allocation > action > control', () => {
    // action and growth both 0; growth must win
    const r = computeResult([0, 0, 2, 1, 0, 0, 2, 2]);
    expect(r.dimensions.action).toBe(0);
    expect(r.dimensions.growth).toBe(0);
    expect(r.weakest).toBe('growth');
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run lib/investCheck/scoring.test.ts`
Expected: FAIL（computeResult 未定义）。

- [ ] **Step 4: 实现 scoring.ts**

```ts
// lib/investCheck/scoring.ts
import type { DimensionKey, BandKey, ScoreResult } from './types';

// 每题：选项下标 -> 分值（与规格 4.2 一致）
export const QUESTION_SCORES: number[][] = [
  [0, 35, 70, 100],      // Q1 行动力
  [0, 50, 100, 25],      // Q2 行动力（有不小/有一点/已投/不确定）
  [0, 25, 40, 45, 100],  // Q3 配置力
  [0, 40, 70, 100],      // Q4 配置力
  [0, 35, 70, 100],      // Q5 成长力
  [0, 35, 70, 100],      // Q6 成长力
  [0, 35, 70, 100],      // Q7 掌控力
  [0, 50, 80, 100],      // Q8 掌控力
];

const DIMENSION_QUESTIONS: Record<DimensionKey, [number, number]> = {
  action: [0, 1],
  allocation: [2, 3],
  growth: [4, 5],
  control: [6, 7],
};

// 并列最弱时的优先序（靠前者胜）
const WEAKEST_PRIORITY: DimensionKey[] = ['growth', 'allocation', 'action', 'control'];

function band(score: number): BandKey {
  if (score <= 39) return 'low';
  if (score <= 59) return 'fair';
  if (score <= 79) return 'good';
  return 'strong';
}

export function computeResult(answers: number[]): ScoreResult {
  if (answers.length !== 8) throw new Error('answers must have 8 entries');

  const qScore = answers.map((optIdx, q) => {
    const table = QUESTION_SCORES[q];
    if (optIdx < 0 || optIdx >= table.length) throw new Error(`invalid option ${optIdx} for q${q + 1}`);
    return table[optIdx];
  });

  const dimensions = {} as Record<DimensionKey, number>;
  (Object.keys(DIMENSION_QUESTIONS) as DimensionKey[]).forEach((dim) => {
    const [a, b] = DIMENSION_QUESTIONS[dim];
    dimensions[dim] = Math.round((qScore[a] + qScore[b]) / 2);
  });

  const score = Math.round(
    (dimensions.action + dimensions.allocation + dimensions.growth + dimensions.control) / 4
  );

  const min = Math.min(...Object.values(dimensions));
  const weakest = WEAKEST_PRIORITY.find((d) => dimensions[d] === min)!;

  return { score, dimensions, weakest, band: band(score) };
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run lib/investCheck/scoring.test.ts`
Expected: PASS（4 passed）。

- [ ] **Step 6: Commit**

```bash
git add lib/investCheck/types.ts lib/investCheck/scoring.ts lib/investCheck/scoring.test.ts
git commit -m "feat(invest-check): scoring engine (TDD)"
```

### Task 8: 差距投影计算

**Files:**
- Create: `lib/investCheck/projection.ts` (HP)
- Test: `lib/investCheck/projection.test.ts` (HP)

- [ ] **Step 1: 写失败测试**

```ts
// lib/investCheck/projection.test.ts
import { describe, it, expect } from 'vitest';
import { project, RATE_CURRENT, RATE_MANAGED } from './projection';

describe('project', () => {
  it('uses 3% vs 8% defaults', () => {
    expect(RATE_CURRENT).toBeCloseTo(0.03);
    expect(RATE_MANAGED).toBeCloseTo(0.08);
  });
  it('RM100k over 20y => ~180,611 vs ~466,096, gap ~285,485', () => {
    const r = project(100000, 20);
    expect(Math.round(r.current)).toBe(180611);
    expect(Math.round(r.managed)).toBe(466096);
    expect(Math.round(r.gap)).toBe(285485);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/investCheck/projection.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 projection.ts**

```ts
// lib/investCheck/projection.ts
export const RATE_CURRENT = 0.03; // 定存示意
export const RATE_MANAGED = 0.08; // 专业分散配置示意

export interface Projection { current: number; managed: number; gap: number; }

export function project(amount: number, years: number,
  rCurrent = RATE_CURRENT, rManaged = RATE_MANAGED): Projection {
  const current = amount * Math.pow(1 + rCurrent, years);
  const managed = amount * Math.pow(1 + rManaged, years);
  return { current, managed, gap: managed - current };
}

// 金额 -> 预约表「可投资金额区间」key
export function amountToRange(amount: number): string {
  if (amount < 50000) return 'lt5';
  if (amount < 200000) return '5_20';
  if (amount < 500000) return '20_50';
  return 'gt50';
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/investCheck/projection.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add lib/investCheck/projection.ts lib/investCheck/projection.test.ts
git commit -m "feat(invest-check): projection math (TDD)"
```

### Task 9: WhatsApp 链接构造

**Files:**
- Create: `lib/investCheck/whatsapp.ts` (HP)
- Test: `lib/investCheck/whatsapp.test.ts` (HP)

- [ ] **Step 1: 写失败测试**

```ts
// lib/investCheck/whatsapp.test.ts
import { describe, it, expect } from 'vitest';
import { buildWhatsappUrl } from './whatsapp';

describe('buildWhatsappUrl', () => {
  it('builds a wa.me url with an encoded zh message', () => {
    const url = buildWhatsappUrl('60123456789', {
      score: 48, weakestLabel: '成长力', date: '2026-06-20',
      slotLabel: '下午', rangeLabel: 'RM20–50万', name: '陈先生',
    });
    expect(url.startsWith('https://wa.me/60123456789?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('得分 48');
    expect(text).toContain('成长力');
    expect(text).toContain('陈先生');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/investCheck/whatsapp.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 whatsapp.ts**

```ts
// lib/investCheck/whatsapp.ts
export interface WaParams {
  score: number; weakestLabel: string; date: string;
  slotLabel: string; rangeLabel: string; name: string;
}

export function buildWhatsappUrl(number: string, p: WaParams, locale: 'cn' | 'en' = 'cn'): string {
  const text = locale === 'en'
    ? `Hi Leon 👋 I just finished the Investment Power check. Score: ${p.score}, weakest area: ${p.weakestLabel}. I'd like to book a free consultation: ${p.date} ${p.slotLabel}. Investable range: ${p.rangeLabel}. I'm ${p.name}. Thanks!`
    : `Hi Leon 👋 我刚做完「投资力自测」，得分 ${p.score}，最弱项是${p.weakestLabel}。想预约免费咨询：${p.date} ${p.slotLabel}。可投资范围：${p.rangeLabel}。我是${p.name}，谢谢！`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/investCheck/whatsapp.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add lib/investCheck/whatsapp.ts lib/investCheck/whatsapp.test.ts
git commit -m "feat(invest-check): WhatsApp deep-link builder (TDD)"
```

---

## Phase 3 — 双语文案与状态机

### Task 10: content.ts 双语文案

**Files:**
- Create: `lib/investCheck/content.ts` (HP)

- [ ] **Step 1: 写 content.ts（中文 canonical；英文 Task 21 补全，先放占位英文键）**

```ts
// lib/investCheck/content.ts
import type { DimensionKey, BandKey } from './types';

export type Lang = 'cn' | 'en';

export interface QuestionContent { q: string; options: string[]; }

export interface InvestCheckContent {
  intro: { title: string; subtitle: string; cta: string; trust: string };
  progress: (cur: number, total: number) => string;
  questions: QuestionContent[];                       // 8 题，与 scoring QUESTION_SCORES 顺序一致
  dimensionLabels: Record<DimensionKey, string>;
  bandHeadline: Record<BandKey, string>;
  bandSub: Record<BandKey, string>;
  gapCallout: Record<DimensionKey, string>;           // 「你最大的缺口」文案
  helpActions: Record<DimensionKey, [string, string, string]>; // 「我能帮你做 3 件事」
  result: { ringLabel: string; dimsTitle: string; weakBadge: string;
    projTitle: string; projDrag: string; amountLabel: string;
    barCurrent: string; barManaged: string; gapLabel: (y: number) => string;
    disclaimer: string; helpTitle: string; cta: string; ctaMicro: string };
  booking: { title: string; sub: string; name: string; whatsapp: string;
    amount: string; date: string; slot: string;
    slots: { morning: string; afternoon: string; evening: string };
    ranges: { lt5: string; '5_20': string; '20_50': string; gt50: string; unsure: string };
    submit: string; privacy: string };
  confirm: { title: string; sub: string; waButton: string; msgLabel: string;
    pipelineNote: string; safetyNote: string };
}

const cn: InvestCheckContent = {
  intro: {
    title: '你的钱，真的在替你工作吗？',
    subtitle: '1 分钟测出你的投资力，看看你和「专业打理」之间，差了多少。',
    cta: '开始免费测评 →',
    trust: '免费 · 无需注册 · 匿名 · 约 2 分钟',
  },
  progress: (c, t) => `第 ${c} / ${t} 题`,
  questions: [
    { q: '扣掉日常开销和应急金，你大概有多少比例的钱真正投入了投资（股票/基金/PRS/ETF 等）？',
      options: ['几乎没有，大多是现金或定存', '少部分，不到 25%', '一部分，25–50%', '大部分，超过 50%'] },
    { q: '你的定存/活期里，有没有一笔超过 6 个月生活费、却一直没拿去投资的「闲钱」？',
      options: ['有，而且金额不小', '有一点', '没有，该投的基本都投了', '不太确定'] },
    { q: '你的资产/投资目前主要集中在哪里？',
      options: ['我几乎没有投资', '几乎只有定存/储蓄保险', '几乎全压在房产', '集中在少数几只本地股票/单一标的', '跨股票、基金、债券等多类资产分散'] },
    { q: '你的投资里，有没有「海外/全球」配置（而不只是马来西亚本地）？',
      options: ['不清楚 / 我没投资', '几乎全是本地', '有少部分海外', '有相当比例做了全球分散'] },
    { q: '你知道自己的投资过去一年大概赚了多少 %（有没有跑赢通胀 ~4%）吗？',
      options: ['完全不知道 / 没投资', '大概知道，但跑不赢通胀', '勉强跑赢一点', '清楚知道，回报还不错'] },
    { q: '除了 EPF，你有没有额外为退休做投资（例如 PRS、长期基金）？',
      options: ['完全没有，退休只靠 EPF', '想过，但还没开始', '有一点点', '有在持续投入'] },
    { q: '你的投资有清晰的目标和时间表吗（例如「15 年后退休要存到 200 万」）？',
      options: ['完全没有，凭感觉', '有个模糊的想法', '有大致方向', '有明确目标和计划'] },
    { q: '你通常怎么做投资决定？',
      options: ['听消息/朋友推荐就买', '自己研究，但没什么系统', '有定期定额、比较有纪律', '有专业顾问帮我规划'] },
  ],
  dimensionLabels: { action: '行动力', allocation: '配置力', growth: '成长力', control: '掌控力' },
  bandHeadline: {
    low: '你的钱，还没在好好替你工作',
    fair: '起步了，但漏洞不少',
    good: '基础不错，仍有提升空间',
    strong: '投资力很强，可以锦上添花',
  },
  bandSub: {
    low: '得分偏低 — 但好消息是，提升空间很大。',
    fair: '已经起步，几个关键缺口补上，效果会很明显。',
    good: '基础扎实，再优化配置能更进一步。',
    strong: '你已经做得很好，一些细节调整能锦上添花。',
  },
  gapCallout: {
    action: '你有不少资金闲置在现金/定存，正被通胀慢慢侵蚀——表面没亏，实际每年都在缩水。',
    allocation: '你的资产过度集中（房产/定存/单一标的），一旦该类资产波动，风险会很大。',
    growth: '你的投资大概率跑不赢通胀，退休又几乎只靠 EPF，长期购买力在缩水。',
    control: '你的投资偏凭感觉、缺目标和纪律，容易追涨杀跌、半途而废。',
  },
  helpActions: {
    action: ['把闲置/定存的钱挪进能增值的组合，先跑赢通胀', '保留合理应急金，其余高效配置', '建立每月自动投资的现金流'],
    allocation: ['跨资产类别分散，降低单一资产风险', '加入全球/海外配置，不再只押本地', '按风险承受度调到合适的攻守比例'],
    growth: ['构建能长期跑赢通胀的增值组合', '用 PRS + 长期基金补上退休缺口', '用复利和时间，把躺平的钱变成会生钱的钱'],
    control: ['设定清晰的财务目标与时间表', '建立定期定额的投资纪律', '由专业顾问定期检视、动态调整'],
  },
  result: {
    ringLabel: '投资力指数', dimsTitle: '四个维度', weakBadge: '最弱',
    projTitle: '🔥 如果交给专业打理，会差多少？', projDrag: '拖动看看你的数字',
    amountLabel: '可投资金额', barCurrent: '钱继续躺着（定存 ~3%）', barManaged: '专业分散配置（参考 ~8%）',
    gapLabel: (y) => `这 ${y} 年，差距可能高达`,
    disclaimer: '* 数字仅为示意，采用假设年化回报，非保证收益。实际结果因市场与产品而异。',
    helpTitle: '针对你的情况，我能帮你做 3 件事',
    cta: '预约免费咨询，拿回这笔差距 →', ctaMicro: '30 分钟线上咨询 · 完全免费 · 不强迫购买',
  },
  booking: {
    title: '预约免费咨询', sub: '30 分钟 · 完全免费 · 不强迫购买',
    name: '姓名', whatsapp: 'WhatsApp 号码', amount: '可投资金额区间', date: '方便的日期', slot: '方便的时段',
    slots: { morning: '上午', afternoon: '下午', evening: '晚上' },
    ranges: { lt5: '少于 RM5万', '5_20': 'RM5–20万', '20_50': 'RM20–50万', gt50: 'RM50万以上', unsure: '还不确定' },
    submit: '提交预约 →',
    privacy: '提交即表示同意 XinWealth 就此次咨询与你联系。我们不会把你的资料分享给第三方。',
  },
  confirm: {
    title: '预约已收到！',
    sub: '最后一步：点下方按钮，用 WhatsApp 把你的预约发给 Leon，他会顺着这条消息跟你确认时间。',
    waButton: '用 WhatsApp 发送给 Leon', msgLabel: '将自动填好这段消息 ▾',
    pipelineNote: '你的预约已进入顾问跟进列表，Leon 也会主动 WhatsApp 你。',
    safetyNote: '双保险：你主动发 WhatsApp（最理想）＋ 顾问已收到你的预约（兜底）。',
  },
};

// 占位：先复用中文，Task 21 替换为英文
const en: InvestCheckContent = cn;

export const CONTENT: Record<Lang, InvestCheckContent> = { cn, en };
```

- [ ] **Step 2: 类型检查通过**

Run: `npx tsc --noEmit`
Expected: 无新错误（与本文件相关）。

- [ ] **Step 3: Commit**

```bash
git add lib/investCheck/content.ts
git commit -m "feat(invest-check): bilingual content (cn canonical, en placeholder)"
```

### Task 11: InvestCheck 状态机容器

**Files:**
- Modify: `invest-check/InvestCheck.tsx` (HP，替换占位)

- [ ] **Step 1: 实现状态机（先用临时子组件占位，后续任务替换为真实组件）**

```tsx
// invest-check/InvestCheck.tsx
import React, { useState } from 'react';
import { CONTENT, type Lang } from '../lib/investCheck/content';
import { computeResult } from '../lib/investCheck/scoring';
import type { ScoreResult } from '../lib/investCheck/types';
import IntroScreen from './IntroScreen';
import Quiz from './Quiz';
import ResultPage from './ResultPage';
import BookingForm from './BookingForm';
import ConfirmScreen from './ConfirmScreen';

type Step = 'intro' | 'quiz' | 'result' | 'booking' | 'confirm';

export interface BookingData {
  name: string; whatsapp: string; investable_range: string;
  preferred_date: string; preferred_time_slot: 'morning' | 'afternoon' | 'evening';
}

const InvestCheck: React.FC = () => {
  const [lang, setLang] = useState<Lang>('cn');
  const [step, setStep] = useState<Step>('intro');
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [projectionAmount, setProjectionAmount] = useState<number>(100000);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const t = CONTENT[lang];

  const onQuizDone = (a: number[]) => { setAnswers(a); setResult(computeResult(a)); setStep('result'); };

  return (
    <div className="min-h-screen bg-xin-bg text-xin-blue font-sans">
      <div className="max-w-xl mx-auto px-4 py-6">
        {step === 'intro' && <IntroScreen t={t} lang={lang} setLang={setLang} onStart={() => setStep('quiz')} />}
        {step === 'quiz' && <Quiz t={t} onDone={onQuizDone} />}
        {step === 'result' && result &&
          <ResultPage t={t} result={result} amount={projectionAmount} setAmount={setProjectionAmount}
            onBook={() => setStep('booking')} />}
        {step === 'booking' && result &&
          <BookingForm t={t} lang={lang} answers={answers} result={result} projectionAmount={projectionAmount}
            onSubmitted={(b) => { setBooking(b); setStep('confirm'); }} />}
        {step === 'confirm' && result && booking &&
          <ConfirmScreen t={t} lang={lang} result={result} booking={booking} />}
      </div>
    </div>
  );
};

export default InvestCheck;
```

- [ ] **Step 2: 暂时让构建通过**

为下列尚未创建的组件建最小占位（接受对应 props 并渲染占位文字），使 `npm run build` 通过：`IntroScreen`、`Quiz`、`ResultPage`、`BookingForm`、`ConfirmScreen`。每个占位形如：

```tsx
import React from 'react';
const IntroScreen: React.FC<any> = () => <div>intro</div>;
export default IntroScreen;
```

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: Commit**

```bash
git add invest-check/
git commit -m "feat(invest-check): step state machine container with placeholders"
```

---

## Phase 4 — 测评界面

### Task 12: IntroScreen 引导页

**Files:**
- Modify: `invest-check/IntroScreen.tsx` (HP)

- [ ] **Step 1: 实现引导页**

```tsx
// invest-check/IntroScreen.tsx
import React from 'react';
import type { InvestCheckContent, Lang } from '../lib/investCheck/content';

interface Props { t: InvestCheckContent; lang: Lang; setLang: (l: Lang) => void; onStart: () => void; }

const IntroScreen: React.FC<Props> = ({ t, lang, setLang, onStart }) => (
  <div className="text-center pt-10">
    <button onClick={() => setLang(lang === 'cn' ? 'en' : 'cn')}
      className="absolute top-4 right-4 text-xs font-bold text-xin-blue/60 hover:text-xin-gold">
      {lang === 'cn' ? 'EN' : '中文'}
    </button>
    <div className="text-[11px] tracking-[0.3em] uppercase text-xin-gold font-bold mb-6">XinWealth · 投资力自测</div>
    <h1 className="text-3xl md:text-4xl font-black leading-tight mb-4">{t.intro.title}</h1>
    <p className="text-slate-500 text-lg leading-relaxed mb-10 max-w-md mx-auto">{t.intro.subtitle}</p>
    <button onClick={onStart}
      className="bg-xin-blue text-white px-10 py-4 rounded-full text-base font-bold shadow-xl shadow-xin-blue/20 hover:-translate-y-0.5 transition">
      {t.intro.cta}
    </button>
    <p className="text-xs text-slate-400 mt-6">{t.intro.trust}</p>
  </div>
);

export default IntroScreen;
```

- [ ] **Step 2: 手测**

Run: `npm run dev` → `/invest-check` 显示引导页，语言切换可用，点 CTA 进入 quiz（下一任务实现题目）。

- [ ] **Step 3: Commit**

```bash
git add invest-check/IntroScreen.tsx
git commit -m "feat(invest-check): intro screen"
```

### Task 13: Quiz 逐题测评

**Files:**
- Modify: `invest-check/Quiz.tsx` (HP)

- [ ] **Step 1: 实现 Quiz（不显示任何分数）**

```tsx
// invest-check/Quiz.tsx
import React, { useState } from 'react';
import type { InvestCheckContent } from '../lib/investCheck/content';

interface Props { t: InvestCheckContent; onDone: (answers: number[]) => void; }

const Quiz: React.FC<Props> = ({ t, onDone }) => {
  const total = t.questions.length;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const q = t.questions[idx];

  const choose = (optIdx: number) => {
    const next = [...answers];
    next[idx] = optIdx;
    setAnswers(next);
    if (idx + 1 < total) setIdx(idx + 1);
    else onDone(next);
  };

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-slate-400">{t.progress(idx + 1, total)}</span>
        {idx > 0 && <button onClick={() => setIdx(idx - 1)} className="text-xs text-slate-400 hover:text-xin-blue">← 上一题</button>}
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full mb-8 overflow-hidden">
        <div className="h-full bg-xin-gold rounded-full transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <h2 className="text-xl font-bold leading-snug mb-7">{q.q}</h2>
      <div className="space-y-3">
        {q.options.map((opt, i) => (
          <button key={i} onClick={() => choose(i)}
            className={`w-full text-left px-5 py-4 rounded-xl border transition text-[15px]
              ${answers[idx] === i ? 'border-xin-blue bg-xin-blue text-white' : 'border-slate-200 bg-white hover:border-xin-gold'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Quiz;
```

- [ ] **Step 2: 手测全流程**

Run: `npm run dev` → 答完 8 题进入结果页占位；确认进度条、上一题、选项高亮正常，**界面无任何分数**。

- [ ] **Step 3: Commit**

```bash
git add invest-check/Quiz.tsx
git commit -m "feat(invest-check): question stepper (no scores shown)"
```

---

## Phase 5 — 结果页与投影

### Task 14: Projection 交互组件

**Files:**
- Modify: `invest-check/Projection.tsx` (HP，新建真实组件，替换 Task 11 未涉及的占位)

- [ ] **Step 1: 实现 Projection**

```tsx
// invest-check/Projection.tsx
import React, { useState } from 'react';
import type { InvestCheckContent } from '../lib/investCheck/content';
import { project } from '../lib/investCheck/projection';

interface Props { t: InvestCheckContent; amount: number; setAmount: (n: number) => void; }
const fmt = (n: number) => 'RM ' + Math.round(n).toLocaleString('en-US');

const Projection: React.FC<Props> = ({ t, amount, setAmount }) => {
  const [years, setYears] = useState(20);
  const { current, managed, gap } = project(amount, years);
  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 mt-5">
      <div className="font-extrabold">{t.result.projTitle}</div>
      <div className="text-xs text-slate-400 mb-4">{t.result.projDrag}</div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-slate-300">{t.result.amountLabel}</span>
        <span className="text-xl font-extrabold text-amber-400">{fmt(amount)}</span>
      </div>
      <input type="range" min={10000} max={1000000} step={10000} value={amount}
        onChange={(e) => setAmount(+e.target.value)} className="w-full accent-amber-400 mb-4" />
      <div className="flex gap-2 mb-5">
        {[10, 20, 30].map((y) => (
          <button key={y} onClick={() => setYears(y)}
            className={`flex-1 py-2 rounded-lg text-xs border ${years === y ? 'bg-amber-400 text-slate-900 font-extrabold border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
            {y} 年后
          </button>
        ))}
      </div>
      {[{ l: t.result.barCurrent, v: current, w: (current / managed) * 100, c: 'bg-slate-500' },
        { l: t.result.barManaged, v: managed, w: 100, c: 'bg-gradient-to-r from-amber-500 to-amber-400' }].map((b, i) => (
        <div key={i} className="mb-3">
          <div className="flex justify-between text-xs mb-1.5"><span>{b.l}</span><span className="font-extrabold">{fmt(b.v)}</span></div>
          <div className="h-3.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full rounded-full ${b.c}`} style={{ width: `${b.w}%` }} /></div>
        </div>
      ))}
      <div className="text-center mt-4 pt-4 border-t border-dashed border-slate-700">
        <div className="text-xs text-slate-300">{t.result.gapLabel(years)}</div>
        <div className="text-3xl font-black text-amber-400">{fmt(gap)}</div>
      </div>
      <div className="text-[10px] text-slate-500 mt-3 text-center leading-relaxed">{t.result.disclaimer}</div>
    </div>
  );
};

export default Projection;
```

- [ ] **Step 2: 构建通过**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: Commit**

```bash
git add invest-check/Projection.tsx
git commit -m "feat(invest-check): interactive projection (3% vs 8%)"
```

### Task 15: ResultPage 结果页

**Files:**
- Modify: `invest-check/ResultPage.tsx` (HP)

- [ ] **Step 1: 实现 ResultPage**

```tsx
// invest-check/ResultPage.tsx
import React from 'react';
import type { InvestCheckContent } from '../lib/investCheck/content';
import type { ScoreResult, DimensionKey } from '../lib/investCheck/types';
import Projection from './Projection';

interface Props {
  t: InvestCheckContent; result: ScoreResult;
  amount: number; setAmount: (n: number) => void; onBook: () => void;
}

const DIM_ORDER: DimensionKey[] = ['action', 'allocation', 'growth', 'control'];
const barColor = (v: number) => v >= 60 ? '#16a34a' : v >= 40 ? '#f59e0b' : '#dc2626';

const ResultPage: React.FC<Props> = ({ t, result, amount, setAmount, onBook }) => {
  const { score, dimensions, weakest, band } = result;
  const circ = 2 * Math.PI * 56;
  return (
    <div className="pt-4">
      {/* hero */}
      <div className="bg-gradient-to-br from-[#1e3a5f] to-xin-blue text-white rounded-2xl p-6 text-center">
        <div className="relative w-32 h-32 mx-auto mb-2">
          <svg width="128" height="128" className="-rotate-90">
            <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,.18)" strokeWidth="11" fill="none" />
            <circle cx="64" cy="64" r="56" stroke="#fbbf24" strokeWidth="11" fill="none" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-4xl">{score}</b><span className="text-[11px] opacity-80">{t.result.ringLabel}</span>
          </div>
        </div>
        <h1 className="text-xl font-black mt-1">{t.bandHeadline[band]}</h1>
        <p className="text-sm opacity-90">{t.bandSub[band]}</p>
      </div>

      {/* dimensions */}
      <h2 className="text-sm font-bold text-slate-600 mt-6 mb-3">{t.result.dimsTitle}</h2>
      {DIM_ORDER.map((d) => (
        <div key={d} className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className={d === weakest ? 'text-red-600 font-bold' : ''}>
              {t.dimensionLabels[d]}
              {d === weakest && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{t.result.weakBadge}</span>}
            </span>
            <span className="text-slate-500 tabular-nums">{dimensions[d]}</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${dimensions[d]}%`, background: barColor(dimensions[d]) }} />
          </div>
        </div>
      ))}

      {/* gap callout */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 mt-5">
        <div className="text-[13px] font-bold text-orange-700 mb-1">⚠️ 你最大的缺口：{t.dimensionLabels[weakest]}</div>
        <div className="text-[12.5px] text-orange-900 leading-relaxed">{t.gapCallout[weakest]}</div>
      </div>

      {/* projection */}
      <Projection t={t} amount={amount} setAmount={setAmount} />

      {/* 3 help actions (weakest dimension) */}
      <h2 className="text-sm font-bold text-slate-600 mt-6 mb-3">{t.result.helpTitle}</h2>
      {t.helpActions[weakest].map((a, i) => (
        <div key={i} className="flex gap-2.5 text-sm text-slate-700 mb-2.5 leading-relaxed">
          <span className="text-xin-blue font-black">{i + 1}.</span><span>{a}</span>
        </div>
      ))}

      {/* CTA */}
      <button onClick={onBook}
        className="w-full mt-6 bg-gradient-to-r from-xin-blue to-[#2563eb] text-white rounded-2xl py-4 font-extrabold text-base shadow-lg shadow-xin-blue/30">
        {t.result.cta}
      </button>
      <div className="text-center text-[11.5px] text-slate-400 mt-2">{t.result.ctaMicro}</div>
    </div>
  );
};

export default ResultPage;
```

- [ ] **Step 2: 手测**

Run: `npm run dev` → 走完测评，结果页正确显示总分环、四维度（最弱高亮）、缺口文案、投影（可拖动）、3 件事、CTA。换不同答案组合验证最弱维度联动。

- [ ] **Step 3: Commit**

```bash
git add invest-check/ResultPage.tsx
git commit -m "feat(invest-check): result page with dynamic weakest-dimension copy"
```

---

## Phase 6 — 预约、提交、WhatsApp 衔接

### Task 16: api/_lib（supabase + scoring 镜像）

**Files:**
- Create: `api/_lib/supabase.js` (HP)
- Create: `api/_lib/scoring.js` (HP)

- [ ] **Step 1: supabase.js（admin client）**

```js
// api/_lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null;
```

- [ ] **Step 2: scoring.js（lib/investCheck/scoring.ts 的 JS 镜像）**

```js
// api/_lib/scoring.js
// NOTE: 必须与 lib/investCheck/scoring.ts 保持同步（同 portal 的 prsSync.ts/prs-application.js 模式）。
export const QUESTION_SCORES = [
  [0, 35, 70, 100], [0, 50, 100, 25], [0, 25, 40, 45, 100], [0, 40, 70, 100],
  [0, 35, 70, 100], [0, 35, 70, 100], [0, 35, 70, 100], [0, 50, 80, 100],
];
const DIM = { action: [0, 1], allocation: [2, 3], growth: [4, 5], control: [6, 7] };
const WEAKEST_PRIORITY = ['growth', 'allocation', 'action', 'control'];

function band(s) { return s <= 39 ? 'low' : s <= 59 ? 'fair' : s <= 79 ? 'good' : 'strong'; }

export function computeResult(answers) {
  if (!Array.isArray(answers) || answers.length !== 8) throw new Error('answers must have 8 entries');
  const q = answers.map((idx, i) => {
    const tbl = QUESTION_SCORES[i];
    if (!Number.isInteger(idx) || idx < 0 || idx >= tbl.length) throw new Error(`invalid option for q${i + 1}`);
    return tbl[idx];
  });
  const dimensions = {};
  for (const d of Object.keys(DIM)) dimensions[d] = Math.round((q[DIM[d][0]] + q[DIM[d][1]]) / 2);
  const score = Math.round((dimensions.action + dimensions.allocation + dimensions.growth + dimensions.control) / 4);
  const min = Math.min(...Object.values(dimensions));
  const weakest = WEAKEST_PRIORITY.find((d) => dimensions[d] === min);
  return { score, dimensions, weakest, band: band(score) };
}
```

- [ ] **Step 3: 安装 supabase-js**

```bash
npm install @supabase/supabase-js@^2.104.1
```

- [ ] **Step 4: Commit**

```bash
git add api/_lib/ package.json package-lock.json
git commit -m "feat(invest-check): serverless supabase admin + scoring mirror"
```

### Task 17: api/lead.js 线索写入

**Files:**
- Create: `api/lead.js` (HP)

- [ ] **Step 1: 实现 POST 端点**

```js
// api/lead.js
import { supabaseAdmin } from './_lib/supabase.js';
import { computeResult } from './_lib/scoring.js';

const SLOTS = ['morning', 'afternoon', 'evening'];
const RANGES = ['lt5', '5_20', '20_50', 'gt50', 'unsure'];
const WEAK_ZH = { action: '行动力', allocation: '配置力', growth: '成长力', control: '掌控力' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' });

  try {
    const b = req.body || {};
    // honeypot：静默成功但不落库
    if (b.hp) return res.status(200).json({ success: true });

    const name = String(b.name || '').trim();
    const whatsapp = String(b.whatsapp || '').trim();
    if (!name) return res.status(400).json({ error: 'NAME_REQUIRED' });
    if (!whatsapp) return res.status(400).json({ error: 'WHATSAPP_REQUIRED' });

    let result;
    try { result = computeResult(b.answers); }
    catch { return res.status(400).json({ error: 'INVALID_ANSWERS' }); }

    const investable_range = RANGES.includes(b.investable_range) ? b.investable_range : 'unsure';
    const slot = SLOTS.includes(b.preferred_time_slot) ? b.preferred_time_slot : null;
    const locale = b.locale === 'en' ? 'en' : 'cn';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.preferred_date || '') ? b.preferred_date : null;

    const metadata = {
      source: 'invest_check',
      score: result.score, dimensions: result.dimensions, weakest: result.weakest,
      weakest_label_zh: WEAK_ZH[result.weakest],
      answers: b.answers, investable_range,
      preferred_date: date, preferred_time_slot: slot,
      projection_amount: Number(b.projection_amount) || null,
      submitted_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('clients').insert({
      advisor_id: process.env.LEON_ADVISOR_ID,
      full_name: name,
      phone: whatsapp,
      status: 'prospect',
      pipeline_stage: 'new_lead',
      lead_source: 'website_quiz',
      locale,
      next_action: 'WhatsApp 跟进（网站测评）',
      next_action_date: date,
      metadata,
    });
    if (error) throw new Error(error.message);

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('lead API error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/lead.js
git commit -m "feat(invest-check): /api/lead — validate, recompute score, insert lead"
```

### Task 18: BookingForm 预约表单

**Files:**
- Modify: `invest-check/BookingForm.tsx` (HP)

- [ ] **Step 1: 实现表单（含 honeypot、金额区间预填、提交 POST）**

```tsx
// invest-check/BookingForm.tsx
import React, { useState } from 'react';
import type { InvestCheckContent, Lang } from '../lib/investCheck/content';
import type { ScoreResult } from '../lib/investCheck/types';
import { amountToRange } from '../lib/investCheck/projection';
import type { BookingData } from './InvestCheck';

interface Props {
  t: InvestCheckContent; lang: Lang; answers: number[]; result: ScoreResult;
  projectionAmount: number; onSubmitted: (b: BookingData) => void;
}
type Slot = 'morning' | 'afternoon' | 'evening';
const RANGE_KEYS = ['lt5', '5_20', '20_50', 'gt50', 'unsure'] as const;

const BookingForm: React.FC<Props> = ({ t, lang, answers, result, projectionAmount, onSubmitted }) => {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [range, setRange] = useState<string>(amountToRange(projectionAmount));
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<Slot>('afternoon');
  const [hp, setHp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim() || !date) { setErr('请填写姓名、WhatsApp 和日期'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, whatsapp, investable_range: range, preferred_date: date,
          preferred_time_slot: slot, locale: lang, projection_amount: projectionAmount, answers, hp,
        }),
      });
      if (!r.ok) throw new Error('submit failed');
      onSubmitted({ name, whatsapp, investable_range: range, preferred_date: date, preferred_time_slot: slot });
    } catch { setErr('提交失败，请稍后再试'); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="pt-6">
      <h1 className="text-2xl font-black mb-1">{t.booking.title}</h1>
      <p className="text-sm text-slate-500 mb-6">{t.booking.sub}</p>

      <label className="block text-xs font-bold text-slate-600 mb-1.5">{t.booking.name}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 mb-4" />

      <label className="block text-xs font-bold text-slate-600 mb-1.5">{t.booking.whatsapp}</label>
      <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 mb-4" />

      <label className="block text-xs font-bold text-slate-600 mb-1.5">{t.booking.amount}</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {RANGE_KEYS.map((k) => (
          <button type="button" key={k} onClick={() => setRange(k)}
            className={`px-3 py-2 rounded-lg text-sm border ${range === k ? 'bg-xin-blue text-white border-xin-blue font-bold' : 'bg-white border-slate-300'}`}>
            {t.booking.ranges[k]}
          </button>
        ))}
      </div>

      <label className="block text-xs font-bold text-slate-600 mb-1.5">{t.booking.date}</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 mb-4" />

      <label className="block text-xs font-bold text-slate-600 mb-1.5">{t.booking.slot}</label>
      <div className="flex gap-2 mb-5">
        {(['morning', 'afternoon', 'evening'] as Slot[]).map((s) => (
          <button type="button" key={s} onClick={() => setSlot(s)}
            className={`flex-1 py-2 rounded-lg text-sm border ${slot === s ? 'bg-xin-blue text-white border-xin-blue font-bold' : 'bg-white border-slate-300'}`}>
            {t.booking.slots[s]}
          </button>
        ))}
      </div>

      {/* honeypot：隐藏，机器人才会填 */}
      <input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off"
        className="hidden" aria-hidden="true" />

      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
      <button type="submit" disabled={busy}
        className="w-full bg-gradient-to-r from-xin-blue to-[#1d4ed8] text-white rounded-xl py-3.5 font-extrabold disabled:opacity-60">
        {busy ? '提交中…' : t.booking.submit}
      </button>
      <p className="text-[10.5px] text-slate-400 text-center mt-3 leading-relaxed">{t.booking.privacy}</p>
    </form>
  );
};

export default BookingForm;
```

- [ ] **Step 2: 构建通过**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: Commit**

```bash
git add invest-check/BookingForm.tsx
git commit -m "feat(invest-check): booking form with honeypot + lead submit"
```

### Task 19: ConfirmScreen 确认页 + WhatsApp

**Files:**
- Modify: `invest-check/ConfirmScreen.tsx` (HP)

- [ ] **Step 1: 实现确认页**

```tsx
// invest-check/ConfirmScreen.tsx
import React from 'react';
import type { InvestCheckContent, Lang } from '../lib/investCheck/content';
import type { ScoreResult } from '../lib/investCheck/types';
import type { BookingData } from './InvestCheck';
import { buildWhatsappUrl } from '../lib/investCheck/whatsapp';

interface Props { t: InvestCheckContent; lang: Lang; result: ScoreResult; booking: BookingData; }

const WA_NUMBER = (import.meta as any).env?.VITE_ADVISOR_WA_NUMBER || '60000000000';

const ConfirmScreen: React.FC<Props> = ({ t, lang, result, booking }) => {
  const slotLabel = t.booking.slots[booking.preferred_time_slot];
  const rangeLabel = t.booking.ranges[booking.investable_range as keyof typeof t.booking.ranges];
  const waUrl = buildWhatsappUrl(WA_NUMBER, {
    score: result.score, weakestLabel: t.dimensionLabels[result.weakest],
    date: booking.preferred_date, slotLabel, rangeLabel, name: booking.name,
  }, lang);

  return (
    <div className="pt-10 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 text-3xl flex items-center justify-center mx-auto mb-4">✓</div>
      <h1 className="text-2xl font-black mb-2">{t.confirm.title}</h1>
      <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">{t.confirm.sub}</p>

      <a href={waUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full bg-[#25d366] text-white rounded-xl py-4 font-extrabold">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24z" /></svg>
        {t.confirm.waButton}
      </a>

      <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-4 text-left text-[12.5px] text-green-900 leading-relaxed">
        <div className="text-[10px] font-bold text-green-700 uppercase mb-1.5">{t.confirm.msgLabel}</div>
        Hi Leon 👋 我刚做完「投资力自测」，得分 <b>{result.score}</b>，最弱项是<b>{t.dimensionLabels[result.weakest]}</b>。
        想预约免费咨询：<b>{booking.preferred_date} {slotLabel}</b>。可投资范围：<b>{rangeLabel}</b>。我是{booking.name}，谢谢！
      </div>

      <div className="bg-blue-50 border border-dashed border-blue-300 rounded-lg p-2.5 mt-3 text-[11.5px] text-blue-800">{t.confirm.pipelineNote}</div>
      <p className="text-[11.5px] text-slate-400 mt-3">{t.confirm.safetyNote}</p>
    </div>
  );
};

export default ConfirmScreen;
```

- [ ] **Step 2: 构建通过**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: Commit**

```bash
git add invest-check/ConfirmScreen.tsx
git commit -m "feat(invest-check): confirm screen with WhatsApp deep-link"
```

---

## Phase 7 — 环境、英文、Portal 展示、验收

### Task 20: 环境变量样板与本地联调

**Files:**
- Create: `.env.example` (HP)

- [ ] **Step 1: 写 .env.example**

```bash
# Supabase（与 portal 同一个项目）—— 仅 serverless 用
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# 落库归属顾问（Leon 在 profiles 表的 id）
LEON_ADVISOR_ID=
# 浏览器可见：WhatsApp 号码（国际格式无 +，如 60123456789）
VITE_ADVISOR_WA_NUMBER=
```

- [ ] **Step 2: 本地联调一次真实写入**

用 Leon 提供的真实值建本地 `.env`（vercel dev 会注入）。安装并运行 Vercel 本地环境：

```bash
npm i -g vercel   # 如未安装
vercel dev
```

走完整漏斗并提交，用 Supabase MCP `execute_sql` 验证：

```sql
select full_name, phone, lead_source, pipeline_stage, status, metadata->>'source' as src, metadata->>'score' as score
from clients where lead_source='website_quiz' order by created_at desc limit 1;
```

Expected: 返回刚提交的那条，`src=invest_check`、`score` 与界面一致、`lead_source=website_quiz`、`pipeline_stage=new_lead`。

- [ ] **Step 3: 在 Vercel 项目后台配置同名环境变量**（Production + Preview）。

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore(invest-check): env var template"
```

### Task 21: 英文文案

**Files:**
- Modify: `lib/investCheck/content.ts` (HP)

- [ ] **Step 1: 用真实英文替换 `const en = cn`**

按 `InvestCheckContent` 结构逐字段翻译（题目、选项、结果文案、维度标签 action/allocation/growth/control、缺口、3 件事、预约标签、确认文案）。维度标签英文：`{ action:'Action', allocation:'Allocation', growth:'Growth', control:'Control' }`。保持与中文同义、口吻一致。

- [ ] **Step 2: 类型检查 + 双语手测**

Run: `npx tsc --noEmit` → 无新错误。
Run: `npm run dev` → 切到 EN，全流程文案完整无中文残留；WhatsApp 模板用英文版。

- [ ] **Step 3: Commit**

```bash
git add lib/investCheck/content.ts
git commit -m "feat(invest-check): English content"
```

### Task 22: Portal 线索详情展示测评背景（可选增强）

**Files:**
- Modify: `components/advisor/pipeline/LeadDetailPanel.tsx` (PORTAL)

- [ ] **Step 1: 读现有组件，确认它能拿到该线索的 `metadata`**

阅读 `components/advisor/pipeline/LeadDetailPanel.tsx` 与其数据来源（`Lead`/clients 查询）。若当前查询未 select `metadata`，在数据获取处补上 `metadata`。

- [ ] **Step 2: 当 `metadata.source === 'invest_check'` 时渲染一块「网站测评背景」**

在面板合适位置加入（遵循该文件现有 className 风格）：

```tsx
{lead.metadata?.source === 'invest_check' && (
  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
    <div className="font-bold text-blue-800 mb-1">网站测评背景</div>
    <div>投资力指数：<b>{lead.metadata.score}</b> · 最弱：{lead.metadata.weakest_label_zh}</div>
    <div>可投资区间：{lead.metadata.investable_range} · 偏好：{lead.metadata.preferred_date} {lead.metadata.preferred_time_slot}</div>
  </div>
)}
```

若 `Lead` 类型无 `metadata` 字段，在 `components/advisor/pipeline/types.ts` 的 `Lead` 接口补 `metadata?: any;`（或更精确的可选结构）。

- [ ] **Step 3: 类型检查 + 手测**

Run（PORTAL）: `npx tsc --noEmit` → 无新错误。
在 portal 打开一条 `website_quiz` 线索，确认背景块显示。

- [ ] **Step 4: Commit（PORTAL）**

```bash
git add components/advisor/pipeline/LeadDetailPanel.tsx components/advisor/pipeline/types.ts
git commit -m "feat(pipeline): show invest-check quiz context on lead detail"
```

### Task 23: 全量验收

**Files:** 无（验证）

- [ ] **Step 1: HP 单测与构建**

Run（HP）: `npm test` → 全绿（scoring/projection/whatsapp/sanity）。
Run（HP）: `npm run build` → 成功。

- [ ] **Step 2: 漏斗端到端走查（对照规格第十一节验收清单逐条）**

- [ ] `/invest-check` 移动端布局正常；8 题逐题、无任何分数显示。
- [ ] 结果页：环形总分、四维度、最弱高亮、缺口文案、3 件事，均随答案动态正确。
- [ ] 投影：拖动金额 + 切换 10/20/30 年，两柱与差额实时更新；含免责小字。
- [ ] 提交预约 → `clients` 新增行：`lead_source=website_quiz`、`pipeline_stage=new_lead`、`status=prospect`、`metadata` 完整；分数由服务端重算。
- [ ] 该线索出现在 portal Pipeline「新线索」，来源显示「网站测评」。
- [ ] 确认页 WhatsApp 按钮打开带预填消息的对话，变量正确。
- [ ] honeypot 非空时不落库；缺 name/whatsapp 返回 400。
- [ ] cn/en 全程文案完整。

- [ ] **Step 3: 部署预览验证**

推送 HP 分支触发 Vercel Preview；在预览域名上重复一次端到端提交，确认线上 serverless + Supabase 写入正常。

- [ ] **Step 4: 收尾**

确认所有 commit 已推送；在 PR 描述里链接本计划与规格。

---

## 自检（Spec coverage）

- 规格②范围（先漏斗后整站）→ 计划仅做漏斗，整站重设计未纳入 ✅
- ③架构（HP 放漏斗 + api/lead + 共享 Supabase；portal 最小改动）→ Task 1/2（portal）、Task 16/17（serverless）、Task 3-19（HP）✅
- 4.2 测评 8 题 → Task 10 content + Task 13 Quiz；分值 → Task 7 ✅
- 4.3 评分（维度/总分/分数段/最弱/服务端重算）→ Task 7（前端）+ Task 16/17（服务端重算）✅
- 4.4 结果页 + 投影（3%/8%/交互/免责）→ Task 14/15 ✅
- 4.5 预约表单字段 → Task 18 ✅
- 4.6 确认 + WhatsApp 模板 → Task 9 + Task 19 ✅
- 五 数据落库（clients 字段 + metadata + 枚举迁移）→ Task 1 + Task 17 ✅
- 六 HP 改动清单 → Task 3-21 ✅
- 七 Portal 改动（stages + 线索详情）→ Task 2 + Task 22 ✅
- 八 API 契约 → Task 17 ✅
- 九 合规免责 → content disclaimer（Task 10）+ 结果页渲染（Task 15）✅
- 十 双语 → Task 10 + Task 21 ✅
- 十一 验收 → Task 23 ✅
- 十二 开放问题（LEON_ADVISOR_ID / ADVISOR_WA_NUMBER / 同一 Supabase）→ Task 20 环境配置 ✅
