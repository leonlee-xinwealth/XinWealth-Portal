# Investment Tab Redesign — Implementation Plan

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 Investment Tab 改为多 Portfolio 支持的故事化布局，新增 CAGR/XIRR 指标，FD 对比前端计算，并清除所有 Lark 字段映射遗留代码。

**架构：** 新建 `portfolios` + `portfolio_history` 两张 Supabase 表（metadata + 月度快照）。新增 `api/portfolios.js` 服务端路由替代 `api/data.js` 中的 Lark 格式响应。前端 `Investment.tsx` 全量重写为三段式布局：Overview Banner → Portfolio 选择卡片 → Story B 详情。FD 对比值全部前端动态计算，不存库。

**技术栈：** React 18, TypeScript, Recharts, Supabase (postgres + supabase-js), Vercel Serverless Functions, Tailwind CSS

**规格文档：** `docs/superpowers/specs/2026-06-09-investment-tab-redesign.md`

---

## 文件清单

| 操作 | 文件 | 职责 |
|---|---|---|
| 新建 | `supabase/migrations/20260609_portfolios.sql` | 创建 portfolios + portfolio_history 表及 RLS |
| 新建 | `api/portfolios.js` | 返回已认证用户所有 portfolio + history 的 JSON |
| 修改 | `types.ts` | 新增 Portfolio, PortfolioSnapshot, PortfolioMetrics, PortfolioMonthlyPoint 接口；保留旧接口不删（渐进迁移） |
| 修改 | `services/apiService.ts` | 新增 fetchPortfolios(), computePortfolioMetrics()；移除 fetchClientProfile / fetchPortfolioHistory Lark 字段解析 |
| 全量重写 | `components/Investment.tsx` | 三段式布局：Overview Banner, Portfolio 卡片组, Story 详情（CAGR/XIRR/TWR/FD Timeline/Chart） |

---

## 任务 1：数据库迁移 — portfolios + portfolio_history

**文件：**
- 新建：`supabase/migrations/20260609_portfolios.sql`

- [ ] **步骤 1：写迁移 SQL**

```sql
-- supabase/migrations/20260609_portfolios.sql

-- 1. portfolios 元数据表
CREATE TABLE IF NOT EXISTS portfolios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'SGD',
  capital_injection NUMERIC(15,2) NOT NULL DEFAULT 0,
  injection_date   DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. portfolio_history 月度快照表
CREATE TABLE IF NOT EXISTS portfolio_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id  UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  end_value     NUMERIC(15,2) NOT NULL,
  cashflow      NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, snapshot_date)
);

-- 3. RLS
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_history ENABLE ROW LEVEL SECURITY;

-- Advisors: see portfolios belonging to their clients
CREATE POLICY "advisors_read_portfolios" ON portfolios
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN advisors a ON a.id = c.advisor_id
      WHERE a.auth_user_id = auth.uid()
    )
  );

-- Clients: see only their own portfolios
CREATE POLICY "clients_read_own_portfolios" ON portfolios
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "advisors_read_portfolio_history" ON portfolio_history
  FOR SELECT USING (
    portfolio_id IN (SELECT id FROM portfolios)
  );

CREATE POLICY "clients_read_own_portfolio_history" ON portfolio_history
  FOR SELECT USING (
    portfolio_id IN (SELECT id FROM portfolios)
  );
```

- [ ] **步骤 2：检查 clients 表有 auth_user_id 字段**

```sql
-- 在 Supabase SQL Editor 执行，确认字段存在
SELECT column_name FROM information_schema.columns
WHERE table_name = 'clients' AND column_name IN ('auth_user_id', 'advisor_id');
```

如果 `clients` 没有 `auth_user_id`，RLS client policy 改为用 email 匹配：
```sql
-- 替换 clients_read_own_portfolios policy
CREATE POLICY "clients_read_own_portfolios" ON portfolios
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
```

- [ ] **步骤 3：应用迁移**

在 Supabase MCP 工具 `apply_migration` 执行上述 SQL，或使用 Supabase Dashboard SQL Editor 执行。

- [ ] **步骤 4：插入测试数据（Chua Khai Chun 案例）**

先查出该客户的 client_id：
```sql
SELECT id FROM clients WHERE email ILIKE '%chua%' OR name ILIKE '%chua khai chun%' LIMIT 1;
```

然后插入（替换 `<CLIENT_ID>` 为实际 UUID）：
```sql
-- 插入 portfolio
INSERT INTO portfolios (id, client_id, name, currency, capital_injection, injection_date)
VALUES (
  gen_random_uuid(),
  '<CLIENT_ID>',
  'PGWA Quant Global',
  'SGD',
  15837.00,
  '2025-12-01'
) RETURNING id;

-- 用上一步返回的 portfolio id 插入 history（替换 <PORTFOLIO_ID>）
INSERT INTO portfolio_history (portfolio_id, snapshot_date, end_value, cashflow) VALUES
  ('<PORTFOLIO_ID>', '2025-12-31', 15837.00, 15837.00),
  ('<PORTFOLIO_ID>', '2026-01-31', 15610.88, 0),
  ('<PORTFOLIO_ID>', '2026-02-28', 16243.19, 0),
  ('<PORTFOLIO_ID>', '2026-03-31', 14990.66, 0),
  ('<PORTFOLIO_ID>', '2026-04-30', 15717.03, 0),
  ('<PORTFOLIO_ID>', '2026-05-31', 16435.08, 0);
```

- [ ] **步骤 5：验证数据已正确插入**

```sql
SELECT p.name, p.currency, p.capital_injection, p.injection_date,
       count(h.id) AS months
FROM portfolios p
LEFT JOIN portfolio_history h ON h.portfolio_id = p.id
WHERE p.name = 'PGWA Quant Global'
GROUP BY p.id, p.name, p.currency, p.capital_injection, p.injection_date;
```

预期：1 行，months = 6。

- [ ] **步骤 6：Commit**

```bash
git add supabase/migrations/20260609_portfolios.sql
git commit -m "feat(db): add portfolios and portfolio_history tables with RLS"
```

---

## 任务 2：新建 api/portfolios.js

**文件：**
- 新建：`api/portfolios.js`

- [ ] **步骤 1：创建路由文件**

```javascript
// api/portfolios.js
import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseAdmin) return configError(res);

  const { user, error } = await getAuthUser(req);
  if (error || !user) {
    return res.status(401).json({ error: `Unauthorized: ${error || 'Invalid token'}` });
  }

  const email = (user.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Missing email on auth user' });

  const { data: clientRow, error: clientErr } = await supabaseAdmin
    .from('clients')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (clientErr) return res.status(500).json({ error: 'Error fetching client', details: clientErr.message });
  if (!clientRow?.id) return res.status(200).json({ portfolios: [] });

  const { data: portfolios, error: portErr } = await supabaseAdmin
    .from('portfolios')
    .select(`
      id,
      name,
      currency,
      capital_injection,
      injection_date,
      portfolio_history (
        snapshot_date,
        end_value,
        cashflow
      )
    `)
    .eq('client_id', clientRow.id)
    .order('injection_date', { ascending: true });

  if (portErr) {
    return res.status(500).json({ error: 'Failed to fetch portfolios', details: portErr.message });
  }

  // Sort history by snapshot_date ascending within each portfolio
  const result = (portfolios || []).map(p => ({
    ...p,
    portfolio_history: (p.portfolio_history || []).sort(
      (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    )
  }));

  return res.status(200).json({ portfolios: result });
}
```

- [ ] **步骤 2：手动测试路由**

启动 dev server（`npm run dev`），用浏览器或 curl 调用（需要先登录取得 token）：
```bash
curl http://localhost:3000/api/portfolios \
  -H "Authorization: Bearer <token>"
```

预期响应形如：
```json
{
  "portfolios": [{
    "id": "...",
    "name": "PGWA Quant Global",
    "currency": "SGD",
    "capital_injection": 15837,
    "injection_date": "2025-12-01",
    "portfolio_history": [
      { "snapshot_date": "2025-12-31", "end_value": 15837, "cashflow": 15837 },
      ...
    ]
  }]
}
```

- [ ] **步骤 3：Commit**

```bash
git add api/portfolios.js
git commit -m "feat(api): add /api/portfolios endpoint with history"
```

---

## 任务 3：更新 types.ts

**文件：**
- 修改：`types.ts`

- [ ] **步骤 1：在 types.ts 末尾追加新接口**

在 `types.ts` 现有代码末尾追加以下内容（不删除旧接口，防止其他模块还在使用）：

```typescript
// ── Investment Tab (New Multi-Portfolio Architecture) ──

export interface Portfolio {
  id: string;
  name: string;
  currency: string;          // "SGD" | "MYR"
  capital_injection: number;
  injection_date: string;    // ISO date e.g. "2025-12-01"
  portfolio_history: PortfolioSnapshot[];
}

export interface PortfolioSnapshot {
  snapshot_date: string;     // ISO date e.g. "2025-12-31"
  end_value: number;
  cashflow: number;
}

export interface PortfolioMetrics {
  currentValue: number;
  totalReturnPct: number;    // simple return % since inception
  cagr: number;              // annualised compound return %
  xirr: number;              // money-weighted annualised %
  twr: number;               // time-weighted cumulative %
  fdCurrentValue: number;    // FD equivalent at latest month
  fdDiffAbsolute: number;    // portfolio − FD in currency units
  fdDiffPct: number;         // (portfolio − FD) / FD × 100
  monthlyData: PortfolioMonthlyPoint[];
}

export interface PortfolioMonthlyPoint {
  label: string;             // "Dec 25", "Jan 26", …
  portfolioValue: number;
  fdValue: number;
  fdDiff: number;            // portfolioValue − fdValue
}
```

- [ ] **步骤 2：Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

预期：0 errors（新接口只是新增，不破坏现有代码）。

- [ ] **步骤 3：Commit**

```bash
git add types.ts
git commit -m "feat(types): add Portfolio, PortfolioMetrics interfaces for multi-portfolio"
```

---

## 任务 4：更新 services/apiService.ts

**文件：**
- 修改：`services/apiService.ts`

### 步骤 4a：新增 fetchPortfolios

- [ ] **步骤 1：在 apiService.ts 顶部 import 中加入新类型**

```typescript
// 在现有 import 行修改，加入新类型
import {
  PortfolioDataPoint, Transaction, ClientProfile,
  KYCData, FinancialHealthData, UserSession, FinancialAnalytics, AnalyticsItem,
  Portfolio, PortfolioSnapshot, PortfolioMetrics, PortfolioMonthlyPoint  // 新增
} from '../types';
```

- [ ] **步骤 2：新增 fetchPortfolios 函数**

在 `fetchTransactions` 函数之后添加：

```typescript
export const fetchPortfolios = async (): Promise<Portfolio[]> => {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Authentication error. Please login again.');

  const res = await fetch('/api/portfolios', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error('Server connection failed (Invalid Response)');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch portfolios');
  return (data.portfolios || []) as Portfolio[];
};
```

### 步骤 4b：新增 computePortfolioMetrics（纯函数，不调用 API）

- [ ] **步骤 3：在 fetchPortfolios 之后添加 helper 函数和 computePortfolioMetrics**

```typescript
// ── Private helpers ──

const FD_ANNUAL_RATE = 0.03;

const _calcCAGR = (endValue: number, capital: number, monthsElapsed: number): number => {
  if (monthsElapsed <= 0 || capital <= 0) return 0;
  return (Math.pow(endValue / capital, 12 / monthsElapsed) - 1) * 100;
};

const _calcTWRFromSnapshots = (history: PortfolioSnapshot[]): number => {
  let cumulative = 1;
  let prevEndValue = 0;
  for (const snap of history) {
    const capitalBase = prevEndValue + snap.cashflow;
    if (capitalBase === 0) { prevEndValue = snap.end_value; continue; }
    cumulative *= (1 + (snap.end_value - capitalBase) / capitalBase);
    prevEndValue = snap.end_value;
  }
  return (cumulative - 1) * 100;
};

const _emptyMetrics = (): PortfolioMetrics => ({
  currentValue: 0, totalReturnPct: 0, cagr: 0, xirr: 0, twr: 0,
  fdCurrentValue: 0, fdDiffAbsolute: 0, fdDiffPct: 0, monthlyData: []
});

// ── Public: compute all metrics for one portfolio ──

export const computePortfolioMetrics = (portfolio: Portfolio): PortfolioMetrics => {
  const history = portfolio.portfolio_history;
  if (!history.length) return _emptyMetrics();

  const capital = portfolio.capital_injection;
  const injectionDate = new Date(portfolio.injection_date);
  const latest = history[history.length - 1];
  const currentValue = latest.end_value;
  const latestDate = new Date(latest.snapshot_date);

  // Total cashflow (sum of all cashflow entries = capital + top-ups)
  const totalCashflow = history.reduce((s, h) => s + h.cashflow, 0) || capital;
  const totalReturnPct = totalCashflow > 0 ? ((currentValue / totalCashflow) - 1) * 100 : 0;

  // CAGR
  const monthsElapsed =
    (latestDate.getFullYear() - injectionDate.getFullYear()) * 12
    + (latestDate.getMonth() - injectionDate.getMonth());
  const cagr = _calcCAGR(currentValue, capital, monthsElapsed);

  // TWR
  const twr = _calcTWRFromSnapshots(history);

  // XIRR — reuse existing calculateXIRR (already defined in this file)
  const xirrStreams = history
    .filter(h => h.cashflow !== 0)
    .map(h => ({ amount: -h.cashflow, date: new Date(h.snapshot_date) }));
  xirrStreams.push({ amount: currentValue, date: latestDate });
  const xirr = calculateXIRR(
    xirrStreams.map(x => x.amount),
    xirrStreams.map(x => x.date)
  );

  // FD series — monthly compounding from injection_date
  const monthlyRate = FD_ANNUAL_RATE / 12;
  const monthlyData: PortfolioMonthlyPoint[] = history.map(h => {
    const snapDate = new Date(h.snapshot_date);
    const months =
      (snapDate.getFullYear() - injectionDate.getFullYear()) * 12
      + (snapDate.getMonth() - injectionDate.getMonth());
    const fdValue = parseFloat((capital * Math.pow(1 + monthlyRate, months)).toFixed(2));
    return {
      label: snapDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      portfolioValue: h.end_value,
      fdValue,
      fdDiff: parseFloat((h.end_value - fdValue).toFixed(2))
    };
  });

  const fdCurrentValue = monthlyData[monthlyData.length - 1].fdValue;
  const fdDiffAbsolute = parseFloat((currentValue - fdCurrentValue).toFixed(2));
  const fdDiffPct = fdCurrentValue > 0
    ? parseFloat(((fdDiffAbsolute / fdCurrentValue) * 100).toFixed(2))
    : 0;

  return {
    currentValue,
    totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
    cagr: parseFloat(cagr.toFixed(2)),
    xirr: parseFloat(xirr.toFixed(2)),
    twr: parseFloat(twr.toFixed(2)),
    fdCurrentValue,
    fdDiffAbsolute,
    fdDiffPct,
    monthlyData
  };
};
```

### 步骤 4c：移除旧的 Lark 字段解析函数

- [ ] **步骤 4：删除以下三个函数**（仅在 Investment.tsx 中调用，将被替换）

删除：`fetchClientProfile`（第 180–267 行）
删除：`fetchPortfolioHistory`（第 269–291 行）
删除：`deduplicateByMonth`（第 33–50 行）

保留：`calculateXIRR`、`calculateTWR`（其他页面可能仍用）、`fetchData`（health/其他端点仍在用）。

- [ ] **步骤 5：TypeScript 编译确认无报错**

```bash
npx tsc --noEmit
```

如果 `Investment.tsx` 还引用旧函数会报错——任务 5 会修复这些引用。暂时注释掉 Investment.tsx 的导入行可通过编译。

- [ ] **步骤 6：Commit**

```bash
git add services/apiService.ts
git commit -m "feat(api): add fetchPortfolios, computePortfolioMetrics; remove Lark field parsing"
```

---

## 任务 5：全量重写 components/Investment.tsx

**文件：**
- 全量重写：`components/Investment.tsx`

- [ ] **步骤 1：写新的 Investment.tsx**

完整替换文件内容：

```tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { fetchPortfolios, computePortfolioMetrics } from '../services/apiService';
import { Portfolio, PortfolioMetrics } from '../types';

// ── Formatting helpers ──

const fmt = (n: number, decimals = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}%`;

const fmtCurrency = (currency: string, n: number, showSign = false) => {
  const sign = showSign && n > 0 ? '+' : '';
  return `${sign}${currency} ${fmt(Math.abs(n))}`;
};

// ── Sub-components ──

const LoadingState = () => (
  <div className="w-full flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-4 animate-pulse">
      <div className="w-16 h-16 rounded-full bg-slate-200" />
      <div className="w-48 h-4 rounded-lg bg-slate-200" />
    </div>
  </div>
);

const EmptyState = () => (
  <div className="w-full flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
      <DollarSign className="text-slate-300" size={32} />
    </div>
    <h3 className="text-xl font-bold text-slate-800 mb-2">No portfolios yet</h3>
    <p className="text-slate-400 text-sm max-w-xs">Your investment portfolios will appear here once your advisor sets them up.</p>
  </div>
);

// ── Main Component ──

const Investment: React.FC = () => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolios()
      .then(data => {
        setPortfolios(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(err => console.error('Failed to load portfolios', err))
      .finally(() => setLoading(false));
  }, []);

  // Compute metrics for all portfolios (memoised)
  const metricsMap = useMemo(() => {
    const map = new Map<string, PortfolioMetrics>();
    portfolios.forEach(p => map.set(p.id, computePortfolioMetrics(p)));
    return map;
  }, [portfolios]);

  const selected = portfolios.find(p => p.id === selectedId) ?? null;
  const selectedMetrics = selectedId ? metricsMap.get(selectedId) ?? null : null;

  // Aggregate overview values
  const overviewTotalValue = useMemo(
    () => portfolios.reduce((sum, p) => {
      const m = metricsMap.get(p.id);
      return sum + (m?.currentValue ?? 0);
    }, 0),
    [portfolios, metricsMap]
  );
  const overviewFdDiff = useMemo(
    () => portfolios.reduce((sum, p) => {
      const m = metricsMap.get(p.id);
      return sum + (m?.fdDiffAbsolute ?? 0);
    }, 0),
    [portfolios, metricsMap]
  );
  const overviewTotalCapital = useMemo(
    () => portfolios.reduce((sum, p) => sum + p.capital_injection, 0),
    [portfolios]
  );
  const overviewReturnPct = overviewTotalCapital > 0
    ? ((overviewTotalValue / overviewTotalCapital) - 1) * 100
    : 0;
  // Use first portfolio's currency for overview (all should match in practice)
  const overviewCurrency = portfolios[0]?.currency ?? 'SGD';

  if (loading) return <LoadingState />;
  if (!portfolios.length) return <EmptyState />;

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">

      {/* ── SECTION 1: Overview Banner ── */}
      <div className="bg-xin-blue rounded-[2.5rem] p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <svg viewBox="0 0 400 200" className="w-full h-full">
            <circle cx="350" cy="50" r="120" fill="white" />
          </svg>
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-xin-gold mb-1">Total Investment Value</p>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight font-serif">
            <span className="text-xin-gold text-2xl font-bold mr-1">{overviewCurrency}</span>
            {fmt(overviewTotalValue)}
          </h2>
          <div className="flex flex-wrap gap-6 mt-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Overall Return</p>
              <p className={`text-lg font-bold ${overviewReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtPct(overviewReturnPct)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">vs FD (3% p.a.)</p>
              <p className={`text-lg font-bold ${overviewFdDiff >= 0 ? 'text-xin-gold' : 'text-red-400'}`}>
                {fmtCurrency(overviewCurrency, overviewFdDiff, true)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Active Portfolios</p>
              <p className="text-lg font-bold">{portfolios.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Portfolio Selector ── */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-3 px-1">My Portfolios</p>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {portfolios.map(p => {
            const m = metricsMap.get(p.id);
            const isActive = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex-shrink-0 w-40 rounded-[1.5rem] p-4 text-left transition-all duration-300 ${
                  isActive
                    ? 'bg-xin-blue text-white shadow-xl'
                    : 'bg-white border border-slate-100 hover:border-xin-gold/50 hover:shadow-md text-xin-blue'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mb-3 ${isActive ? 'bg-xin-gold' : 'bg-slate-200'}`} />
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isActive ? 'text-white/50' : 'text-slate-400'}`}>
                  {p.currency}
                </p>
                <p className={`text-xs font-bold leading-tight mb-2 ${isActive ? 'text-white' : 'text-xin-blue'}`}>
                  {p.name}
                </p>
                <p className={`text-base font-black ${isActive ? 'text-xin-gold' : 'text-xin-blue'}`}>
                  {fmt(m?.currentValue ?? 0, 0)}
                </p>
                <p className={`text-xs font-bold mt-1 ${
                  (m?.totalReturnPct ?? 0) >= 0
                    ? isActive ? 'text-green-400' : 'text-green-600'
                    : 'text-red-500'
                }`}>
                  {fmtPct(m?.totalReturnPct ?? 0)} · CAGR {fmt(m?.cagr ?? 0)}%
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 3: Portfolio Detail ── */}
      {selected && selectedMetrics && (
        <PortfolioDetail portfolio={selected} metrics={selectedMetrics} />
      )}
    </div>
  );
};

// ── Portfolio Detail Component ──

interface PortfolioDetailProps {
  portfolio: Portfolio;
  metrics: PortfolioMetrics;
}

const PortfolioDetail: React.FC<PortfolioDetailProps> = ({ portfolio, metrics }) => {
  const { currency, name, capital_injection, injection_date } = portfolio;
  const { currentValue, totalReturnPct, cagr, xirr, twr, fdDiffAbsolute, fdDiffPct, fdCurrentValue, monthlyData } = metrics;

  const isOutperforming = fdDiffAbsolute >= 0;
  const injectionDateLabel = new Date(injection_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const lastUpdatedLabel = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].label : '-';

  return (
    <div className="space-y-5">

      {/* Info chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Portfolio', value: name },
          { label: 'Started', value: injectionDateLabel },
          { label: 'Capital In', value: `${currency} ${fmt(capital_injection)}` },
          { label: 'Last Updated', value: lastUpdatedLabel },
        ].map(chip => (
          <div key={chip.label} className="bg-white border border-slate-100 rounded-2xl px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{chip.label}</p>
            <p className="text-sm font-bold text-xin-blue mt-0.5">{chip.value}</p>
          </div>
        ))}
      </div>

      {/* Hero Story Card */}
      <div className={`rounded-[2rem] p-7 text-white relative overflow-hidden ${
        isOutperforming
          ? 'bg-gradient-to-br from-xin-blue to-[#163d5e]'
          : 'bg-gradient-to-br from-slate-700 to-slate-800'
      }`}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -mr-8 -mt-8" />
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40 mb-2">
          vs Fixed Deposit @ 3% p.a.
        </p>
        <p className="text-sm text-white/60 mb-2">
          {isOutperforming ? 'Your portfolio is outperforming FD by' : 'Your portfolio is underperforming FD by'}
        </p>
        <p className={`text-4xl font-black tracking-tight ${isOutperforming ? 'text-xin-gold' : 'text-red-400'}`}>
          <span className="text-xl font-bold mr-1">{currency}</span>
          {isOutperforming ? '+' : ''}{fmt(fdDiffAbsolute)}
        </p>
        <p className="text-xs text-white/30 mt-2">
          FD equivalent: {currency} {fmt(fdCurrentValue)} · Portfolio: {currency} {fmt(currentValue)}
        </p>
        <div className={`inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full text-xs font-bold ${
          isOutperforming
            ? 'bg-green-400/15 text-green-400 border border-green-400/25'
            : 'bg-red-400/15 text-red-400 border border-red-400/25'
        }`}>
          {isOutperforming
            ? <><TrendingUp size={12} /> Outperforming as of {lastUpdatedLabel}</>
            : <><TrendingDown size={12} /> Underperforming as of {lastUpdatedLabel}</>}
        </div>
      </div>

      {/* Monthly Timeline */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-3">Monthly Snapshot vs FD</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {monthlyData.map((m, i) => {
            const isLatest = i === monthlyData.length - 1;
            const isFirst = i === 0;
            return (
              <div
                key={m.label}
                className={`flex-shrink-0 min-w-[64px] rounded-2xl p-3 text-center border ${
                  isLatest
                    ? 'bg-white border-xin-gold shadow-md'
                    : 'bg-white border-slate-100'
                }`}
              >
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">{m.label}</p>
                <p className="text-xs font-black text-xin-blue mt-1">
                  {(m.portfolioValue / 1000).toFixed(1)}k
                </p>
                {isFirst ? (
                  <span className="text-[9px] bg-slate-100 text-slate-400 rounded px-1 py-0.5 font-bold mt-1 inline-block">Start</span>
                ) : (
                  <span className={`text-[9px] rounded px-1 py-0.5 font-bold mt-1 inline-block ${
                    m.fdDiff >= 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {m.fdDiff >= 0 ? '+' : ''}{fmt(m.fdDiff, 0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'CAGR', value: `${fmt(cagr)}%`, sub: 'Annualised compound return', dark: true },
          { label: 'XIRR', value: `${fmt(xirr)}%`, sub: 'Money-weighted annualised', dark: true },
          { label: 'TWR', value: `${fmt(twr)}%`, sub: 'Time-weighted return', dark: false },
          { label: 'Total Return', value: fmtPct(totalReturnPct), sub: `${currency} ${fmt(currentValue - capital_injection, 0)} since inception`, dark: false },
        ].map(metric => (
          <div
            key={metric.label}
            className={`rounded-[1.5rem] p-5 ${
              metric.dark
                ? 'bg-xin-blue text-white'
                : 'bg-white border border-slate-100'
            }`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${metric.dark ? 'text-white/40' : 'text-slate-400'}`}>
              {metric.label}
            </p>
            <p className={`text-2xl font-black tracking-tight ${metric.dark ? 'text-xin-gold' : 'text-xin-blue'}`}>
              {metric.value}
            </p>
            <p className={`text-[10px] mt-1.5 ${metric.dark ? 'text-white/25' : 'text-slate-400'}`}>
              {metric.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-xin-blue font-serif">Portfolio vs Fixed Deposit</h3>
            <p className="text-xs text-slate-400">Monthly market value compared to FD @ 3% p.a.</p>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-xin-gold" />
              <span className="text-[10px] font-bold text-xin-blue uppercase tracking-wider">Portfolio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-300" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FD</span>
            </div>
          </div>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d8c195" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#d8c195" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
              <YAxis
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v: number) => `${currency} ${(v / 1000).toFixed(1)}k`}
                width={80}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', borderRadius: 14, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                itemStyle={{ color: '#0c2e4a', fontWeight: 'bold' }}
                formatter={(value: number, name: string) => [
                  `${currency} ${fmt(value)}`,
                  name === 'portfolioValue' ? 'Portfolio' : 'Fixed Deposit'
                ]}
              />
              <Line type="monotone" dataKey="fdValue" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} name="fdValue" />
              <Area type="monotone" dataKey="portfolioValue" stroke="#d8c195" strokeWidth={2.5} fillOpacity={1} fill="url(#portfolioGrad)" name="portfolioValue" dot={{ fill: '#d8c195', r: 4, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default Investment;
```

- [ ] **步骤 2：TypeScript 编译确认**

```bash
npx tsc --noEmit
```

预期：0 errors。

- [ ] **步骤 3：启动 dev server，导航到 Investment Tab，验证以下内容**

```bash
npm run dev
```

检查清单：
- [ ] Overview banner 显示总价值（所有 portfolio 合计）、整体 return、vs FD 差异
- [ ] Portfolio 选择卡片横向滚动，点击切换
- [ ] 选中 PGWA Quant Global → 英雄卡显示 `+SGD 399.07`
- [ ] 月度时间轴 Dec–May 都有，正确的 fdDiff 颜色（Jan/Mar/Apr 红，Feb/May 绿）
- [ ] CAGR ≈ 9.14%，XIRR ≈ 8.9%，Total Return ≈ +3.78%
- [ ] 图表两条线正确绘制，Y 轴单位显示 SGD

- [ ] **步骤 4：Commit**

```bash
git add components/Investment.tsx
git commit -m "feat(ui): redesign Investment tab with multi-portfolio support, CAGR/XIRR, story layout"
```

---

## 任务 6：最终验证与收尾

- [ ] **步骤 1：确认 Lark 字段名已清除**

```bash
# 搜索剩余 Lark 字段名（应无命中，或只在 health/networth 相关代码中）
grep -r '"End Value"\|"Cashflow"\|"FD"\|"Date"' services/apiService.ts api/data.js
```

`services/apiService.ts` 中不应有命中（`calculateTWR` 内的已被新函数替代）。
`api/data.js` 仍有命中——这个文件还被 health/networth 用，暂不改动，记录为 tech debt。

- [ ] **步骤 2：回归测试其他 Tab 未受影响**

在浏览器中点开 Financial Health、Net Worth、Insurance 等 Tab，确认正常加载。

- [ ] **步骤 3：最终 commit**

```bash
git add -A
git commit -m "chore: investment tab redesign complete - multi-portfolio, CAGR/XIRR, Supabase-native"
```

---

## 已知 Tech Debt（不在本次范围内）

- `api/data.js` 仍在用 Lark 字段格式映射（被 health/networth 端点依赖），应在下一个 sprint 清理
- `calculateTWR` 和 `calculateXIRR` 仍在 `apiService.ts` 内（可提取到 `utils/finance.ts` 改善可测性）
- `ClientProfile` 和旧 `PortfolioDataPoint` 接口暂留在 `types.ts`，待其他引用清除后删除
