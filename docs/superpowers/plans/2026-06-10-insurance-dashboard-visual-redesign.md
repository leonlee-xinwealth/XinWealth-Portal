# Insurance Dashboard 视觉改造实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `components/Insurance.tsx` 的 Overview Tab 改为评分横幅 + 状态计数 + 环形拨盘，Policies Tab 改为按保险公司分组的保单卡片（含保障类型标签）。

**架构：** 单文件改造，只修改 `components/Insurance.tsx`。新增纯函数 helper 计算评分、状态计数、拨盘颜色、保障类型标签。JSX 渲染部分完全替换，保留数据加载逻辑和字段解析 helpers 不变。

**技术栈：** React + TypeScript + Tailwind CSS + 内联 SVG（无新依赖）

**规格文档：** `docs/superpowers/specs/2026-06-10-insurance-dashboard-visual-redesign.md`

---

## 修改文件清单

| 文件 | 操作 |
|------|------|
| `components/Insurance.tsx` | 修改（新增 helpers + 替换 JSX 渲染部分） |

---

## 任务 1：新增评分与拨盘 Helper 函数

**文件：**
- 修改：`components/Insurance.tsx`（在 `formatRM` 定义之后、组件函数之前插入）

这些 helper 全部是纯函数，接受 `requirements` 数组（与现有 `requirements` 变量结构相同）。

- [ ] **步骤 1：在 `formatRM` 函数之后插入以下 helper 函数**

```tsx
// 颜色阈值（Overview 横幅 + 拨盘共用）
const getCoverageColor = (pct: number): string => {
  if (pct >= 100) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
};

// 整体保障评分（充足类别数 / 总类别数 * 100）
const getBannerScore = (reqs: typeof requirements) => {
  const total = reqs.length;
  const sufficient = reqs.filter(r => r.current >= r.required).length;
  const atRisk = reqs.filter(r => {
    const pct = r.required > 0 ? r.current / r.required : 1;
    return pct >= 0.5 && pct < 1;
  }).length;
  const critical = reqs.filter(r => {
    const pct = r.required > 0 ? r.current / r.required : 1;
    return pct < 0.5;
  }).length;
  const scorePct = total > 0 ? Math.round((sufficient / total) * 100) : 0;
  const label = scorePct >= 80 ? 'Protected' : scorePct >= 50 ? 'Partial' : 'At Risk';
  const color = getCoverageColor(scorePct);
  return { scorePct, label, color, sufficient, atRisk, critical };
};

// 拨盘每格配置
const getDialConfig = (req: { current: number; required: number }) => {
  const pct = req.required > 0 ? Math.min(100, (req.current / req.required) * 100) : 100;
  const color = getCoverageColor(pct);
  const shortfall = req.required - req.current;
  return { pct: Math.round(pct), color, shortfall };
};
```

- [ ] **步骤 2：确认 TypeScript 无报错（保存文件，dev server 热重载不报错即可）**

- [ ] **步骤 3：Commit**

```bash
git add components/Insurance.tsx
git commit -m "feat(insurance): add scoring and dial config helper functions"
```

---

## 任务 2：实现 Score Banner（评分横幅）

**文件：**
- 修改：`components/Insurance.tsx`（替换 Overview Tab 的 JSX，从 `{activeTab === 'overview' ? (` 开始）

Overview Tab 的整体结构将变为：横幅 → 状态计数 → 拨盘网格。本任务实现横幅。

- [ ] **步骤 1：在组件 return 中，找到 `{activeTab === 'overview' ? (` 这一行，将其内部的 `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ...">` 整块（到对应 `</div>`）替换为以下结构**

先在组件内（JSX 之前）添加 banner 相关计算变量：

```tsx
// 在 return 语句之前添加（紧接 requirements 数组之后）
const bannerData = getBannerScore(requirements);

// SVG 环形参数（r=30, circumference = 2π×30 ≈ 188.5）
const RING_R = 30;
const RING_CIRC = 2 * Math.PI * RING_R;
const ringDash = (bannerData.scorePct / 100) * RING_CIRC;
```

然后在 Overview Tab JSX（替换旧卡片网格）写入：

```tsx
<div className="space-y-4 animate-fade-in">
  {/* ── 评分横幅 ── */}
  <div className="rounded-3xl p-5 flex items-center gap-5" style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #1e4a8a 100%)' }}>
    {/* 环形图 */}
    <div className="flex-shrink-0">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={RING_R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
        <circle
          cx="36" cy="36" r={RING_R}
          fill="none"
          stroke={bannerData.color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${ringDash} ${RING_CIRC - ringDash}`}
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="41" textAnchor="middle" fill="white" fontSize="14" fontWeight="800">
          {bannerData.scorePct}%
        </text>
      </svg>
    </div>
    {/* 文字区 */}
    <div className="flex-1">
      <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Protection Score</p>
      <p className="text-2xl font-extrabold text-white mb-2">{bannerData.label}</p>
      {/* 6 个迷你彩点（每个 requirement 一个） */}
      <div className="flex gap-1.5">
        {requirements.map(req => {
          const pct = req.required > 0 ? req.current / req.required : 1;
          const dotColor = pct >= 1 ? '#10b981' : pct >= 0.5 ? '#f59e0b' : '#ef4444';
          return <div key={req.id} className="w-2 h-2 rounded-full" style={{ background: dotColor }} title={req.title} />;
        })}
      </div>
    </div>
  </div>
```

（注意：这个 `<div className="space-y-4 ...">` 还未关闭，后续任务会继续在其中添加内容）

- [ ] **步骤 2：在浏览器确认横幅渲染正常，环形图显示百分比，彩点数量正确（6个）**

- [ ] **步骤 3：Commit**

```bash
git add components/Insurance.tsx
git commit -m "feat(insurance): implement protection score banner with ring chart"
```

---

## 任务 3：实现状态计数器（Status Badges）

**文件：**
- 修改：`components/Insurance.tsx`（紧接横幅 `</div>` 之后，在 `space-y-4` 容器内）

- [ ] **步骤 1：在横幅 `</div>` 之后插入状态计数器行**

```tsx
  {/* ── 状态计数器 ── */}
  <div className="grid grid-cols-3 gap-3">
    {[
      { label: 'Protected', count: bannerData.sufficient, color: '#10b981', bg: '#f0fdf4', border: '#10b981' },
      { label: 'At Risk',   count: bannerData.atRisk,    color: '#f59e0b', bg: '#fffbeb', border: '#f59e0b' },
      { label: 'Critical',  count: bannerData.critical,  color: '#ef4444', bg: '#fef2f2', border: '#ef4444' },
    ].map(({ label, count, color, bg, border }) => (
      <div key={label} className="rounded-2xl p-3 text-center bg-white shadow-sm border border-slate-100" style={{ borderTop: `3px solid ${border}` }}>
        <p className="text-2xl font-extrabold" style={{ color }}>{count}</p>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">{label}</p>
      </div>
    ))}
  </div>
```

- [ ] **步骤 2：浏览器确认 3 个计数器显示正确数字，颜色与各自状态对应**

- [ ] **步骤 3：Commit**

```bash
git add components/Insurance.tsx
git commit -m "feat(insurance): add protected/at-risk/critical status badge counters"
```

---

## 任务 4：实现环形拨盘网格（Dial Grid）

**文件：**
- 修改：`components/Insurance.tsx`（紧接状态计数器之后，关闭 `space-y-4` 容器）

环形拨盘 SVG 参数：r=22，circumference = 2π×22 ≈ 138.2。

- [ ] **步骤 1：在状态计数器 `</div>` 之后插入拨盘网格，并关闭外层 `space-y-4` 容器**

```tsx
  {/* ── 环形拨盘网格 ── */}
  <div className="grid grid-cols-3 gap-3">
    {requirements.map(req => {
      const DIAL_R = 22;
      const DIAL_CIRC = 2 * Math.PI * DIAL_R;
      const { pct, color, shortfall } = getDialConfig(req);
      const dash = (pct / 100) * DIAL_CIRC;
      const isSufficient = req.current >= req.required;

      return (
        <div key={req.id} className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100 flex flex-col items-center">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={DIAL_R} fill="none" stroke={`${color}22`} strokeWidth="5" />
            <circle
              cx="28" cy="28" r={DIAL_R}
              fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${DIAL_CIRC - dash}`}
              transform="rotate(-90 28 28)"
            />
            {isSufficient ? (
              <text x="28" y="33" textAnchor="middle" fill={color} fontSize="14" fontWeight="800">✓</text>
            ) : (
              <text x="28" y="33" textAnchor="middle" fill={color} fontSize="10" fontWeight="800">{pct}%</text>
            )}
          </svg>
          <p className="text-xs font-bold text-slate-600 mt-2 leading-tight">{req.title}</p>
          {isSufficient ? (
            <p className="text-xs font-semibold mt-1" style={{ color: '#10b981' }}>Sufficient</p>
          ) : (
            <p className="text-xs font-semibold mt-1" style={{ color: '#ef4444' }}>-{formatRM(shortfall)}</p>
          )}
        </div>
      );
    })}
  </div>
</div>  {/* 关闭 space-y-4 */}
```

- [ ] **步骤 2：浏览器确认 6 个拨盘均渲染，充足时显示 ✓，不足时显示百分比 + shortfall 金额（红色）**

- [ ] **步骤 3：确认 Overview Tab 整体布局：横幅 → 3计数器 → 6拨盘，移动端无横向溢出**

- [ ] **步骤 4：Commit**

```bash
git add components/Insurance.tsx
git commit -m "feat(insurance): add 3x2 circular dial grid for coverage categories"
```

---

## 任务 5：新增保障类型标签 Helper

**文件：**
- 修改：`components/Insurance.tsx`（在 `getDialConfig` 之后插入）

保障类型标签根据保险记录中各字段是否 > 0 来推断该保单涵盖哪些保障类别。

- [ ] **步骤 1：插入保障类型常量与 helper 函数**

```tsx
const COVERAGE_TAGS = [
  { key: 'dd',  label: 'Death & Disability', bg: '#eff6ff', color: '#1d4ed8', fields: ['Death', 'death', 'TPD', 'tpd'] },
  { key: 'med', label: 'Medical',             bg: '#f0fdf4', color: '#166534', fields: ['Medical Annual limit', 'medical annual limit'] },
  { key: 'ci',  label: 'Critical Illness',   bg: '#fdf4ff', color: '#7e22ce', fields: ['Advance Critical Illness', 'advance critical illness', 'Early Critical Illness', 'early critical illness'] },
  { key: 'acc', label: 'Accident',            bg: '#fff7ed', color: '#c2410c', fields: ['Personal Accident', 'personal accident'] },
] as const;

const getPolicyCoverageTags = (record: any) => {
  return COVERAGE_TAGS.filter(tag =>
    tag.fields.some(field => extractValue(record, [field]) > 0)
  );
};
```

- [ ] **步骤 2：确认 TypeScript 无报错（`as const` 确保 `key` 类型正确）**

- [ ] **步骤 3：Commit**

```bash
git add components/Insurance.tsx
git commit -m "feat(insurance): add coverage type tag helper for policy cards"
```

---

## 任务 6：实现 Policies Tab — 图例 + 分组保单卡片

**文件：**
- 修改：`components/Insurance.tsx`（替换旧 Policies Tab JSX，即 `activeTab === 'policies'` 的 `(` 到对应 `)` 的完整内容）

颜色调色板按出现顺序分配给各保险公司：

```
['#c2410c', '#b91c1c', '#1d4ed8', '#166534', '#7e22ce', '#0369a1', '#b45309', '#0f766e']
```

- [ ] **步骤 1：在 `policies` 数组定义之后插入分组逻辑与调色板**

```tsx
const INSURER_PALETTE = ['#c2410c', '#b91c1c', '#1d4ed8', '#166534', '#7e22ce', '#0369a1', '#b45309', '#0f766e'];

// 将 policies 按保险公司分组，附带颜色
const policyGroups = (() => {
  const map = new Map<string, { color: string; policies: typeof policies }>();
  let colorIdx = 0;
  policies.forEach(p => {
    if (!map.has(p.insurer)) {
      map.set(p.insurer, { color: INSURER_PALETTE[colorIdx % INSURER_PALETTE.length], policies: [] });
      colorIdx++;
    }
    map.get(p.insurer)!.policies.push(p);
  });
  return Array.from(map.entries()).map(([insurer, val]) => ({ insurer, ...val }));
})();
```

- [ ] **步骤 2：在 `policies` 的 map 中同时加入 `rawRecord` 字段以供 tag 使用**

将现有 `policies` 数组定义修改，加入 `rawRecord`：

```tsx
const policies = insuranceRecords.map(record => ({
  id: record.id || record.record_id,
  insurer: extractString(record, ['Insurer', 'insurer', 'Company', 'company']),
  planName: extractString(record, ['Plan Name', 'plan name', 'Plan', 'plan', 'Policy Name', 'policy name']),
  policyNumber: extractString(record, ['Policy Number', 'policy number', 'Policy No', 'policy no']),
  premium: extractValue(record, ['Premium', 'premium']),
  policyUrl: getPolicyUrl(record),
  rawRecord: record,  // 新增，供 getPolicyCoverageTags 使用
})).filter(p => p.planName !== 'Unknown' || p.policyNumber !== 'Unknown');
```

- [ ] **步骤 3：替换 Policies Tab 的 JSX（`activeTab === 'policies'` 的括号内容）**

```tsx
<div className="space-y-6 animate-fade-in">
  {/* 顶部标题 + 计数 */}
  <div className="flex items-center justify-between">
    <h3 className="text-xl font-bold text-xin-blue">Your Policies</h3>
    <span className="bg-xin-blue/10 text-xin-blue px-3 py-1 rounded-full text-xs font-bold">
      {policies.length} Active
    </span>
  </div>

  {policies.length === 0 ? (
    <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
      <p className="text-slate-500 font-medium">No policies found</p>
    </div>
  ) : (
    <>
      {/* 图例 */}
      <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex flex-wrap gap-x-5 gap-y-2 shadow-sm">
        {COVERAGE_TAGS.map(tag => (
          <div key={tag.key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: tag.color }} />
            <span className="text-xs font-semibold text-slate-600">{tag.label}</span>
          </div>
        ))}
      </div>

      {/* 按保险公司分组 */}
      {policyGroups.map(group => (
        <div key={group.insurer}>
          {/* 公司标题行 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: group.color }} />
            <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: group.color }}>
              {group.insurer}
            </span>
            <span className="text-xs text-slate-400">{group.policies.length} {group.policies.length === 1 ? 'policy' : 'policies'}</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* 保单卡片网格 */}
          <div className={`grid gap-3 ${group.policies.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {group.policies.map(policy => {
              const tags = getPolicyCoverageTags(policy.rawRecord);
              return (
                <div
                  key={policy.id}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
                  style={{ borderLeft: `3px solid ${group.color}` }}
                >
                  <p className="text-sm font-bold text-slate-800 mb-0.5 leading-tight">{policy.planName}</p>
                  <p className="font-mono text-xs text-slate-400 mb-3">{policy.policyNumber}</p>

                  {/* 保障类型标签 */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tags.map(tag => (
                        <span
                          key={tag.key}
                          className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ background: tag.bg, color: tag.color }}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 保费 */}
                  <div className="border-t border-slate-50 pt-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-0.5">Premium</p>
                    <p className="text-base font-extrabold" style={{ color: group.color }}>{formatRM(policy.premium)}</p>
                    <p className="text-xs text-slate-400">per year</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  )}
</div>
```

- [ ] **步骤 4：浏览器切换到 Policies Tab，确认：**
  - 图例显示 4 种颜色
  - 每家保险公司独立区块，颜色来自调色板
  - 多张保单时双列布局，单张保单全宽
  - 保障类型标签正确显示（无数据字段时不显示标签）
  - 保费金额颜色与公司颜色一致

- [ ] **步骤 5：Commit**

```bash
git add components/Insurance.tsx
git commit -m "feat(insurance): implement grouped policy cards with coverage type tags"
```

---

## 任务 7：整体验收与收尾

**文件：**
- 修改：`components/Insurance.tsx`（如有需要）

- [ ] **步骤 1：Overview Tab 完整检查**
  - 评分横幅：环形图颜色正确（绿/琥珀/红），迷你彩点 6 个
  - 状态计数器：Protected + At Risk + Critical 总和 = 6
  - 拨盘网格：充足类别显示 ✓，不足类别显示百分比 + 红色 shortfall

- [ ] **步骤 2：Policies Tab 完整检查**
  - 无保单时显示空状态（"No policies found"）
  - 有保单时显示图例 + 分组卡片
  - 单张保单全宽，两张以上双列
  - 无保障类型字段数据的保单不显示 tag 区域（不留空白）

- [ ] **步骤 3：移动端检查（浏览器缩小到 375px 宽）**
  - Overview：拨盘网格 3 列保持，横幅文字不溢出
  - Policies：双列卡片在窄屏下仍可读

- [ ] **步骤 4：最终 commit（如任务 7 有任何修改）**

```bash
git add components/Insurance.tsx
git commit -m "feat(insurance): complete insurance dashboard visual redesign"
```

---

## 自检结果

**规格覆盖度：**
| 规格需求 | 对应任务 |
|---------|---------|
| 评分横幅 — 环形图 + 状态文字 + 迷你彩点 | 任务 1, 2 |
| 状态计数器（Protected/At Risk/Critical） | 任务 1, 3 |
| 6 个环形拨盘（百分比 + shortfall） | 任务 1, 4 |
| 保障类型图例（4 种颜色） | 任务 5, 6 |
| 按保险公司分组 + 调色板 | 任务 6 |
| 保单卡片（1/2 列自适应） | 任务 6 |
| 保障类型标签（字段推断） | 任务 5, 6 |
| 无总保费合计 | 任务 6（未添加） |
| 颜色阈值一致性（绿/琥珀/红） | 任务 1（`getCoverageColor` 共用） |
| 保留数据加载逻辑 | 所有任务（未修改） |

**占位符：** 无。所有步骤均含完整代码。

**类型一致性：** `policies` 数组在任务 6 步骤 2 添加 `rawRecord` 字段后，在步骤 3 的 `getPolicyCoverageTags(policy.rawRecord)` 中使用，一致。`requirements` 类型贯穿任务 1–4 不变。
