# CFP P6 — 报告与客户端改用新模型（设计 + 施工单）

- 日期：2026-09-23 · 上游：框架 spec §7 P6；P2b–P5 的引擎输出
- 现状（2026-09-23 调查）：29 页 PDF 与顾问端报告渲染器只读旧字段 —— 没有法定扣款、可支配结余、一次性项目、自动月供/保费、
  资产质量、新的保险缺口行；客户端 Cashflow/Retirement 从原始行自己算，首页「DEF」用写死的 10×/3×/5×；客户端没有任何待办/到期提醒。

## 决策
1. **不增加 PDF 页数**（`PAGE_ORDER` 固定 29 页）：新内容放进现有页面 —— 现金流页加计划依据、自动项目、法定扣款、可支配结余、一次性项目；
   资产明细页加资产质量标签与 2×2 汇总；保险缺口页改用统一模块的六行，并注明「不含团保」缺口。旧报告（没有新字段）照旧显示。
2. **客户端只显示，不计算**：当前数字来自 `/api/health` 的 `current`（计划）、`insurance_gap`（统一缺口）、`asset_quality`、`portfolio`、
   `review_status`；历史图表仍用按月实际数。首页显示复检到期/待审核横幅。

## 施工单（Sonnet 执行，Opus 审）
- A：`pdf/cfpReport/**` + `components/advisor/cfp/renderers/**`。
- B：客户端 `Player.tsx`、`Cashflow.tsx`、`Retirement.tsx`、`Insurance.tsx`、`LevelUp.tsx`、`api/health.js`、`api/levelUp.js`、`services/apiService.ts`（与 P4-C、P5-C 合并为一个任务）。
