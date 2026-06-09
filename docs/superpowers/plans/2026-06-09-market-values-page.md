# Market Values Page — Implementation Plan

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 Advisor Portal 新增「Market Values」页面，让 advisor 能为客户录入/编辑/删除月度市值，并管理投资组合元数据。

**架构：** 新建一个独立页面组件 `MarketValues.tsx`，内含三列布局（侧边导航已有 | 客户列表 | 组合面板）及四个内联 Modal/Dialog 子组件；页面直接调用 Supabase client（与其他 advisor 页面一致）；不需要任何后端 API 变更。

**技术栈：** React 18 + TypeScript, Supabase-js v2, Tailwind CSS (CDN inline config), Lucide React icons

---

## 文件结构

| 操作 | 文件 | 职责 |
|---|---|---|
| 新建 | `components/advisor/pages/MarketValues.tsx` | 完整的 Market Values 页面，含 RecordModal / NewPortfolioModal / EditPortfolioModal / DeletePortfolioDialog 四个内联子组件 |
| 修改 | `components/advisor/AdvisorLayout.tsx` | 在 `navItems` 数组中增加「Market Values」导航项 |
| 修改 | `components/advisor/AdvisorApp.tsx` | 导入 MarketValues 并注册路由 `/advisor/market-values` |

**无需修改 DB / API / 类型文件** — `portfolios` 和 `portfolio_history` 表已存在，RLS 已配置，`ON DELETE CASCADE` 已设置。

---

## 项目背景（给 subagent 的必读上下文）

### 认证 & 数据访问模式
每个 advisor 页面的固定开头：
```ts
const { data: { user } } = await supabase.auth.getUser();
const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
// 然后用 adv.id 过滤 clients
```

### 自定义 Tailwind 颜色（在 index.html 内联配置）
- `xin-blue`: `#0A2540` — 主深蓝
- `xin-blueLight`: `#173A5E` — hover 用浅蓝
- `xin-gold`: `#C8A97E` — 金色强调
- `xin-goldDark`: `#A68255`
- `xin-bg`: `#F4F7F9`

### Supabase import 路径
```ts
import { supabase } from '../../../lib/supabaseClient';
```

### 语言切换
```ts
const { language } = useLanguage(); // from '../../../context/LanguageContext'
const t = (en: string, zh: string) => language === 'zh' ? zh : en;
```

### 没有自动化测试框架
项目无 Jest/Vitest。验证方式：`npm run build`（TypeScript 类型检查）+ 手动浏览器验证。

---

## 任务 1：导航 + 路由接线

**文件：**
- 修改：`components/advisor/AdvisorLayout.tsx`
- 修改：`components/advisor/AdvisorApp.tsx`

- [ ] **步骤 1：修改 AdvisorLayout.tsx — 添加 BarChart2 图标并注册导航项**

在文件顶部 lucide-react import 中加入 `BarChart2`：

```tsx
// 原来：
import { LayoutDashboard, Users, Settings, LogOut, Menu, X, ShieldCheck, Target, Briefcase, Megaphone } from 'lucide-react';
// 改为：
import { LayoutDashboard, Users, Settings, LogOut, Menu, X, ShieldCheck, Target, Briefcase, Megaphone, BarChart2 } from 'lucide-react';
```

在 `navItems` 数组的 `broadcast` 项之后、`clients` 项之前，插入新项：

```tsx
{ to: '/advisor/broadcast', icon: <Megaphone size={18} />, label: language === 'zh' ? '群发' : 'Broadcast', badge: 0 },
{ to: '/advisor/market-values', icon: <BarChart2 size={18} />, label: language === 'zh' ? '市值管理' : 'Market Values', badge: 0 },
{ to: '/advisor/clients',   icon: <Users size={18} />,    label: language === 'zh' ? '客户' : 'Clients',    badge: 0 },
```

- [ ] **步骤 2：修改 AdvisorApp.tsx — 导入组件并注册路由**

在文件顶部 import 区（与其他页面 import 并列）添加：
```tsx
import MarketValues from './pages/MarketValues';
```

在 `<Route element={<AdvisorLayout />}>` 内的路由列表中，在 `broadcast` 路由之后添加：
```tsx
<Route path="broadcast" element={<Broadcast />} />
<Route path="market-values" element={<MarketValues />} />
```

- [ ] **步骤 3：创建占位文件以验证路由可编译**

创建 `components/advisor/pages/MarketValues.tsx` 最小骨架（完整实现在任务 2 补充）：

```tsx
export default function MarketValues() {
  return <div className="p-8 text-xin-blue font-semibold">Market Values — coming soon</div>;
}
```

- [ ] **步骤 4：运行 build 验证无 TypeScript 错误**

```bash
cd "D:\XinWealth Portal App\XinWealth-Portal"
npm run build
```

预期：Build 成功，无 TS 错误。如有错误，先修复再继续。

- [ ] **步骤 5：Commit**

```bash
git add components/advisor/AdvisorLayout.tsx components/advisor/AdvisorApp.tsx components/advisor/pages/MarketValues.tsx
git commit -m "feat: add Market Values route and sidebar nav item"
```

---

## 任务 2：实现 MarketValues.tsx 完整页面

**文件：**
- 修改（替换全部内容）：`components/advisor/pages/MarketValues.tsx`

此任务将占位骨架替换为完整实现。文件包含：
- Types + Helpers（顶层工具函数）
- `MarketValues` 主组件（三列布局、状态管理、数据获取）
- `ModalOverlay` + `Spinner`（共用 UI 工具）
- `RecordModal`（Modal 1 — 录入/修改月度市值）
- `NewPortfolioModal`（Modal 2 — 新建组合）
- `EditPortfolioModal`（Modal 3 — 编辑组合元数据）
- `DeletePortfolioDialog`（删除组合确认弹窗）

- [ ] **步骤 1：将 MarketValues.tsx 替换为完整实现**

完整文件内容如下（约 550 行）：

```tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface Client { id: string; full_name: string; }

interface PortfolioRow {
  id: string;
  name: string;
  currency: string;
  capital_injection: number;
  injection_date: string;    // "YYYY-MM-DD"
  last_date: string | null;
  last_value: number | null;
}

interface HistoryRow {
  id: string;
  snapshot_date: string;     // "YYYY-MM-DD"
  end_value: number;
  cashflow: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
/** Returns "YYYY-MM-DD" for the last day of the given "YYYY-MM" month string */
function lastDayOf(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).toISOString().split('T')[0];
}
/** Returns "YYYY-MM-01" */
function firstDayOf(yearMonth: string): string { return `${yearMonth}-01`; }
/** "2026-05-31" → "2026-05" */
function toYearMonth(dateStr: string): string { return dateStr.slice(0, 7); }
/** "2026-05-31" → "May 2026" */
function fmtMonth(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-MY', { month: 'short', year: 'numeric' });
}
/** 16435.08 → "16,435.08" */
function fmtNumber(n: number): string {
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** Green if last_date >= start of previous calendar month */
function isGreenStatus(lastDate: string | null): boolean {
  if (!lastDate) return false;
  const today = new Date();
  const threshold = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return new Date(lastDate) >= threshold;
}
/** Returns the next "YYYY-MM" month after lastDate, or current month if no lastDate */
function nextMonthAfter(lastDate: string | null): string {
  if (!lastDate) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const d = new Date(lastDate + 'T00:00:00');
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function MarketValues() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);

  // Expand/collapse + history
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryRow[]>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);

  // Modals
  const [recordModal, setRecordModal] = useState<{ portfolio: PortfolioRow; editRow?: HistoryRow } | null>(null);
  const [newPortModal, setNewPortModal] = useState(false);
  const [editPortModal, setEditPortModal] = useState<PortfolioRow | null>(null);
  const [deletePortDialog, setDeletePortDialog] = useState<PortfolioRow | null>(null);

  // ── Load advisor + clients on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
      if (!adv) { setLoadingClients(false); return; }
      const { data: cls } = await supabase
        .from('clients').select('id, full_name').eq('advisor_id', adv.id).order('full_name');
      setClients(cls || []);
      setLoadingClients(false);
    }
    load();
  }, []);

  // ── Load portfolios when client changes
  useEffect(() => {
    if (!selectedClientId) { setPortfolios([]); return; }
    loadPortfoliosForClient(selectedClientId);
  }, [selectedClientId]);

  async function loadPortfoliosForClient(clientId: string) {
    setLoadingPortfolios(true);
    setExpandedId(null);
    setDeletingHistoryId(null);

    const { data: portData } = await supabase
      .from('portfolios')
      .select('id, name, currency, capital_injection, injection_date')
      .eq('client_id', clientId)
      .order('injection_date');

    const portIds = (portData || []).map((p: any) => p.id);
    const latestMap: Record<string, { snapshot_date: string; end_value: number }> = {};

    if (portIds.length > 0) {
      const { data: histData } = await supabase
        .from('portfolio_history')
        .select('portfolio_id, snapshot_date, end_value')
        .in('portfolio_id', portIds)
        .order('snapshot_date', { ascending: false });
      // First occurrence per portfolio_id = latest record
      for (const h of histData || []) {
        if (!latestMap[h.portfolio_id]) latestMap[h.portfolio_id] = h;
      }
    }

    setPortfolios((portData || []).map((p: any) => ({
      ...p,
      last_date: latestMap[p.id]?.snapshot_date ?? null,
      last_value: latestMap[p.id]?.end_value ?? null,
    })));
    setLoadingPortfolios(false);
  }

  async function reloadPortfolios() {
    if (selectedClientId) await loadPortfoliosForClient(selectedClientId);
  }

  async function reloadHistory(portId: string) {
    const { data } = await supabase
      .from('portfolio_history')
      .select('id, snapshot_date, end_value, cashflow')
      .eq('portfolio_id', portId)
      .order('snapshot_date', { ascending: false });
    setHistory(prev => ({ ...prev, [portId]: data || [] }));
  }

  async function handleToggleExpand(portId: string) {
    if (expandedId === portId) { setExpandedId(null); return; }
    setExpandedId(portId);
    setDeletingHistoryId(null);
    if (!history[portId]) {
      setLoadingHistory(true);
      await reloadHistory(portId);
      setLoadingHistory(false);
    }
  }

  async function handleDeleteHistory(portId: string, rowId: string) {
    await supabase.from('portfolio_history').delete().eq('id', rowId);
    setDeletingHistoryId(null);
    await Promise.all([reloadHistory(portId), reloadPortfolios()]);
  }

  async function handleDeletePortfolio(portId: string) {
    await supabase.from('portfolios').delete().eq('id', portId);
    setDeletePortDialog(null);
    setExpandedId(null);
    setHistory(prev => { const n = { ...prev }; delete n[portId]; return n; });
    await reloadPortfolios();
  }

  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('Market Values', '市值管理')}</h1>
        <p className="text-sm text-slate-400 mt-1">
          {t('Record and manage client portfolio market values', '录入并管理客户投资组合市值')}
        </p>
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 13rem)', minHeight: '400px' }}>

        {/* ── Column: Client List ── */}
        <div className="w-60 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-y-auto flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('Clients', '客户')}</p>
          </div>
          {loadingClients ? (
            <div className="flex-1 flex items-center justify-center"><Spinner /></div>
          ) : clients.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">{t('No clients found.', '没有客户。')}</div>
          ) : (
            clients.map(c => (
              <button key={c.id} onClick={() => setSelectedClientId(c.id)}
                className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors border-b border-slate-50 last:border-0 ${
                  selectedClientId === c.id
                    ? 'bg-xin-gold/10 text-xin-blue border-l-2 border-l-xin-gold font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.full_name}
              </button>
            ))
          )}
        </div>

        {/* ── Column: Portfolio Panel ── */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-y-auto flex flex-col min-w-0">
          {!selectedClientId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              {t('← Select a client to view portfolios', '← 选择客户查看投资组合')}
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <h2 className="font-semibold text-xin-blue text-sm">
                  {selectedClient?.full_name} — {t('Portfolios', '投资组合')}
                </h2>
                <button onClick={() => setNewPortModal(true)}
                  className="flex items-center gap-1.5 bg-xin-blue text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-xin-blueLight transition-colors"
                >
                  <Plus size={14} />
                  {t('New Portfolio', '新建组合')}
                </button>
              </div>

              {loadingPortfolios ? (
                <div className="flex-1 flex items-center justify-center"><Spinner /></div>
              ) : portfolios.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                  {t('No portfolios yet. Click "+ New Portfolio" to create one.', '还没有投资组合，点击「新建组合」创建。')}
                </div>
              ) : (
                portfolios.map(p => {
                  const green = isGreenStatus(p.last_date);
                  const hasDate = !!p.last_date;
                  const isExpanded = expandedId === p.id;
                  const portHistory = history[p.id] ?? [];

                  return (
                    <div key={p.id} className="border-b border-slate-100 last:border-0">
                      {/* Portfolio row */}
                      <div
                        className="flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                        onClick={() => handleToggleExpand(p.id)}
                      >
                        {isExpanded
                          ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
                          : <ChevronRight size={16} className="text-slate-400 shrink-0" />
                        }
                        {/* Status dot */}
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          !hasDate ? 'bg-slate-300' : green ? 'bg-emerald-500' : 'bg-amber-400'
                        }`} />
                        {/* Name + currency */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-xin-blue truncate">{p.name}</div>
                          <div className="text-xs text-slate-400">{p.currency}</div>
                        </div>
                        {/* Last value + month */}
                        {hasDate && (
                          <div className="text-right shrink-0 mr-3">
                            <div className="text-sm font-bold text-xin-blue">{fmtNumber(p.last_value ?? 0)}</div>
                            <div className={`text-xs font-medium ${green ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {fmtMonth(p.last_date!)} {green ? '✓' : '⚠'}
                            </div>
                          </div>
                        )}
                        {!hasDate && (
                          <div className="text-xs text-slate-400 mr-3 shrink-0">{t('No records', '暂无记录')}</div>
                        )}
                        {/* Action buttons — only visible when expanded */}
                        {isExpanded && (
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setRecordModal({ portfolio: p })}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-xin-blue text-white hover:bg-xin-blueLight transition-colors whitespace-nowrap"
                            >
                              <Plus size={12} /> {t('Record', '录入')}
                            </button>
                            <button
                              onClick={() => setEditPortModal(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-xin-blue hover:bg-slate-100 transition-colors"
                              title={t('Edit portfolio metadata', '编辑投资组合')}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeletePortDialog(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title={t('Delete portfolio', '删除投资组合')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Expanded: history sub-table */}
                      {isExpanded && (
                        <div className="px-6 pb-5 bg-slate-50/60">
                          {loadingHistory && portHistory.length === 0 ? (
                            <div className="py-6 flex justify-center"><Spinner /></div>
                          ) : portHistory.length === 0 ? (
                            <p className="py-4 text-center text-slate-400 text-xs">
                              {t('No records yet. Click "+ Record" above to add the first one.', '暂无记录，点击上方「录入」添加第一条。')}
                            </p>
                          ) : (
                            <table className="w-full text-xs mt-1">
                              <thead>
                                <tr className="text-slate-400 font-bold uppercase tracking-wider">
                                  <th className="py-2 text-left">{t('Month', '月份')}</th>
                                  <th className="py-2 text-right">{t('Market Value', '市值')} ({p.currency})</th>
                                  <th className="py-2 text-right">{t('Top-up', '追加')}</th>
                                  <th className="py-2 w-16"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {portHistory.map(row => (
                                  <React.Fragment key={row.id}>
                                    <tr className="border-t border-slate-200/60">
                                      <td className="py-2.5 font-semibold text-xin-blue">{fmtMonth(row.snapshot_date)}</td>
                                      <td className="py-2.5 text-right font-bold text-xin-blue">{fmtNumber(row.end_value)}</td>
                                      <td className="py-2.5 text-right text-slate-400">
                                        {row.cashflow > 0 ? `+${fmtNumber(row.cashflow)}` : '—'}
                                      </td>
                                      <td className="py-2.5">
                                        <div className="flex gap-1 justify-end">
                                          <button
                                            onClick={() => {
                                              setDeletingHistoryId(null);
                                              setRecordModal({ portfolio: p, editRow: row });
                                            }}
                                            className="p-1 rounded text-slate-300 hover:text-xin-gold hover:bg-xin-gold/10 transition-colors"
                                            title={t('Edit this month', '修改此条记录')}
                                          >
                                            <Pencil size={13} />
                                          </button>
                                          <button
                                            onClick={() => setDeletingHistoryId(
                                              deletingHistoryId === row.id ? null : row.id
                                            )}
                                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title={t('Delete this month', '删除此条记录')}
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                    {/* Inline delete confirmation */}
                                    {deletingHistoryId === row.id && (
                                      <tr>
                                        <td colSpan={4}>
                                          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 my-1 flex items-center justify-between gap-3">
                                            <span className="text-red-700 font-medium text-xs">
                                              {t(
                                                `Delete ${fmtMonth(row.snapshot_date)} record? Cannot be undone.`,
                                                `删除 ${fmtMonth(row.snapshot_date)} 的记录？此操作无法撤销。`
                                              )}
                                            </span>
                                            <div className="flex gap-2 shrink-0">
                                              <button
                                                onClick={() => setDeletingHistoryId(null)}
                                                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                              >
                                                {t('Cancel', '取消')}
                                              </button>
                                              <button
                                                onClick={() => handleDeleteHistory(p.id, row.id)}
                                                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                                              >
                                                {t('Delete', '删除')}
                                              </button>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modal 1: Record Monthly Value ── */}
      {recordModal && (
        <RecordModal
          portfolio={recordModal.portfolio}
          editRow={recordModal.editRow}
          onClose={() => setRecordModal(null)}
          onSaved={async () => {
            const portId = recordModal.portfolio.id;
            const wasExpanded = expandedId === portId;
            setRecordModal(null);
            await reloadPortfolios();
            if (wasExpanded) await reloadHistory(portId);
          }}
          t={t}
        />
      )}

      {/* ── Modal 2: New Portfolio ── */}
      {newPortModal && selectedClient && (
        <NewPortfolioModal
          client={selectedClient}
          onClose={() => setNewPortModal(false)}
          onSaved={async () => { setNewPortModal(false); await reloadPortfolios(); }}
          t={t}
        />
      )}

      {/* ── Modal 3: Edit Portfolio ── */}
      {editPortModal && (
        <EditPortfolioModal
          portfolio={editPortModal}
          onClose={() => setEditPortModal(null)}
          onSaved={async () => { setEditPortModal(null); await reloadPortfolios(); }}
          t={t}
        />
      )}

      {/* ── Delete Portfolio Dialog ── */}
      {deletePortDialog && (
        <DeletePortfolioDialog
          portfolio={deletePortDialog}
          onClose={() => setDeletePortDialog(null)}
          onDeleted={() => handleDeletePortfolio(deletePortDialog.id)}
          t={t}
        />
      )}
    </div>
  );
}

// ── Shared: Modal Overlay ──────────────────────────────────────────────────
function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ── Shared: Spinner ────────────────────────────────────────────────────────
function Spinner() {
  return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-xin-blue" />;
}

// ── Modal 1: Record Monthly Value ──────────────────────────────────────────
function RecordModal({
  portfolio, editRow, onClose, onSaved, t,
}: {
  portfolio: PortfolioRow;
  editRow?: HistoryRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
  t: (en: string, zh: string) => string;
}) {
  const isEdit = !!editRow;
  const [month, setMonth] = useState(
    isEdit ? toYearMonth(editRow!.snapshot_date) : nextMonthAfter(portfolio.last_date)
  );
  const [endValue, setEndValue] = useState(isEdit ? String(editRow!.end_value) : '');
  const [cashflow, setCashflow] = useState(isEdit ? String(editRow!.cashflow || '') : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!month || !endValue) {
      setError(t('Month and Market Value are required.', '请填写月份和市值。'));
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('portfolio_history').upsert(
      {
        portfolio_id: portfolio.id,
        snapshot_date: lastDayOf(month),
        end_value: parseFloat(endValue),
        cashflow: parseFloat(cashflow || '0'),
      },
      { onConflict: 'portfolio_id,snapshot_date' }
    );
    if (err) { setError(err.message); setSaving(false); return; }
    await onSaved();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-xin-blue px-6 py-4 flex items-center justify-between">
          <h3 className="text-xin-gold font-bold text-base">
            {isEdit
              ? `${t('Edit', '修改市值')} — ${fmtMonth(editRow!.snapshot_date)}`
              : t('Record Monthly Value', '录入市值')}
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Portfolio (read-only) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Portfolio', '投资组合')}
            </label>
            <div className="bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-semibold text-xin-blue">
              {portfolio.name} · {portfolio.currency}
            </div>
          </div>
          {/* Last recorded reference */}
          {portfolio.last_date && (
            <div className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-2.5">
              {t('Last recorded:', '上次录入：')}{' '}
              <span className="font-semibold text-slate-600">{fmtMonth(portfolio.last_date)}</span>
              {' — '}{portfolio.currency} {fmtNumber(portfolio.last_value ?? 0)}
            </div>
          )}
          {/* Month picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Month', '月份')} <span className="text-red-400">*</span>
            </label>
            <input
              type="month" value={month} onChange={e => setMonth(e.target.value)}
              disabled={isEdit}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          {/* Market value */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Market Value', '市值')} ({portfolio.currency}) <span className="text-red-400">*</span>
            </label>
            <input
              type="number" min="0" step="0.01" value={endValue}
              onChange={e => setEndValue(e.target.value)} placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          {/* Top-up */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Top-up (optional)', '追加注资（可选）')}
            </label>
            <input
              type="number" min="0" step="0.01" value={cashflow}
              onChange={e => setCashflow(e.target.value)}
              placeholder={t('Leave blank if no additional injection', '如无追加可留空')}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
            {t('Cancel', '取消')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-xin-blue text-white hover:bg-xin-blueLight transition-colors disabled:opacity-50">
            {saving ? t('Saving…', '保存中…') : t('Save', '保存')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Modal 2: New Portfolio ─────────────────────────────────────────────────
function NewPortfolioModal({
  client, onClose, onSaved, t,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => Promise<void>;
  t: (en: string, zh: string) => string;
}) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('SGD');
  const [capital, setCapital] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim() || !capital || !startMonth) {
      setError(t('Please fill in all required fields.', '请填写所有必填字段。'));
      return;
    }
    setSaving(true);
    setError('');
    // Step 1: Insert portfolio
    const { data: port, error: portErr } = await supabase.from('portfolios').insert({
      client_id: client.id,
      name: name.trim(),
      currency,
      capital_injection: parseFloat(capital),
      injection_date: firstDayOf(startMonth),
    }).select().single();
    if (portErr || !port) {
      setError(portErr?.message ?? 'Failed to create portfolio');
      setSaving(false);
      return;
    }
    // Step 2: Insert first history row (end_value = capital, cashflow = capital)
    const { error: histErr } = await supabase.from('portfolio_history').insert({
      portfolio_id: port.id,
      snapshot_date: lastDayOf(startMonth),
      end_value: parseFloat(capital),
      cashflow: parseFloat(capital),
    });
    if (histErr) { setError(histErr.message); setSaving(false); return; }
    await onSaved();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-xin-blue px-6 py-4 flex items-center justify-between">
          <h3 className="text-xin-gold font-bold text-base">{t('New Portfolio', '新建投资组合')}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Client (read-only) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{t('Client', '客户')}</label>
            <div className="bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-semibold text-xin-blue">{client.full_name}</div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Portfolio Name', '组合名称')} <span className="text-red-400">*</span>
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder={t('e.g. PGWA Quant Global', '例：PGWA 量化全球')}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Currency', '货币')} <span className="text-red-400">*</span>
            </label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold bg-white"
            >
              {['SGD', 'MYR', 'USD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Initial Capital', '起始注资')} <span className="text-red-400">*</span>
            </label>
            <input type="number" min="0" step="0.01" value={capital} onChange={e => setCapital(e.target.value)}
              placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Start Month', '注资月份')} <span className="text-red-400">*</span>
            </label>
            <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
            {t('Cancel', '取消')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-xin-blue text-white hover:bg-xin-blueLight transition-colors disabled:opacity-50">
            {saving ? t('Creating…', '创建中…') : t('Create Portfolio', '创建组合')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Modal 3: Edit Portfolio ────────────────────────────────────────────────
function EditPortfolioModal({
  portfolio, onClose, onSaved, t,
}: {
  portfolio: PortfolioRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
  t: (en: string, zh: string) => string;
}) {
  const [name, setName] = useState(portfolio.name);
  const [currency, setCurrency] = useState(portfolio.currency);
  const [capital, setCapital] = useState(String(portfolio.capital_injection));
  const [startMonth, setStartMonth] = useState(toYearMonth(portfolio.injection_date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim() || !capital || !startMonth) {
      setError(t('Please fill in all required fields.', '请填写所有必填字段。'));
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('portfolios').update({
      name: name.trim(),
      currency,
      capital_injection: parseFloat(capital),
      injection_date: firstDayOf(startMonth),
    }).eq('id', portfolio.id);
    if (err) { setError(err.message); setSaving(false); return; }
    await onSaved();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-xin-blue px-6 py-4 flex items-center justify-between">
          <h3 className="text-xin-gold font-bold text-base">{t('Edit Portfolio', '编辑投资组合')}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Warning banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 font-medium leading-relaxed">
            ⚠️ {t(
              'Changing the capital amount or start date will affect CAGR and FD comparison calculations visible to the client.',
              '修改起始注资或注资日期将影响客户端显示的 CAGR 和定存对比计算结果。'
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Portfolio Name', '组合名称')} <span className="text-red-400">*</span>
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Currency', '货币')} <span className="text-red-400">*</span>
            </label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold bg-white"
            >
              {['SGD', 'MYR', 'USD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Initial Capital', '起始注资')} <span className="text-red-400">*</span>
            </label>
            <input type="number" min="0" step="0.01" value={capital} onChange={e => setCapital(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('Start Month', '注资月份')} <span className="text-red-400">*</span>
            </label>
            <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-xin-gold"
            />
          </div>
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
            {t('Cancel', '取消')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-xin-blue text-white hover:bg-xin-blueLight transition-colors disabled:opacity-50">
            {saving ? t('Saving…', '保存中…') : t('Save Changes', '保存修改')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Delete Portfolio Dialog ────────────────────────────────────────────────
function DeletePortfolioDialog({
  portfolio, onClose, onDeleted, t,
}: {
  portfolio: PortfolioRow;
  onClose: () => void;
  onDeleted: () => void;
  t: (en: string, zh: string) => string;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch history count when dialog opens
  useEffect(() => {
    supabase
      .from('portfolio_history')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', portfolio.id)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [portfolio.id]);

  function handleDelete() {
    setDeleting(true);
    onDeleted(); // parent handles the actual DB delete + cleanup
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Trash2 size={22} className="text-red-500" />
          </div>
          <h3 className="font-bold text-xin-blue text-base mb-3">
            {t(`Delete "${portfolio.name}"?`, `删除「${portfolio.name}」？`)}
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            {t(
              `This will permanently delete the portfolio and all ${count !== null ? count : '…'} recorded month(s) of history. This action cannot be undone and will immediately remove this portfolio from the client's Investment tab.`,
              `这将永久删除该组合及其所有 ${count !== null ? count : '…'} 条历史记录，且将立即从客户的投资页面移除。此操作无法撤销。`
            )}
          </p>
        </div>
        <div className="px-6 pb-6 pt-4 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
            {t('Cancel', '取消')}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
            {deleting ? t('Deleting…', '删除中…') : t('Delete Portfolio', '删除组合')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
```

- [ ] **步骤 2：运行 build 验证 TypeScript 通过**

```bash
cd "D:\XinWealth Portal App\XinWealth-Portal"
npm run build
```

预期：0 errors。常见错误及修复：
- `Property 'X' does not exist on type` → 检查 PortfolioRow / HistoryRow 接口定义
- `Cannot find name 'Y'` → 检查 helper 函数是否在用到它们的组件之前定义（所有 helpers 在文件顶部，所有子组件在 `export default` 之后）

- [ ] **步骤 3：手动浏览器验证清单**

启动开发服务器：`npm run dev`，以 advisor 身份登录，逐项核对：

**导航：**
- [ ] 侧边栏显示「Market Values」导航项，图标正确
- [ ] 点击导航到 `/advisor/market-values`，页面标题显示「Market Values」

**客户列表：**
- [ ] 左列显示 advisor 的所有客户，按姓名排序
- [ ] 点击客户，该行高亮（左侧金色边框），右侧面板更新

**组合列表：**
- [ ] 选择有组合的客户，右侧面板显示组合列表
- [ ] 绿色状态点：最近记录 ≥ 上个月（如：今天 6月9日，记录到 5月 = 绿色）
- [ ] 黄色状态点：最近记录 < 上个月（如：最后记录在 4月 = 黄色）
- [ ] 无记录的组合：灰色圆点 + 显示「No records」

**展开/折叠：**
- [ ] 点击组合行展开历史表格，再次点击折叠
- [ ] 展开后出现「+ Record」「✏️」「🗑️」三个按钮

**Modal 1 — 录入市值：**
- [ ] 点击「+ Record」打开 Modal，月份默认为上次记录后的下一个月
- [ ] 填写市值 + 追加注资，Save → 组合行的最后记录更新
- [ ] 展开后，历史表格中新增一行
- [ ] 同一月份再次录入（UPSERT）→ 无报错，值被覆盖
- [ ] 点击历史行 ✏️ → Modal 标题变为「Edit — May 2026」，月份 disabled，原值预填

**单月删除：**
- [ ] 点击历史行 🗑️ → 出现内联确认提示（红色背景）
- [ ] 点击 Cancel → 提示消失
- [ ] 点击 Delete → 该行从历史表格消失，组合行的最后记录更新

**Modal 2 — 新建组合：**
- [ ] 点击「New Portfolio」→ Modal 打开，客户姓名已预填（只读）
- [ ] 填写所有字段，创建 → 新组合出现在列表中

**Modal 3 — 编辑组合：**
- [ ] 展开组合，点击 ✏️ 编辑图标 → Modal 打开，所有字段预填
- [ ] 黄色警告 Banner 可见
- [ ] 修改名称，Save → 组合行名称更新

**删除组合：**
- [ ] 展开组合，点击 🗑️ 删除图标 → 弹出确认 Dialog
- [ ] Dialog 显示正确的历史条数（等待加载完后应显示数字）
- [ ] Delete 按钮为红色
- [ ] 确认删除 → 组合从列表消失
- [ ] 在客户端切换到该客户的 Investment 页面 → 该组合已不存在

- [ ] **步骤 4：Commit**

```bash
git add components/advisor/pages/MarketValues.tsx
git commit -m "feat: implement MarketValues page with record/edit/delete modals

- Three-column layout: client list | portfolio panel
- Portfolio status dots: green (≥ last month) / amber (older) / grey (no records)
- Expandable rows: lazy-load history on expand, only one open at a time
- Modal 1 RecordModal: upsert monthly value (new + edit existing month)
- Inline history row delete with confirm prompt
- Modal 2 NewPortfolioModal: create portfolio + seed first history row
- Modal 3 EditPortfolioModal: update name/currency/capital/date with warning
- DeletePortfolioDialog: fetch history count, red destructive button, CASCADE delete"
```

---

## 自检 — 规格覆盖度核查

| 规格需求 | 覆盖任务 |
|---|---|
| 侧边栏新增「Market Values」导航项 | 任务 1 步骤 1 |
| 客户列表（advisor 的所有客户，按名字排序） | 任务 2 步骤 1（`useEffect` 加载） |
| 组合列表含状态点（🟢/🟡/灰） | 任务 2 步骤 1（`isGreenStatus` + status dot JSX） |
| 录入市值 Modal（UPSERT） | 任务 2 步骤 1（`RecordModal`） |
| 月份默认为上次记录后的下一个月 | `nextMonthAfter()` helper |
| 追加注资字段（默认 0） | `RecordModal.cashflow` field |
| 新建组合 Modal（含 seed history row） | `NewPortfolioModal` |
| 展开历史表格（lazy load） | `handleToggleExpand` + `reloadHistory` |
| 历史行 ✏️ 编辑（预填值，月份 disabled） | `RecordModal` with `editRow` prop |
| 历史行 🗑️ 内联删除确认 | `deletingHistoryId` state + inline confirm JSX |
| 编辑组合元数据 Modal（含黄色警告） | `EditPortfolioModal` |
| 删除组合确认弹窗（显示历史条数，红色按钮） | `DeletePortfolioDialog` |
| CASCADE delete（`portfolio_history` 随 `portfolios` 一起删） | 已由 DB schema 保证（`ON DELETE CASCADE`），代码只需 delete from `portfolios` |
| 货币修改不转换历史值 | 设计决策，代码无需特殊处理（UPDATE portfolios 只改元数据） |
