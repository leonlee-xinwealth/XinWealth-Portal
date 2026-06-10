# Insurance Dashboard 视觉改造规格

**日期：** 2026-06-10  
**文件：** `components/Insurance.tsx`  
**状态：** 待实现

---

## 1. 背景与目标

现有 Insurance.tsx 使用两个 Tab（Overview / Policies）。Overview 展示 6 张保障卡片，每张底部有细进度条；Policies 展示纯文字表格。整体信息密度高但视觉直觉性弱，客户难以快速判断自己的保障状况。

**目标：** 在不改变数据来源和逻辑的前提下，将两个 Tab 全面视觉化，使客户一眼看出保障是否充足。

---

## 2. Overview Tab 重设计

### 2.1 保障评分横幅（Score Banner）

位于 Overview Tab 顶部，深蓝渐变背景卡片。

**内容：**
- 左侧：SVG 环形图（ring chart）显示整体保障覆盖率百分比
  - 环形颜色阈值：≥ 80% → `#10b981`（绿）；50–79% → `#f59e0b`（琥珀）；< 50% → `#ef4444`（红）
  - 环内显示百分比数字（白色）
- 右侧文字区：
  - 小标签：`PROTECTION SCORE`
  - 大标题：状态文字（`Protected` / `Partial` / `At Risk`，对应绿/琥珀/红）
  - 6 个迷你彩点（每类别一个）：绿 = 充足、琥珀 = 部分不足（50–99%）、红 = 严重不足（< 50%）

**分数计算：** 充足类别数 / 6 × 100%（与现有 `isSufficient` 逻辑一致）

### 2.2 状态计数器（Status Badges）

横幅正下方，三列并排。

| 计数器 | 颜色 | 条件 |
|--------|------|------|
| Protected | 绿 `#10b981` | `current >= required` |
| At Risk | 琥珀 `#f59e0b` | `50% <= current/required < 100%` |
| Critical | 红 `#ef4444` | `current/required < 50%` |

每个计数器：大号数字 + 小号标签文字，顶部 3px 彩色边框。

### 2.3 六个环形拨盘（Dial Grid）

3×2 网格，每格一个保障类别。

**每个拨盘卡片包含：**
- SVG 环形进度（同横幅风格，同色阈值）
- 环内：百分比（< 100%）或 ✓（充足时）
- 环下：类别名称（10px 加粗）
- 名称下：充足时显示绿色 `Sufficient`；不足时显示红色 shortfall 金额（如 `-RM 1.6M`）

**六个类别（对应现有 requirements 数组）：**
1. Accident
2. Medical
3. Critical Illness
4. Disability
5. Early CI
6. Family Protection

---

## 3. Policies Tab 重设计

### 3.1 整体结构

- 顶部标题行：`Your Policies` + `N Active` 徽章（蓝色圆角）
- 图例行（Legend）：4 种保障类型颜色说明
- 按保险公司（Insurer）分组展示

### 3.2 保障类型图例

顶部白色小卡片，4 个色块+标签并排：

| 类型 | 颜色 | 标签 |
|------|------|------|
| Death & Disability | `#1d4ed8`（蓝） | `Death & Disability` |
| Medical | `#166534`（绿） | `Medical` |
| Critical Illness | `#7e22ce`（紫） | `Critical Illness` |
| Accident | `#c2410c`（橙） | `Accident` |

### 3.3 按保险公司分组

每家公司一个区块。公司颜色从固定调色板按出现顺序循环分配（不依赖公司名称）：

```
['#c2410c', '#b91c1c', '#1d4ed8', '#166534', '#7e22ce', '#0369a1', '#b45309', '#0f766e']
```

**区块标题行：**
- 彩色圆点 + 公司名称（全大写加粗）+ 灰色 `N policies` + 横线延伸到右边

**保单卡片网格：**
- 1 张保单 → 单列全宽
- 2+ 张保单 → 双列网格
- 左侧 3px 彩色边框（与公司颜色一致）

**每张保单卡片内容：**
1. 保单名称（Plan Name，11px 加粗）
2. 保单号（Policy Number，monospace 9px 灰色）
3. 保障类型标签（彩色 badge，可多个，wrap 换行）
4. 分隔线
5. 保费金额（`Premium` 小标签 + 大号加粗金额 + `per year`）

### 3.4 保障类型标签数据来源

保障类型标签（Death & Disability / Medical / Critical Illness / Accident）需从保险记录的字段推断，映射规则：

| 字段名存在且 > 0 | 标注类型 |
|-----------------|----------|
| `Death`, `TPD` | Death & Disability |
| `Medical Annual limit` | Medical |
| `Advance Critical Illness`, `Early Critical Illness` | Critical Illness |
| `Personal Accident` | Accident |

一张保单可同时显示多个类型标签。

### 3.5 去除内容

- 不显示总保费合计（Total Annual Premium）行
- 不显示 PDF 下载按钮（维持现有禁用状态）

---

## 4. 保留不变

- 数据来源：`fetchFinancialHealth()` API，字段解析逻辑（`extractValue`、`extractString`）
- Tab 切换机制（`overview` / `policies`）
- 加载状态、错误状态 UI
- `formatRM` 货币格式化
- Annual Income 显示（保留在页面标题区）

---

## 5. 技术约束

- 纯 Tailwind CSS + 内联 SVG（与现有 FinancialHealthCheck 风格一致）
- 不引入新依赖
- 保持响应式：移动端单列，桌面端 3×2 拨盘网格
- 颜色使用现有 `xin-blue` token，新增颜色用 Tailwind 标准色
