# Advisor Dashboard & Prospect Fixes — 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 补全 prospect 转化流程、让 Dashboard 统计卡可点击跳转到筛选后的客户列表、修复 language 闭包 bug 和 null 安全问题。

**架构：** 全部为前端 React/TypeScript 修改，无新 Supabase 表或 Edge Function。筛选逻辑为客户端 URL param 过滤，已有数据无需重新查询。

**技术栈：** React 18, TypeScript, React Router v6 (`useSearchParams`), Supabase JS, Tailwind CSS

---

## 文件变更概览

| 文件 | 变更 |
|------|------|
| `components/advisor/pages/ClientList.tsx` | 新增状态筛选 Tab，读写 URL `?status=` 参数 |
| `components/advisor/pages/Dashboard.tsx` | 统计卡改为 Link、修复 language bug、修复 null 安全 |
| `components/advisor/pages/ClientDetail.tsx` | 头部新增「转为正式客户」按钮（仅 prospect 显示） |

---

## 任务 1：ClientList — 状态筛选 Tabs

**文件：** `components/advisor/pages/ClientList.tsx`

- [ ] **步骤 1：添加 `useSearchParams` import**

在文件顶部第 2 行修改导入：

```tsx
import { Link, useSearchParams } from 'react-router-dom';
```

- [ ] **步骤 2：读取 URL status param 并计算各状态数量**

在 `const filtered = ...` 之前添加：

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const activeStatus = searchParams.get('status') || '';

const counts = {
  all: clients.length,
  active: clients.filter(c => c.status === 'active').length,
  prospect: clients.filter(c => c.status === 'prospect').length,
  inactive: clients.filter(c => c.status === 'inactive').length,
};
```

- [ ] **步骤 3：将 `filtered` 改为同时支持 status 筛选**

将现有的 `filtered` 定义替换为：

```tsx
const filtered = clients
  .filter(c => !activeStatus || c.status === activeStatus)
  .filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.nric || '').includes(search)
  );
```

- [ ] **步骤 4：定义 Tab 数据和辅助函数**

在 `return (` 前添加：

```tsx
const STATUS_TABS = [
  { value: '', labelEn: 'All', labelZh: '全部', count: counts.all },
  { value: 'active', labelEn: 'Active', labelZh: '活跃', count: counts.active },
  { value: 'prospect', labelEn: 'Prospect', labelZh: '潜在', count: counts.prospect },
  { value: 'inactive', labelEn: 'Inactive', labelZh: '非活跃', count: counts.inactive },
];
```

- [ ] **步骤 5：在 JSX 中添加 Tab 行**

在 `{/* Search */}` div 之前插入：

```tsx
{/* Status filter tabs */}
<div className="flex gap-2 mb-4 flex-wrap">
  {STATUS_TABS.map(tab => {
    const isActive = activeStatus === tab.value;
    return (
      <button
        key={tab.value}
        onClick={() => {
          setSearch('');
          if (tab.value) setSearchParams({ status: tab.value });
          else setSearchParams({});
        }}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          isActive
            ? 'bg-xin-blue text-white'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        {language === 'zh' ? tab.labelZh : tab.labelEn}
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
          isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
        }`}>
          {tab.count}
        </span>
      </button>
    );
  })}
</div>
```

- [ ] **步骤 6：手动验证**

启动开发服务器，前往 `/advisor/clients`：
- 看到 4 个 Tab：全部(N) / 活跃 / 潜在 / 非活跃
- 点击「潜在」→ Tab 高亮、列表只显示 prospect 客户
- 直接访问 `/advisor/clients?status=prospect` → 潜在 Tab 高亮
- 搜索框在切换 Tab 后自动清空

- [ ] **步骤 7：Commit**

```bash
git add components/advisor/pages/ClientList.tsx
git commit -m "feat(advisor): add status filter tabs to client list"
```

---

## 任务 2：Dashboard — 统计卡改为可点击 Link

**文件：** `components/advisor/pages/Dashboard.tsx`

`ChevronRight` 已在第 5 行 import，无需额外操作。

- [ ] **步骤 1：将 stats 数组中的每项加上 `href`**

将现有的 `stats` 数组定义替换为：

```tsx
const stats = [
  {
    label: t('Total Clients', '总客户'),
    value: clients.length,
    icon: <Users size={20} />,
    color: 'text-xin-blue',
    bg: 'bg-blue-50',
    href: '/advisor/clients',
  },
  {
    label: t('Active', '活跃'),
    value: active,
    icon: <UserCheck size={20} />,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    href: '/advisor/clients?status=active',
  },
  {
    label: t('Prospects', '潜在'),
    value: prospects,
    icon: <Target size={20} />,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    href: '/advisor/clients?status=prospect',
  },
];
```

- [ ] **步骤 2：将统计卡的 `div` 换成 `Link`**

将现有的：

```tsx
<div className="grid grid-cols-3 gap-4">
  {stats.map(s => (
    <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 font-medium">{s.label}</span>
        <div className={`${s.bg} ${s.color} p-2 rounded-xl`}>{s.icon}</div>
      </div>
      <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
    </div>
  ))}
</div>
```

替换为：

```tsx
<div className="grid grid-cols-3 gap-4">
  {stats.map(s => (
    <Link
      key={s.label}
      to={s.href}
      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all block"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 font-medium">{s.label}</span>
        <div className={`${s.bg} ${s.color} p-2 rounded-xl`}>{s.icon}</div>
      </div>
      <div className="flex items-end justify-between">
        <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
        <ChevronRight size={14} className="text-slate-300 mb-1" />
      </div>
    </Link>
  ))}
</div>
```

- [ ] **步骤 3：手动验证**

- 统计卡有 hover 阴影提升效果（cursor: pointer）
- 点击「总客户」→ 跳到 `/advisor/clients`（全部）
- 点击「活跃」→ 跳到 `/advisor/clients`，活跃 Tab 自动高亮
- 点击「潜在」→ 跳到 `/advisor/clients`，潜在 Tab 自动高亮

- [ ] **步骤 4：Commit**

```bash
git add components/advisor/pages/Dashboard.tsx
git commit -m "feat(advisor): make dashboard stats cards link to filtered client list"
```

---

## 任务 3：Dashboard — 修复 language bug + null 安全

**文件：** `components/advisor/pages/Dashboard.tsx`

- [ ] **步骤 1：修复 null 安全（line ~136）**

将：

```tsx
{advisor ? `, ${advisor.display_name.split(' ')[0]}` : ''}
```

改为：

```tsx
{advisor ? `, ${advisor.display_name?.split(' ')[0] ?? ''}` : ''}
```

- [ ] **步骤 2：修复 language 闭包 bug**

在 `useEffect` 的依赖数组中添加 `language`：

```tsx
  }, [language]);   // 原来是 }, []);
```

这使得每次切换语言时，effect 重新运行，`miss` 函数捕获最新的 `language` 值，incomplete 原因的翻译文案随之更新。

- [ ] **步骤 3：手动验证**

- 切换到中文 → 「缺少资料」卡片中的缺失原因显示为中文（生日、电话、身份证…）
- 切换回英文 → 正确显示英文原因（DOB、Phone、NRIC…）
- 如果 `advisor.display_name` 为 null，页面不崩溃

- [ ] **步骤 4：Commit**

```bash
git add components/advisor/pages/Dashboard.tsx
git commit -m "fix(advisor): language-reactive incomplete reasons and null-safe display_name"
```

---

## 任务 4：ClientDetail — 「转为正式客户」按钮

**文件：** `components/advisor/pages/ClientDetail.tsx`

- [ ] **步骤 1：添加 converting 状态**

在现有 `useState` 声明的最后（line ~25）添加：

```tsx
const [converting, setConverting] = useState(false);
```

- [ ] **步骤 2：添加 handleConvert 函数**

在 `loadPending` 函数之后添加：

```tsx
async function handleConvert() {
  if (!client || converting) return;
  setConverting(true);
  await supabase.from('clients').update({ status: 'active' }).eq('id', client.id);
  await loadClient();
  setConverting(false);
}
```

- [ ] **步骤 3：在头部 status badge 后插入转化按钮**

找到 `components/advisor/pages/ClientDetail.tsx` 第 95-97 行的 status badge：

```tsx
<span className={`${s.bg} ${s.text} text-xs font-semibold px-2 py-0.5 rounded-full`}>
  {language === 'zh' ? s.labelZh : s.label}
</span>
```

改为：

```tsx
<div className="flex items-center gap-2 flex-wrap">
  <span className={`${s.bg} ${s.text} text-xs font-semibold px-2 py-0.5 rounded-full`}>
    {language === 'zh' ? s.labelZh : s.label}
  </span>
  {client.status === 'prospect' && (
    <button
      onClick={handleConvert}
      disabled={converting}
      className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
    >
      {converting ? '...' : `✓ ${t('Convert to Active', '转为正式客户')}`}
    </button>
  )}
</div>
```

- [ ] **步骤 4：手动验证**

- 打开一个 status 为 `prospect` 的客户 → 头部看到绿色「转为正式客户」按钮
- 点击按钮 → 显示「...」loading 状态
- 完成后：badge 变为绿色「活跃」，按钮消失
- 打开一个 status 为 `active` 的客户 → 不显示此按钮
- 刷新页面后状态依然是 active（已写入 Supabase）

- [ ] **步骤 5：Commit**

```bash
git add components/advisor/pages/ClientDetail.tsx
git commit -m "feat(advisor): add convert-to-active button for prospect clients"
```

---

## 规格覆盖度检查

| 规格需求 | 覆盖任务 |
|----------|----------|
| ClientList — Status Filter Tabs | 任务 1 |
| Dashboard stats cards — Clickable Links | 任务 2 |
| ClientDetail — Convert to Active Button | 任务 4 |
| Dashboard — language bug fix | 任务 3 步骤 2 |
| Dashboard — null safety | 任务 3 步骤 1 |
